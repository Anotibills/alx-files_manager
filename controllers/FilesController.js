import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import mongoDBCore from 'mongodb/lib/core';
// import mime from 'mime-types';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const fileQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379');

class FilesController {
  static async getUser(request) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (userId) {
      const idObject = new mongoDBCore.BSON.ObjectId(userId);
      const user = await (await dbClient.usersCollection()).findOne({ _id: idObject });
      return user || null;
    }
    return null;
  }

  static async postUpload(request, response) {
    /**
   * Create a new file in the database and on disk
   * @param {Request} req - The request object.
   * @param {Response} res - The response object.
   * @returns {Object} - The new file or an error message.
   */
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const {
      name, type, parentId, isPublic: isPublicStr, data,
    } = request.body;
    const isPublic = isPublicStr === 'true' || false;

    if (!name) {
      return response.status(400).json({ error: 'Missing name' });
    }
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return response.status(400).json({ error: 'Missing type' });
    }
    if (type !== 'folder' && !data) {
      return response.status(400).json({ error: 'Missing data' });
    }

    const files = await dbClient.filesCollection();
    if (parentId) {
      const idObject = new mongoDBCore.BSON.ObjectId(parentId);
      const parentFile = await files.findOne({ _id: idObject, userId: user._id });
      if (!parentFile) {
        return response.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return response.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    const userId = user._id.toString();
    const filePath = process.env.FOLDER_PATH || '/tmp/files_manager';

    await fs.mkdir(filePath, { recursive: true });

    const newFile = {
      userId: new mongoDBCore.BSON.ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId || 0,
    };
    if (type !== 'folder') {
      const fileFullPath = `${filePath}/${uuidv4()}`;
      fs.writeFile(fileFullPath, Buffer.from(data, 'base64'));
      newFile.localPath = fileFullPath;
    }

    const result = await files.insertOne(newFile);
    const fileId = result.insertedId.toString();
    if (type === 'image') {
      const jobName = `image thumbnail [${userId} -${fileId}]`;
      fileQueue.add({ userId, fileId, name: jobName });
    }
    return response.status(201).json({
      id: fileId,
      userId,
      name,
      type,
      isPublic,
      parentId: parentId || 0,
    });
  }
}

module.exports = FilesController;
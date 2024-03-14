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

  static async getShow(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = request.params.id;
    const userId = user._id.toString();
    const files = await dbClient.filesCollection();
    try {
      const file = await files.findOne({
        _id: new mongoDBCore.BSON.ObjectId(fileId),
        userId: new mongoDBCore.BSON.ObjectId(userId),
      });
      if (!file) {
        return response.status(404).json({ error: 'Not found here' });
      }
      return response.status(200).json(file);
    } catch (error) {
      console.error(error);
      return response.status(500).json({ error: 'Internal Server Error' });
    }
    // id,
    // userId,
    // name: file.name,
    // type: file.type,
    // isPublic: file.isPublic,
    // parentId: file.parentId,
    // });
  }

  static async getIndex(request, response) {
    const user = await FilesController.getUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }

    const {
      parentId,
      page,
    } = request.query;
    const pageNum = page || 0;

    const files = await dbClient.filesCollection();

    let fileQuery;
    if (!parentId) {
      fileQuery = { userId: user._id };
    } else {
      fileQuery = { userId: user._id, parentId: new mongoDBCore.BSON.ObjectId(parentId) };
    }

    files.aggregate([
      { $match: fileQuery },
      { $sort: { _id: -1 } },
      {
        $facet: {
          metadata: [{ $count: 'total' }, { $addFields: { page: parseInt(pageNum, 10) } }],
          data: [{ $skip: 20 * parseInt(pageNum, 10) }, { $limit: 20 }],
        },
      },
    ]).toArray((err, result) => {
      if (result) {
        const finalFile = result[0].data.map((file) => {
          const tempFile = {
            ...file,
            id: file._id,
          };
          delete tempFile._id;
          delete tempFile.localPath;
          return tempFile;
        });
        return response.status(200).json(finalFile);
      }
      console.log('Error Occured');
      return response.status(404).json({ error: 'Not found' });
    });
    return null;
  }
}

module.exports = FilesController;

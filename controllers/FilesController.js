import { v4 as generateUuid } from 'uuid';
import { promises as filesystem } from 'fs';
import { ObjectID } from 'mongodb';
import mime from 'mime-types';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const fileQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379');

class FilesController {
  static async fetchUser(request) {
    const token = request.header('X-Token');
    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (userId) {
      const usersCollection = dbClient.db.collection('users');
      const objectId = new ObjectID(userId);
      const user = await usersCollection.findOne({ _id: objectId });
      if (!user) {
        return null;
      }
      return user;
    }
    return null;
  }

  static async uploadFile(request, response) {
    const user = await FilesController.fetchUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const { name, type, parentId, isPublic: isPublicFile, data } = request.body;
    if (!name) {
      return response.status(400).json({ error: 'Name is required' });
    }
    if (!type) {
      return response.status(400).json({ error: 'Type is required' });
    }
    if (type !== 'folder' && !data) {
      return response.status(400).json({ error: 'Data is required for non-folder type' });
    }

    const filesCollection = dbClient.db.collection('files');
    if (parentId) {
      const parentIdObject = new ObjectID(parentId);
      const parentFile = await filesCollection.findOne({ _id: parentIdObject, userId: user._id });
      if (!parentFile) {
        return response.status(400).json({ error: 'Parent file not found' });
      }
      if (parentFile.type !== 'folder') {
        return response.status(400).json({ error: 'Parent is not a folder' });
      }
    }
    if (type === 'folder') {
      filesCollection.insertOne(
        {
          userId: user._id,
          name,
          type,
          parentId: parentId || 0,
          isPublic: isPublicFile || false,
        },
      ).then((result) => response.status(201).json({
        id: result.insertedId,
        userId: user._id,
        name,
        type,
        isPublic: isPublicFile || false,
        parentId: parentId || 0,
      })).catch((error) => {
        console.log(error);
      });
    } else {
      const filePath = process.env.FILE_PATH || '/tmp/files_manager';
      const fileName = `${filePath}/${generateUuid()}`;
      const bufferData = Buffer.from(data, 'base64');
      try {
        try {
          await filesystem.mkdir(filePath);
        } catch (error) {
          // Do nothing, folder already exists
        }
        await filesystem.writeFile(fileName, bufferData, 'utf-8');
      } catch (error) {
        console.log(error);
      }
      filesCollection.insertOne(
        {
          userId: user._id,
          name,
          type,
          isPublic: isPublicFile || false,
          parentId: parentId || 0,
          localPath: fileName,
        },
      ).then((result) => {
        response.status(201).json(
          {
            id: result.insertedId,
            userId: user._id,
            name,
            type,
            isPublic: isPublicFile || false,
            parentId: parentId || 0,
          },
        );
        if (type === 'image') {
          fileQueue.add(
            {
              userId: user._id,
              fileId: result.insertedId,
            },
          );
        }
      }).catch((error) => console.log(error));
    }
    return null;
  }

  static async showFile(request, response) {
    const user = await FilesController.fetchUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const fileId = request.params.id;
    const filesCollection = dbClient.db.collection('files');
    const objectId = new ObjectID(fileId);
    const file = await filesCollection.findOne({ _id: objectId, userId: user._id });
    if (!file) {
      return response.status(404).json({ error: 'File not found' });
    }
    return response.status(200).json(file);
  }

  static async indexFiles(request, response) {
    const user = await FilesController.fetchUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const { parentId, page } = request.query;
    const pageNum = page || 0;
    const filesCollection = dbClient.db.collection('files');
    let query;
    if (!parentId) {
      query = { userId: user._id };
    } else {
      query = { userId: user._id, parentId: ObjectID(parentId) };
    }
    filesCollection.aggregate(
      [
        { $match: query },
        { $sort: { _id: -1 } },
        {
          $facet: {
            metadata: [{ $count: 'total' }, { $addFields: { page: parseInt(pageNum, 10) } }],
            data: [{ $skip: 20 * parseInt(pageNum, 10) }, { $limit: 20 }],
          },
        },
      ],
    ).toArray((err, result) => {
      if (result) {
        const finalResult = result[0].data.map((file) => {
          const modifiedFile = {
            ...file,
            id: file._id,
          };
          delete modifiedFile._id;
          delete modifiedFile.localPath;
          return modifiedFile;
        });
        return response.status(200).json(finalResult);
      }
      console.log('Error occurred');
      return response.status(404).json({ error: 'Not found' });
    });
    return null;
  }

  static async publishFile(request, response) {
    const user = await FilesController.fetchUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = request.params;
    const filesCollection = dbClient.db.collection('files');
    const objectId = new ObjectID(id);
    const newValue = { $set: { isPublic: true } };
    const options = { returnOriginal: false };
    filesCollection.findOneAndUpdate({ _id: objectId, userId: user._id }, newValue, options, (err, file) => {
      if (!file.lastErrorObject.updatedExisting) {
        return response.status(404).json({ error: 'File not found' });
      }
      return response.status(200).json(file.value);
    });
    return null;
  }

  static async unpublishFile(request, response) {
    const user = await FilesController.fetchUser(request);
    if (!user) {
      return response.status(401).json({ error: 'Unauthorized' });
    }
    const { id } = request.params;
    const filesCollection = dbClient.db.collection('files');
    const objectId = new ObjectID(id);
    const newValue = { $set: { isPublic: false } };
    const options = { returnOriginal: false };
    filesCollection.findOneAndUpdate({ _id: objectId, userId: user._id }, newValue, options, (err, file) => {
      if (!file.lastErrorObject.updatedExisting) {
        return response.status(404).json({ error: 'File not found' });
      }
      return response.status(200).json(file.value);
    });
    return null;
  }

  static async downloadFile(request, response) {
    const { id } = request.params;
    const filesCollection = dbClient.db.collection('files');
    const objectId = new ObjectID(id);
    filesCollection.findOne({ _id: objectId }, async (err, file) => {
      if (!file) {
        return response.status(404).json({ error: 'File not found' });
      }
      console.log(file.localPath);
      if (file.isPublic) {
        if (file.type === 'folder') {
          return response.status(400).json({ error: "Folders don't contain content" });
        }
        try {
          let fileName = file.localPath;
          const size = request.param('size');
          if (size) {
            fileName = `${file.localPath}_${size}`;
          }
          const fileData = await filesystem.readFile(fileName);
          const contentType = mime.contentType(file.name);
          return response.header('Content-Type', contentType).status(200).send(fileData);
        } catch (error) {
          console.log(error);
          return response.status(404).json({ error: 'File not found' });
        }
      } else {
        const requesterUser = await FilesController.fetchUser(request);
        if (!requesterUser) {
          return response.status(404).json({ error: 'Unauthorized' });
        }
        if (file.userId.toString() === requesterUser._id.toString()) {
          if (file.type === 'folder') {
            return response.status(400).json({ error: "Folders don't contain content" });
          }
          try {
            let fileName = file.localPath;
            const size = request.param('size');
            if (size) {
              fileName = `${file.localPath}_${size}`;
            }
            const contentType = mime.contentType(file.name);
            return response.header('Content-Type', contentType).status(200).sendFile(fileName);
          } catch (error) {
            console.log(error);
            return response.status(404).json({ error: 'File not found' });
          }
        } else {
          console.log(`Incorrect user: file.userId=${file.userId}; userId=${requesterUser._id}`);
          return response.status(404).json({ error: 'File not found' });
        }
      }
    });
  }
}

module.exports = FilesController;

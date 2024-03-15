import Queue from 'bull';
import imageThumbnail from 'image-thumbnail';
import { promises as fs } from 'fs';
import mongoDBCore from 'mongodb/lib/core';
import dbClient from './utils/db';

const fileQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379');
const userQueue = new Queue('userQueue', 'redis://127.0.0.1:6379');

async function thumbNail(width, localPath) {
  const thumbnail = await imageThumbnail(localPath, { width });
  return thumbnail;
}

fileQueue.process(async (job, done) => {
  console.log('Processing...');
  try {
    const { fileId, userId } = job.data;

    if (!fileId) {
      throw new Error('Missing fileId');
    }
    if (!userId) {
      throw new Error('Missing userId');
    }

    const files = await dbClient.filesCollection();
    const idObject = new mongoDBCore.BSON.ObjectId(fileId);
    const file = await files.findOne({
      _id: idObject,
      userId: new mongoDBCore.BSon.ObjectId(userId),
    });

    if (!file) {
      console.log('File not found');
      throw new Error('File not found');
    }

    const fileName = file.localPath;
    const thumbnail500 = await thumbNail(500, fileName);
    const thumbnail250 = await thumbNail(250, fileName);
    const thumbnail100 = await thumbNail(100, fileName);

    console.log('Writing files to system');
    const image500 = `${file.localPath}_500`;
    const image250 = `${file.localPath}_250`;
    const image100 = `${file.localPath}_100`;

    await Promise.all([
      fs.writeFile(image500, thumbnail500),
      fs.writeFile(image250, thumbnail250),
      fs.writeFile(image100, thumbnail100),
    ]);
    done();
  } catch (error) {
    console.error('Error processing fileQueue:', error);
    done(error);
  }
});

userQueue.process(async (job, done) => {
  try {
    const { userId } = job.data;
    if (!userId) {
      throw new Error('Missing userId');
    }

    const users = await dbClient.usersCollection();
    const idObject = new mongoDBCore.BSON.ObjectId(userId);
    const user = await users.findOne({ _id: idObject });

    if (user) {
      console.log(`Welcome ${user.email}!`);
      done();
    } else {
      throw new Error('User not found');
    }
  } catch (error) {
    console.error('Error processing userQueue:', error);
    done(error);
  }
});

import Queue from 'bull';
import imageThumbnail from 'image-thumbnail';
import { promises as fs } from 'fs';
import { ObjectID } from 'mongodb';
import dbClient from './utils/db';

const fileQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379');
const userQueue = new Queue('userQueue', 'redis://127.0.0.1:6379');

async function thumbNail(width, localPath) {
  try {
    const thumbnail = await imageThumbnail(localPath, { width });
    return thumbnail;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    throw new Error('Thumbnail generation failed');
  }
}

fileQueue.process(async (job, done) => {
  console.log('Processing...');
  try {
    const { fileId, userId } = job.data;
    if (!fileId || !userId) {
      throw new Error('Missing fileId or userId');
    }

    const files = dbClient.db.collection('files');
    const idObject = new ObjectID(fileId);
    const file = await files.findOne({ _id: idObject });

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
      fs.writeFile(image100, thumbnail100)
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

    const users = dbClient.db.collection('users');
    const idObject = new ObjectID(userId);
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

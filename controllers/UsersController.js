import sha1 from 'sha1';
import mongoDBCore from 'mongodb/lib/core';
import Queue from 'bull';
import dbClient from '../utils/db';
import redisClient from '../utils/redis';

const userQueue = new Queue('fileQueue', 'redis://127.0.0.1:6379');

export default class UsersController {
  /**
   * Create a new user in the database
   * @params {Request} req - The request object.
   * @params {Response} res - The response object.
   * @returns {Object} - The response containing the new user
   * information or an error message.
   */
  static async postNew(req, res) {
    try {
      const { email, password } = req.body;

      // Check if email and password are provided
      if (!email) {
        return res.status(400).json({ error: 'Missing email' });
      }
      if (!password) {
        return res.status(400).json({ error: 'Missing password' });
      }

      // Check if email already exists in DB
      const user = await (await dbClient.usersCollection()).findOne({ email });
      if (user) {
        return res.status(400).json({ error: 'Already exist' });
      }

      // Hash the password using SHA1
      const newUser = await (await dbClient.usersCollection())
        .insertOne({ email, password: sha1(password) });

      // Return the new user
      const userId = newUser.insertedId.toString();

      userQueue.add({ userId });
      return res.status(201).json({ id: newUser.insertedId, email });
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await (await dbClient.usersCollection())
      .findOne({ _id: new mongoDBCore.BSON.ObjectId(userId) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.status(200).json({ id: user._id.toString(), email: user.email });
  }
}

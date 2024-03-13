import { v4 as uuidv4 } from 'uuid';
import sha1 from 'sha1';
import redisClient from '../utils/redis';
import dbClient from '../utils/db';

export default class AuthController {
  /**
   * Sign-in the user by generating a new authentication token
   * @param {Request} req - The request object.
   * @param {Response} res - The response object.
   * @returns {Object} - The authentication token or error message.
   */
  static async getConnect(req, res) {
    const credentials = Buffer.from(req.headers.authorization.split(' ')[1], 'base64').toString('utf-8').split(':');
    const email = credentials[0];
    const password = credentials[1];

    const user = await (await dbClient.usersCollection())
      .findOne({ email, password: sha1(password) });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = uuidv4();
    const key = `auth_${token}`;
    await redisClient.set(key, user._id.toString(), 24 * 60 * 60);

    return res.status(200).json({ token });
  }

  /**
   * Sign-out the user based on the token
   * @param {Request} req - The request object.
   * @param {Response} res - The response object.
   * @returns {Object} - The response status.
   */
  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await redisClient.del(`auth_${token}`);
    return res.status(204).send();
  }
}

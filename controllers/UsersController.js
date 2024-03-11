import sha1 from 'sha1';
import dbClient from '../utils/db';

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
      res.status(201).json({ id: newUser.insertedId, email });
    } catch (error) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

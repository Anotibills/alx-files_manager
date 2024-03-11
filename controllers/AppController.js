import redisClient from '../utils/redis';
import dbClient from '../utils/db';

const AppController = {
  /**
   * Get the status of Redis and the database.
   * @params {Request} req The request object.
   * @params {Response} res The response object.
   * @return {Object} The status of Redis and the database'
   */
  async getStatus(req, res) {
    const redisStatus = redisClient.isAlive();
    const dbStatus = dbClient.isAlive();

    if (redisStatus && dbStatus) {
      res.status(200).json({ redis: true, db: true });
    } else {
      res.status(500).json({ redis: redisStatus, db: dbStatus });
    }
  },

  /**
   * Get the number of users and files in the database.
   * @param {Request} req The request object.
   * @param {Response} res The response object.
   * @returns {Object} The number of users and files.
   */
  async getStats(req, res) {
    try {
      const numUsers = await dbClient.nbUsers();
      const numFiles = await dbClient.nbFiles();

      res.status(200).json({ users: numUsers, files: numFiles });
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  },
};

export default AppController;

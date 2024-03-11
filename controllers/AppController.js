import redisClient from '../utils/redis.js';
import dbClient from '../utils/db.js';

const AppController = {
  async getStatus(req, res) {
    const redisStatus = redisClient.isAlive();
    const dbStatus = dbClient.isAlive();

    if (redisStatus && dbStatus) {
      res.status(200).json({ redis: true, db: true });
    } else {
      res.status(500).json({ redis: redisStatus, db: dbStatus });
    }
  },

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

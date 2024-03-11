import express from 'express';
import AppController from '../controllers/AppController';

const router = express.Router();

/**
 * Endpoint: /status
 * Method: GET
 * Description: Check the status of Redis and the database.
 * Returns:
 *   - If both Redis and the database are alive: { "redis": true, "db": true }
 *   - If either Redis or the database is not alive:
 *   Status code 500 with { "redis": false, "db": false }
 */
router.get('/status', AppController.getStatus);

/**
 * Endpoint: /stats
 * Method: GET
 * Description: Get the number of users and files in the database.
 * Returns: { "users": <number_of_users>, "files": <number_of_files> }
 */
router.get('/stats', AppController.getStats);

export default router;

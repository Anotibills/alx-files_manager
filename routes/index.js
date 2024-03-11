import express from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';

const router = express.Router();

/**
 * GET /status - Check the status of Redis and the database.
 * GET /stats - Get the number of users and files in the database.
 * POST /users - Create a new user in the database.
 */
router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);
router.post('/users', UsersController.postNew);

export default router;

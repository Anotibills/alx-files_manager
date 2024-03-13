import express from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';
import FilesController from '../controllers/FilesController';

const router = express.Router();

/**
 * GET /status - Check the status of Redis and the database.
 * GET /stats - Get the number of users and files in the database.
 * POST /users - Create a new user in the database.
 * GET /connect - Sign-in the user by generating a new authentication token.
 * GET /disconnect - Sign-out the user based on the token.
 * GET /users/me - Retrieve the user based on the token.
 */
router.get('/status', AppController.getStatus);
router.get('/stats', AppController.getStats);
router.post('/users', UsersController.postNew);
router.get('/connect', AuthController.getConnect);
router.get('/disconnect', AuthController.getDisconnect);
router.get('/users/me', UsersController.getMe);
router.post('/files', FilesController.postUpload);
// router.get('/files/:id', FilesController.getShow);
// router.get('/files', FilesController.getIndex);
// router.put('/files/:id/publish', FilesController.putPublish);
// router.put('/files/:id/unpublish', FilesController.putUnpublish);
// router.get('/files/:id/data', FilesController.getFile);

export default router;

import express from 'express';
const router = express.Router();
import { createSuperAdmin, getCompanies, getCompanyUsers, updateUserStatus, undeleteUser, getGlobalUsers, updateGlobalUserStatus  } from '../controllers/userController.js';
import auth from '../middleware/auth.js';


router.post('/create-super-admin', createSuperAdmin);
router.get('/tenents', auth, getCompanies);
// router.get('/company/:companyId', auth, getCompanyUsers);
router.patch('/:userId/status', auth, updateUserStatus);
router.patch('/undelete/:userId', auth, undeleteUser);
router.get('/global', auth, getGlobalUsers);
router.patch('/global/:globalUserId/status', auth, updateGlobalUserStatus);


export default router;
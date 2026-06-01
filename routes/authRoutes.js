import express from 'express';
const router = express.Router();
import { login,completeCompanyRegistration, setCompanyEmailAndPassword, changeCompanyStatus, verifySuperAdmin, logout, refreshSession } from '../controllers/authController.js';
import auth from '../middleware/auth.js';
import { restrictTo  } from '../middleware/permisions.js';
router.post('/login', login);
router.patch('/set-new-password/:id', auth,restrictTo('admin'), setCompanyEmailAndPassword);
router.patch('/change-status/:id', auth, changeCompanyStatus);
router.patch('/complete/:token',completeCompanyRegistration )
router.patch('/verify',verifySuperAdmin );
router.post('/logout',logout);
router.post('/refresh', refreshSession);

export default router;
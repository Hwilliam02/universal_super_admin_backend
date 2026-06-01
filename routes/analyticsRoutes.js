import express from 'express';
const router = express.Router();
import auth from '../middleware/auth.js';
import { getCompanyAnalytics  } from '../controllers/logController.js';

// Company analytics endpoints (superadmin only, enforced in controller)
router.get('/company/:companyId', auth, getCompanyAnalytics);

export default router;;

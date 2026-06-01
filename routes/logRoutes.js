import express from 'express';
const router = express.Router();
import auth from '../middleware/auth.js';
import { getActivityLogs, getExceptionLogs  } from '../controllers/logController.js';

// All log endpoints are superadmin-only (also re-checked in controllers)
router.get('/activity', auth, getActivityLogs);
router.get('/exceptions', auth, getExceptionLogs);

export default router;;

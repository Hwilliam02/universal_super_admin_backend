import express from 'express';
const router = express.Router();
import { masterLogin,
  masterSignup,
  masterVerify,
  refreshAppToken,
  verifyUserCode,
  verifyUserLink,
  resendUserVerification
 } from '../controllers/universalAuthController.js';

router.post('/signup', masterSignup);
router.post('/login', masterLogin);
router.post('/verify', masterVerify);
router.post('/refresh', refreshAppToken);

// User verification routes
router.post('/verify-user', verifyUserCode);
router.get('/verify-link/:token', verifyUserLink);
router.post('/resend-verification', resendUserVerification);

export default router;

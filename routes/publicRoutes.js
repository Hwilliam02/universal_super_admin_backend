import express from 'express';
const router = express.Router();
import rateLimit from 'express-rate-limit';
import { publicSignup,
  verifyTrialToken,
  completeTrial,
  checkNameAvailability,
 } from '../controllers/publicController.js';

// ── Rate Limiters ────────────────────────────────────────────
const signupLimiter = rateLimit({
  windowMs: (parseInt(process.env.SIGNUP_RATE_LIMIT_MINS) || 15) * 60 * 1000,
  max: parseInt(process.env.SIGNUP_RATE_LIMIT_MAX) || 5,
  message: {
    status: false,
    message: `Too many signup attempts. Please try again after ${process.env.SIGNUP_RATE_LIMIT_MINS || 15} minutes.`,
  },
});

const checkNameLimiter = rateLimit({
  windowMs: (parseInt(process.env.CHECK_NAME_RATE_LIMIT_MINS) || 1) * 60 * 1000,
  max: parseInt(process.env.CHECK_NAME_RATE_LIMIT_MAX) || 20,
  message: {
    status: false,
    message: "Too many requests. Please slow down.",
  },
});

// ── Public Routes (No Auth) ──────────────────────────────────
router.post("/signup", signupLimiter, publicSignup);
router.get("/verify-trial/:token", verifyTrialToken);
router.post("/check-name", checkNameLimiter, checkNameAvailability);
router.patch("/complete-trial/:token", completeTrial);

export default router;;

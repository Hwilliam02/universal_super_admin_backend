// import express from 'express';
// const router = express.Router();
// import multer from 'multer';
// import { createLead, getLeads, updateLeadStatus, deleteLead  } from '../controllers/leadController.js';
// import auth from '../middleware/auth.js';

// import rateLimit from 'express-rate-limit';

// const storage = multer.memoryStorage();

// const isImage = (req, file, callback) => {
//   if (file.mimetype && file.mimetype.startsWith("image")) {
//     callback(null, true);
//   } else {
//     callback(new Error("Only image files are allowed"), false);
//   }
// };

// const upload = multer({
//   storage: storage,
//   fileFilter: isImage,
// });

// const createLeadLimiter = rateLimit({
//   windowMs: (parseInt(process.env.LEAD_RATE_LIMIT_MINS) || 15) * 60 * 1000,
//   max: parseInt(process.env.LEAD_RATE_LIMIT_MAX) || 5, 
//   message: {
//     status: false,
//     message: `Too many leads created from this IP, please try again after ${process.env.LEAD_RATE_LIMIT_MINS || 15} minutes.`
//   }
// });

// router.post("/create", createLeadLimiter, upload.single("logo"), createLead);
// router.get("/all", auth, getLeads);
// router.patch("/status/:id", auth, updateLeadStatus);
// router.delete("/:id", auth, deleteLead);

// export default router;;

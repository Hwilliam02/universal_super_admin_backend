import express from 'express';
const router = express.Router();
import multer from 'multer';
import { createCompany, softDeleteCompany, undeleteCompany, updateCompanyFeatures, updateCompanyLimits, checkCompanyNameAvailability, superAdminAccess, resendCompanyRegistrationRequest  } from '../controllers/companyController.js';
import auth from '../middleware/auth.js';
import companyCreationRateLimiter from '../middleware/companyRateLimit.js';


const storage = multer.memoryStorage();

// Image filter with debugging
const isImage = (req, file, callback) => {
  console.log("File mimetype:", file.mimetype); // Log the mimetype for debugging
  if (file.mimetype && file.mimetype.startsWith("image")) {
    callback(null, true); // Accept the file
  } else {
    callback(new Error("Only image files are allowed"), false); // Reject the file
  }
};

const upload = multer({
  storage: storage,
  fileFilter: isImage,
});


router.post('/create',companyCreationRateLimiter, auth,upload.single('logo'), createCompany);
router.get('/check-name-availability', auth, checkCompanyNameAvailability);
router.patch('/soft-delete/:id', auth, softDeleteCompany);
router.patch('/undelete/:id', auth, undeleteCompany);
router.patch('/update-features/:id', auth, updateCompanyFeatures);
router.patch('/update-limits/:id', auth, updateCompanyLimits);
router.post('/request-admin/:adminId', auth,superAdminAccess );
router.patch('/resend-registration-request/:id', auth,resendCompanyRegistrationRequest )

// Commented out routes - functions removed from controller
// router.post('/order', auth, createOrder);
// router.post('/dispatcher', auth, createDispatcher);
// router.get('/dispatcher/:id', auth, getDispatcherById);
// router.get('/orders', auth, getOrders);


export default router;
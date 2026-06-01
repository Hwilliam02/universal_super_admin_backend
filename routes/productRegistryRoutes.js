import express from 'express';
const router = express.Router();
import { registerProduct,
  getAllProducts,
  getProductById,
  getProductByProductId,
  getProductUsersByProductId,
  updateProductVerificationMethod
 } from '../controllers/productRegistryController.js';

// In a real app, these routes should be protected by a SuperAdmin middleware
router.post('/', registerProduct);
router.get('/', getAllProducts);
router.get('/by-product-id/:productId', getProductByProductId);
router.get('/by-product-id/:productId/users', getProductUsersByProductId);
router.patch('/:id/verification-method', updateProductVerificationMethod);
router.get('/:id', getProductById);

export default router;

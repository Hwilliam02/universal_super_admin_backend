import express from 'express';
const router = express.Router();
import userRoutes from './userRoutes.js';
import authRoutes from './authRoutes.js';
import companyRoutes from './companyRoutes.js';
import logRoutes from './logRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
// import leadRoutes from './leadRoutes.js';
import publicRoutes from './publicRoutes.js';

import productRegistryRoutes from './productRegistryRoutes.js';
import universalAuthRoutes from './universalAuthRoutes.js';

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/company', companyRoutes);
router.use('/logs', logRoutes)
router.use('/analytics', analyticsRoutes)
// router.use('/lead', leadRoutes)
// router.use('/public', publicRoutes)

// Universal Super Admin Routes
router.use('/products', productRegistryRoutes);
router.use('/universal-auth', universalAuthRoutes);

export default router;
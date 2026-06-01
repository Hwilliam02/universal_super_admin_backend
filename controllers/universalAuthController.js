import GlobalUser from '../models/GlobalUser.js';
import Company from '../models/Company.js';
import ProductRegistry from '../models/ProductRegistry.js';
import Visa from '../models/Visa.js';
import UniversalRefreshToken from '../models/UniversalRefreshToken.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { provisionUserInSatellite } from '../utils/dynamicDBConnector.js';
import { sendVerificationCodeEmail, sendVerificationLinkEmail } from '../utils/mailer.js';

const generateVerificationCode = () =>
  String(crypto.randomInt(0, 1000000)).padStart(6, '0');

const buildAppAccessToken = async ({ user, product_id }) => {
  const product = await ProductRegistry.findOne({ product_id });
  if (!product) {
    const err = new Error('Product not found');
    err.statusCode = 404;
    throw err;
  }

  let visa = await Visa.findOne({ global_user_id: user.global_user_id, product_id: product.product_id });
  
  if (!visa) {
    // If no visa exists, create a default 'User' visa
    visa = await Visa.create({
      global_user_id: user.global_user_id,
      product_id: product.product_id,
      role: 'User',
      status: 'Active'
    });
    console.log(`[Auto-Visa] Created new visa for ${user.email} on product ${product.name}`);
  } else if (visa.status !== 'Active') {
    // If a visa exists but is NOT active (e.g. Suspended), block access
    const err = new Error(`Your access to ${product.name} is ${visa.status.toLowerCase()}`);
    err.statusCode = 403;
    throw err;
  }

  try {
    await provisionUserInSatellite(product, user, visa.role);
  } catch (provError) {
    console.error(`Provisioning failed, but proceeding to issue token: ${provError.message}`);
  }

  const username = user.username || user.email;
  const payload = {
    global_user_id: user.global_user_id,
    global_company_id: user.global_company_id,
    email: user.email,
    username,
    visas: [
      { product: product.name, role: visa.role, status: visa.status }
    ],
    aud: product.name
  };

  const newAppAccessToken = jwt.sign(payload, product.app_private_key, {
    algorithm: 'RS256',
    expiresIn: '1h',
    issuer: 'Universal-Master'
  });

  return { accessToken: newAppAccessToken, product_name: product.name };
};

// Signup in the Master Platform (Passport Office)
const masterSignup = async (req, res) => {
  try {
    const { username, email, password, global_company_id, product_id } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email, and password are required' });
    }

    const existing = await GlobalUser.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Determine verification method from the product
    let product = null;
    let verificationMethod = 'none'; // default: no verification
    if (product_id) {
      product = await ProductRegistry.findOne({ product_id });
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
      verificationMethod = product.verification_method || 'none';
    }

    // Build user creation payload
    const userPayload = {
      username,
      email,
      password_hash: password, // The model hook will hash this
      global_company_id: global_company_id || null,
      status: verificationMethod === 'none' ? 'Active' : 'Pending',
    };

    // Set verification fields based on method
    if (verificationMethod === 'code') {
      userPayload.verification_code = generateVerificationCode();
    } else if (verificationMethod === 'link') {
      userPayload.verification_token = uuidv4();
      userPayload.verification_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    }

    const user = await GlobalUser.create(userPayload);

    // Create visa for the product
    if (product) {
      const existingVisa = await Visa.findOne({
        global_user_id: user.global_user_id,
        product_id: product.product_id
      });

      if (!existingVisa) {
        await Visa.create({
          global_user_id: user.global_user_id,
          product_id: product.product_id,
          role: 'User',
          status: 'Active'
        });
      }
    }

    // Send verification email
    if (verificationMethod === 'code') {
      try {
        await sendVerificationCodeEmail(user.email, userPayload.verification_code);
      } catch (emailError) {
        console.error('Verification code email failed:', emailError.message);
      }

      return res.status(201).json({
        status: 'verification_required',
        method: 'code',
        email: user.email,
        message: 'A verification code has been sent to your email',
      });
    }

    if (verificationMethod === 'link') {
      try {
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000/server1/api/v1';
        const verificationLink = `${backendUrl}/universal-auth/verify-link/${userPayload.verification_token}`;
        await sendVerificationLinkEmail(user.email, verificationLink);
      } catch (emailError) {
        console.error('Verification link email failed:', emailError.message);
      }

      return res.status(201).json({
        status: 'verification_required',
        method: 'link',
        email: user.email,
        message: 'A verification link has been sent to your email',
      });
    }

    // No verification needed — return user data immediately
    res.status(201).json({
      status: 'success',
      global_user_id: user.global_user_id,
      email: user.email,
      username: user.username,
      global_company_id: user.global_company_id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Login to the Master Platform (Passport Office)
const masterLogin = async (req, res) => {
  try {
    const { email, password, product_id } = req.body;
    
    const user = await GlobalUser.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });
    
    if (user.status === 'Suspended') return res.status(403).json({ error: 'User is suspended' });

    // Block Pending users — they must verify first
    if (user.status === 'Pending') {
      return res.status(200).json({
        status: 'verification_required',
        message: 'Please verify your email before logging in',
        email: user.email,
        method: user.verification_code ? 'code' : user.verification_token ? 'link' : 'unknown'
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    // --- COMPANY ADMIN VERIFICATION CHECK ---
    if (user.global_company_id) {
        const actualCompany = await Company.findOne({ 
            $or: [
                { global_company_id: user.global_company_id }, 
                { admin_global_user_id: user.global_user_id }
            ] 
        });

        if (actualCompany && actualCompany.status === 'inactive') {
            if (user.verification_code) {
                return res.status(200).json({
                    status: 'verification_required',
                    message: 'Verification required',
                    user: {
                        email: user.email,
                        username: user.username || user.email
                    }
                });
            }
            return res.status(403).json({ error: 'Account is inactive. Please contact support.' });
        }
    }

    // Fetch visas
    const visas = await Visa.find({ global_user_id: user.global_user_id, status: 'Active' });

    // Create Master Access Token (symmetric, just for the Master Portal frontend)
    const username = user.username || user.email;
    const accessToken = jwt.sign(
      {
        global_user_id: user.global_user_id,
        global_company_id: user.global_company_id,
        email: user.email,
        username
      },
      process.env.JWT_SECRET || 'master_secret',
      { expiresIn: '15m' }
    );

    // Generate Universal Refresh Token
    const refreshTokenString = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

    await UniversalRefreshToken.create({
      token: refreshTokenString,
      global_user_id: user.global_user_id,
      expiresAt,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    });

    const responseBody = {
      accessToken,
      refreshToken: refreshTokenString,
      user: {
        global_user_id: user.global_user_id,
        global_company_id: user.global_company_id,
        email: user.email,
        username,
        visas: visas
      }
    };

    if (product_id) {
      const appToken = await buildAppAccessToken({ user, product_id });
      responseBody.appAccessToken = appToken.accessToken;
      responseBody.product_name = appToken.product_name;
    }

    res.json(responseBody);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

// Generate App-Specific Token (RS256) via Universal Refresh Token
// Called by satellite apps (or frontend) when their short-lived access token expires
const refreshAppToken = async (req, res) => {
  try {
    const { refresh_token, product_id } = req.body; 

    if (!refresh_token || !product_id) {
      return res.status(400).json({ error: 'Refresh token and product_id are required' });
    }

    // 1. Verify Universal Refresh Token
    const activeRefreshToken = await UniversalRefreshToken.findOne({
      token: refresh_token,
      revoked: false,
      expiresAt: { $gt: new Date() }
    });

    if (!activeRefreshToken) {
      return res.status(401).json({ error: 'Invalid, expired, or revoked refresh token' });
    }

    const global_user_id = activeRefreshToken.global_user_id;

    // 2. Verify User
    const user = await GlobalUser.findOne({ global_user_id });
    if (!user || user.status === 'Suspended') {
      return res.status(403).json({ error: 'User suspended or not found' });
    }

    const appToken = await buildAppAccessToken({ user, product_id });

    res.json({ 
      accessToken: appToken.accessToken, 
      product_name: appToken.product_name
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};

const masterVerify = async (req, res) => {
  try {
    const { email, verification_code, new_password } = req.body;
    if (!email || !verification_code || !new_password) {
        return res.status(400).json({ error: 'email, verification_code, and new_password are required' });
    }

    const user = await GlobalUser.findOne({ email, verification_code });
    if (!user) {
        return res.status(400).json({ error: 'Invalid verification code or email' });
    }

    // 1. Update user: set password (pre-save hook hashes it) and clear code
    user.password_hash = new_password;
    user.verification_code = null;
    await user.save();

    // 2. Activate the company
    if (user.global_company_id) {
        await Company.findOneAndUpdate(
            { $or: [{ global_company_id: user.global_company_id }, { admin_global_user_id: user.global_user_id }] },
            { status: 'active' }
        );
    }

    // 3. Issue tokens directly (reuse logic or call masterLogin internally)
    // For simplicity, we'll manually call the token generation part or just ask user to login again.
    // Industry standard is often to issue tokens immediately.
    
    // Logic to issue tokens (duplicated from masterLogin for now, or could be refactored into a helper)
    const visas = await Visa.find({ global_user_id: user.global_user_id, status: 'Active' });
    const username = user.username || user.email;
    const accessToken = jwt.sign(
      {
        global_user_id: user.global_user_id,
        global_company_id: user.global_company_id,
        email: user.email,
        username
      },
      process.env.JWT_SECRET || 'master_secret',
      { expiresIn: '15m' }
    );

    const refreshTokenString = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await UniversalRefreshToken.create({
      token: refreshTokenString,
      global_user_id: user.global_user_id,
      expiresAt,
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    });

    res.json({
      message: 'Account verified and password updated successfully',
      accessToken,
      refreshToken: refreshTokenString,
      user: {
        global_user_id: user.global_user_id,
        global_company_id: user.global_company_id,
        email: user.email,
        username,
        visas
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Verify user registration via 6-digit code
const verifyUserCode = async (req, res) => {
  try {
    const { email, verification_code } = req.body;
    if (!email || !verification_code) {
      return res.status(400).json({ error: 'email and verification_code are required' });
    }

    const user = await GlobalUser.findOne({ email, verification_code, status: 'Pending' });
    if (!user) {
      return res.status(400).json({ error: 'Invalid verification code or email' });
    }

    // Activate user
    user.status = 'Active';
    user.verification_code = null;
    await user.save();

    res.json({
      status: 'success',
      message: 'Email verified successfully. You can now log in.',
      email: user.email,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Verify user registration via clickable link
const verifyUserLink = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).send('Invalid verification link');
    }

    const user = await GlobalUser.findOne({
      verification_token: token,
      status: 'Pending',
      verification_expires_at: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).send(`
        <html>
          <body style="font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f8fafc;">
            <div style="text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #ef4444;">Verification Failed</h2>
              <p style="color: #64748b;">This link is invalid or has expired. Please request a new verification email.</p>
            </div>
          </body>
        </html>
      `);
    }

    // Activate user
    user.status = 'Active';
    user.verification_token = null;
    user.verification_expires_at = null;
    await user.save();

    // Try to find which product this user has a visa for, to redirect to that frontend
    const visa = await Visa.findOne({ global_user_id: user.global_user_id, status: 'Active' });
    let redirectUrl = process.env.DEFAULT_FRONTEND_URL || 'http://localhost:5173/login';

    if (visa) {
      const product = await ProductRegistry.findOne({ product_id: visa.product_id });
      if (product && product.frontend_url) {
        redirectUrl = `${product.frontend_url}/login`;
      }
    }

    // Redirect to the product's login page with verified flag
    res.redirect(`${redirectUrl}?verified=true`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Resend verification code or link
const resendUserVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const user = await GlobalUser.findOne({ email, status: 'Pending' });
    if (!user) {
      return res.status(400).json({ error: 'No pending verification found for this email' });
    }

    // Determine verification method from the user's product visa
    const visa = await Visa.findOne({ global_user_id: user.global_user_id, status: 'Active' });
    let verificationMethod = 'code'; // default fallback

    if (visa) {
      const product = await ProductRegistry.findOne({ product_id: visa.product_id });
      if (product) {
        verificationMethod = product.verification_method || 'code';
      }
    }

    if (verificationMethod === 'code') {
      const newCode = generateVerificationCode();
      user.verification_code = newCode;
      user.verification_token = null;
      await user.save();

      try {
        await sendVerificationCodeEmail(user.email, newCode);
      } catch (emailError) {
        console.error('Resend code email failed:', emailError.message);
        return res.status(500).json({ error: 'Failed to send verification email' });
      }

      return res.json({
        status: 'success',
        method: 'code',
        message: 'Verification code resent successfully',
      });
    }

    if (verificationMethod === 'link') {
      const newToken = uuidv4();
      user.verification_token = newToken;
      user.verification_code = null;
      user.verification_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await user.save();

      try {
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:4000/server1/api/v1';
        const verificationLink = `${backendUrl}/universal-auth/verify-link/${newToken}`;
        await sendVerificationLinkEmail(user.email, verificationLink);
      } catch (emailError) {
        console.error('Resend link email failed:', emailError.message);
        return res.status(500).json({ error: 'Failed to send verification email' });
      }

      return res.json({
        status: 'success',
        method: 'link',
        message: 'Verification link resent successfully',
      });
    }

    res.status(400).json({ error: 'Unable to determine verification method' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export {
  masterLogin,
  masterSignup,
  masterVerify,
  refreshAppToken,
  verifyUserCode,
  verifyUserLink,
  resendUserVerification
};

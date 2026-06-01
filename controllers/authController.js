import User from '../models/User.js';
import apiResponse from '../utils/apiResponse.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Company from '../models/Company.js';
import transporter from '../utils/mailer.js';
import crypto from 'crypto';
import { promisify  } from 'util';
import UserCompanyMembership from '../models/UserCompanyMembership.js';
import RefreshToken from '../models/RefreshTokens.js';


const createSendToken = async (user, statusCode, req, res, additionalData = {}, rememberMe = false) => {
  
  // Cookie options
const expiresIn = rememberMe ? process.env.REMEMBER_ME_JWT_EXPIRES_IN : process.env.JWT_EXPIRES_IN;
  const cookieMaxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
;
  const token = jwt.sign(
    {
      id: user._id,
      role: user.role, // roles from memberships
      companyId: user.companyId // active companyId from memberships
    },
    process.env.JWT_SECRET,
    { expiresIn }
  );

  // Set token as an HTTP-only cookie
  res.cookie("accessToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', 
    maxAge: cookieMaxAge,
    sameSite: "Lax", // Try "Lax" first, as discussed
    path: "/",
  });

  // Generate and store refresh token
  const refreshTokenString = crypto.randomBytes(40).toString('hex');
  const refreshExpiresInDays = rememberMe ? 30 : 7;
  const refreshExpiresAt = new Date(Date.now() + refreshExpiresInDays * 24 * 60 * 60 * 1000);
  const tokenHash = crypto.createHash('sha256').update(refreshTokenString).digest('hex');

  await RefreshToken.create({
    user_id: user._id,
    token_hash: tokenHash,
    device_info: req.headers['user-agent'] || 'unknown',
    expires_at: refreshExpiresAt
  });

  res.cookie("refreshToken", refreshTokenString, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: refreshExpiresAt.getTime() - Date.now(),
    sameSite: "Lax",
    path: "/",
  });

  // Convert mongoose doc to plain object so dynamically added fields (role, first_name) are kept
  const userObj = user.toObject ? user.toObject() : { ...user };
  
  // Re-attach dynamic properties that might not have been copied if user.toObject() stripped them out
  userObj.role = user.role;
  userObj.first_name = user.first_name;
  userObj.last_name = user.last_name;
  userObj.companyId = user.companyId;

  // Remove password from output
  userObj.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token, // (Optional: You can remove this if you want to rely only on cookies)
    data: {
      user: userObj,
      ...additionalData
    }
  });
};

const sendVerificationEmail = (email, code) => {
  const mailOptions = {
    from: 'naxapedev@gmail.com', // Replace with your email
    to: email,
    subject: 'Verify Your Account',
    html: `<!DOCTYPE html>
<html>
  <head>
    <title>Email Verification</title>
  </head>
  <body
    style="
      font-family: Arial, sans-serif;
      background-color: #f9fafb;
      padding: 20px 0px;
      margin: 0;
    "
  >
    <!-- Email Container -->
    <div
      style="
        max-width: 600px;
        margin: 20px auto;
        background: white;
        padding: 40px 20px;
        border-radius: 8px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        text-align: center;
      "
    >
      <!-- Logo -->
      <div
        style="
        display: flex;
        align-items: center;
        justify-content: center;
        padding-bottom: 30px;
        " 
      >
      <img 
        src="https://app.purifyx.ai/Logo.svg" 
        alt="PurifyX Logo" 
        width="131" 
        height="37" 
        style="display: block;"
      />
</div>

      <!-- Main Content -->
      <h2
        style="
          color: #333;
          font-size: 32px;
          font-weight: 500;
          margin: 0 0 20px 0;
          font-family: Arial, sans-serif;
        "
      >
        You're almost there!
      </h2>

      <p
        style="
          font-size: 16px;
          color: #666;
          font-weight: 400;
          margin: 0 0 30px 0;
          font-family: Arial, sans-serif;
        "
      >
        Here is your verification code
      </p>

      <!-- Verification Code -->
      <div
        style="
          background-color: #f5f5f5;
          padding: 20px;
          border-radius: 8px;
          margin: 30px 0;
          display: inline-block;
        "
      >
        <span
          style="
            font-size: 18px;
            font-weight: 600;
            color: #333;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
          "
        >
          ${code}
        </span>
      </div>

      <!-- Terms Notice -->
      <p
        style="
          font-size: 12px;
          color: #999;
          line-height: 1.6;
          margin: 30px 0 0 0;
          font-family: Arial, sans-serif;
        "
      >
        Please note that by completing your sign-up you are agreeing to our
        <a
          href="#"
          style="color: #333; text-decoration: underline;"
        >
          Terms of Service
        </a>
        and
        <a
          href="#"
          style="color: #333; text-decoration: underline;"
        >
          Privacy Policy
        </a>
      </p>
      <p 
      style="
          font-size: 12px;
          color: #666;
          line-height: 1.6;
          margin: 10px 0 0 0;
          font-family: Arial, sans-serif;
        "
      >@ 2025 PurifyX</p>
    </div>
  </body>
</html>
`
  };
  console.log('mailOptions:', mailOptions);
  return transporter.sendMail(mailOptions);
};

const login = async (req, res) => {
   try {
      const { email, password} = req.body;
  
    // 1) Check if email and password exist
    if (!email || !password) {
      return apiResponse(res, 400, false, 'Please provide email and password!');
    }
  
    // 2) Check if user exists
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return apiResponse(res, 400, false, 'Incorrect email, please try with a different email!');
    }

    // 2.1) Fetch memberships to get roles
    const memberships = await UserCompanyMembership.find({ user_id: user._id, is_deleted: false });
    const allRoles = [...new Set(memberships.flatMap(m => m.role))];
    
    // Attach roles and memberships to user object temporarily for createSendToken
    user.role = allRoles;
    user.memberships = memberships;

     if (!allRoles.includes('superadmin') && !allRoles.includes('lead') && !allRoles.includes('dev') && !allRoles.includes('developer')) {
       return apiResponse(res, 400, false, 'Only authorized users can login this portal!');
    }
  
    if (!user) {
      return apiResponse(res, 400, false, 'No user with this email exists!');
    };
    
    if(user.status==='suspended'){
      return apiResponse(res, 404, false, 'this user has been suspended, please contact support');
    }
  
    // Debugging logs
    
  
    // 3) Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    console.log('Password match result:', isMatch);
  
    if (!isMatch) {
      return apiResponse(res, 400, false, 'Invalid password!');
    };

    
if(user.role.includes('superadmin') && !user.role.includes('lead')){
  const now = Date.now();
    const oneWeek = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
    const lastVerifiedAt = user.lastVerifiedAt ? new Date(user.lastVerifiedAt).getTime() : 0;
    const sevenDaysPassed = now - lastVerifiedAt > oneWeek;
    if (sevenDaysPassed) {
      // Mark user as unverified
      user.isVerified = false;

      // Generate new verification code
      const verificationCode = crypto.randomInt(100000, 999999);
      user.verificationCode = verificationCode;
      user.verificationCodeExpiresAt = now + 24 * 60 * 60 * 1000; // 24 hrs validity
      console.log('generated verificationCode:', verificationCode); // yahan bhi laga sakta hai

      await user.save();

      // Send verification email
      console.log(user.email)
      sendVerificationEmail(user.email, verificationCode);

      // Temporary JWT token for verification
      const token = jwt.sign({ email: user.email }, process.env.JWT_SECRET, {
        expiresIn: '15m',
      });

      return apiResponse(
        res,
        400,
        false,
        'Your verification has expired. A new code has been sent to your email. Please verify again to continue.',
        
      );
    }

    // 5) If user is not verified (fresh or pending), block login
    if (!user.isVerified) {
      return apiResponse(
        res,
        400,
        false,
        'Please verify your email to continue. Check your inbox for the verification code.'
      );
    }

    // 6) Update login timestamp
    user.lastLoggedIn = new Date();
    await user.save({ validateBeforeSave: false });
  }

  let metaData = {};
  const isAdmin = allRoles.includes("admin");
  if (isAdmin) {
    // Find a membership with admin role to get company details
    const adminMembership = memberships.find((m) => m.role.includes("admin"));
    if (adminMembership && adminMembership.company_id) {
      const companyId = adminMembership.company_id;
      user.companyId = companyId; // For createSendToken context
      const company = await Company.findById(companyId).select("domain dbUri");
      if (company) {
        metaData = {
          company: {
            domain: company.domain,
            dbUri: company.dbUri,
          },
        };
      }
    }
  }

  // Attach first_name and last_name from membership (for all users including lead)
  const primaryMembership = memberships[0];
  if (primaryMembership) {
    user.first_name = primaryMembership.first_name;
    user.last_name = primaryMembership.last_name;
  }

  // 4) If everything ok, send token to client
  await createSendToken(user, 200, req, res, metaData);
} catch (error) {
     console.log('Login error:', error);
    }
};

const setCompanyEmailAndPassword = async (req, res) => {
  try {
    const { id } = req.params; // user ID from URL
    const { oldPassword, newPassword } = req.body;

    // 🧩 Step 1: Validate input
    if (!oldPassword || !newPassword) {
      return apiResponse(res, 400, false, "Both old and new passwords are required!");
    }

    // 🧩 Step 2: Find user by ID
    const user = await User.findById(id).select("+password +companyId");
    if (!user) {
      return apiResponse(res, 404, false, "User not found!");
    }

    // 🧩 Step 3: Compare old password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return apiResponse(res, 400, false, "Invalid old password!");
    }

    // 🧩 Step 5: Update user password and status
    user.password = newPassword;
    user.status = "active";
    await user.save();

    // 🧩 Step 6: Update company status to active
    if (user.companyId) {
      await Company.findByIdAndUpdate(
        user.companyId,
        { status: "active" },
        { new: true }
      );
    }

    // 🧩 Step 7: Respond with success
    return apiResponse(res, 200, true, "Password updated and account activated successfully!", {
      userId: user._id,
      companyStatus: "active"
    });

  } catch (error) {
    console.error("Error updating company password:", error);
    return apiResponse(res, 500, false, "Server error while updating password", {
      error: error.message
    });
  }
};

const changeCompanyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { role } = req.user;

    // Role check (handles both array and string format)
    const isSuperAdmin = Array.isArray(role) ? role.includes('superadmin') : role === 'superadmin';
    if (!isSuperAdmin) {
      return apiResponse(res, 401, false, 'Only super admin has this access!', null);
    }

    // 1️⃣ Find and update Company
    const company = await Company.findById(id);
    if (!company) {
      return apiResponse(res, 404, false, 'Company not found', null);
    }
    company.status = status || 'inactive';
    await company.save();

    // 2️⃣ Find and update company's membership records
    await UserCompanyMembership.updateMany(
      { company_id: id },
      { status: status || 'inactive', is_active: status === 'active' }
    );

    // 3️⃣ Find and update company's admin user(s) status (legacy support if needed)
    await User.updateMany(
      { company_id: id }, // This might match old records
      { status: status || 'inactive', is_active: status === 'active' }
    );

    return apiResponse(res, 200, true, 'Company and user status updated successfully', company);
  } catch (error) {
    console.error('Error updating company status:', error);
    return apiResponse(res, 500, false, 'Internal Server Error', null);
  }
};
const verifySuperAdmin = async (req, res) => {
  const {  email, code } = req.body;
  

  const user = await User.findOne({ email });
  if (!user) return apiResponse(res, 400, false, 'User not found');

  // Fetch memberships for verify
  const memberships = await UserCompanyMembership.find({ user_id: user._id, is_deleted: false });
  const allRoles = [...new Set(memberships.flatMap(m => m.role))];
  user.role = allRoles;

  // Only super admin can verify
  if (!allRoles.includes('superadmin')) {
    return apiResponse(res, 403, false, 'Access denied. Only super admin can verify.');
  }

  if (user.verificationCode !== parseInt(code))
    return apiResponse(res, 400, false, 'Invalid verification code');

  if (Date.now() > user.verificationCodeExpiresAt)
    return apiResponse(res, 400, false, 'Verification code expired');

  user.isVerified = true;
  user.lastVerifiedAt = new Date(); // reset 7-day timer
  user.verificationCode = null;
  user.verificationCodeExpiresAt = null;
  await user.save();
  return await createSendToken(user, 200, req, res);
};

const logout = async (req, res) => {
  // Try to revoke the refresh token if client sent it
  const { refreshToken } = req.cookies;
  if (refreshToken) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await RefreshToken.findOneAndUpdate({ token_hash: tokenHash }, { is_revoked: true, revoked_at: new Date() });
  }

  // Clear both cookies
  res.clearCookie('accessToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  res.status(200).json({ success: true, message: "Logged out successfully." });
};

const completeCompanyRegistration = async (req, res) => {
  try {
    const { token } = req.params;
    const { email, password } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: "Token missing" });
    }

    // Decode token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.userId) {
      return res.status(400).json({ success: false, message: "Invalid token" });
    }

    // Find the user in MongoDB
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
 

    // Update user details
    user.email = email;
    user.password = password;
    user.status = "active";

    await user.save();

    // Update membership
    const membership = await UserCompanyMembership.findOne({ user_id: user._id });
    if (membership) {
      membership.status = "active";
      membership.is_active = true;
      await membership.save();

      // Update company
      await Company.findByIdAndUpdate(
        membership.company_id,
        { status: "active" },
        { new: true }
      );
    } else if (user.company_id) {
      // Fallback for legacy data
      await Company.findByIdAndUpdate(
        user.company_id,
        { status: "active" },
        { new: true }
      );
    }
    return await createSendToken(user, 200, req, res);
    
  } catch (error) {
    console.error("Error in completeCompanyRegistration:", error);

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token expired" });
    }

    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const refreshSession = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;
    
    if (!refreshToken) {
      return apiResponse(res, 401, false, "No refresh token provided.");
    }

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const existingToken = await RefreshToken.findOne({ token_hash: tokenHash });

    if (!existingToken || existingToken.is_revoked || Date.now() > new Date(existingToken.expires_at).getTime()) {
      return apiResponse(res, 401, false, "Invalid or expired refresh token.");
    }

    const user = await User.findById(existingToken.user_id).select('+password');
    if (!user || user.status === 'suspended') {
      return apiResponse(res, 403, false, "User not found or suspended.");
    }

    // Refresh roles/memberships context
    const memberships = await UserCompanyMembership.find({ user_id: user._id, is_deleted: false });
    const allRoles = [...new Set(memberships.flatMap(m => m.role))];
    user.role = allRoles;
    user.memberships = memberships;

    let metaData = {};
    const isAdmin = allRoles.includes("admin");
    if (isAdmin) {
      const adminMembership = memberships.find((m) => m.role.includes("admin"));
      if (adminMembership && adminMembership.company_id) {
        const companyId = adminMembership.company_id;
        user.companyId = companyId;
        const company = await Company.findById(companyId).select("domain dbUri");
        if (company) metaData = { company: { domain: company.domain, dbUri: company.dbUri } };
      }
    }

    const primaryMembership = memberships[0];
    if (primaryMembership) {
      user.first_name = primaryMembership.first_name;
      user.last_name = primaryMembership.last_name;
    }

    // Revoke the old token (Token rotation for security)
    existingToken.is_revoked = true;
    existingToken.revoked_at = new Date();
    await existingToken.save();

    // Reissue tokens
    await createSendToken(user, 200, req, res, metaData, true);
  } catch (error) {
    console.error("Error refreshing session:", error);
    return apiResponse(res, 500, false, "Server error during token refresh.");
  }
};

export { login, setCompanyEmailAndPassword, changeCompanyStatus, completeCompanyRegistration, verifySuperAdmin, logout, refreshSession };
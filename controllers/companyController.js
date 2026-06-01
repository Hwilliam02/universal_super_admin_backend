import Company from '../models/Company.js';
import User from '../models/User.js';
import apiResponse from '../utils/apiResponse.js';
import path from 'path';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import FormData from 'form-data';
import UserCompanyMembership from '../models/UserCompanyMembership.js';
import GlobalUser from '../models/GlobalUser.js';
import Visa from '../models/Visa.js';
import transporter from '../utils/mailer.js';

function splitFullName(fullName = "") {
  const trimmed = (fullName || "").trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const parts = trimmed.split(" ");
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  const firstName = parts[0];
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

const generateVerificationCode = () =>
  String(crypto.randomInt(0, 1000000)).padStart(6, "0");

const sendCompanyAdminVerificationEmail = (email, code) => {
  const mailOptions = {
    from: process.env.MAIL_USER || "no-reply@universal-admin",
    to: email,
    subject: "Company Admin Verification Code",
    text: `Your verification code is: ${code}`,
  };

  return transporter.sendMail(mailOptions);
};




// Helper function to check company name availability
const checkCompanyExists = async (company_name = null) => {
  if (!company_name) return { companyExists: false, userExists: false, available: true };

  // Normalize name (remove extra spaces, lowercase)
  const normalizedName = company_name.trim().replace(/\s+/g, ' ').toLowerCase();

  // Note: first_name/last_name/company_name were removed from global User
  // We primarily check Company model now.
  const existenceCheck = await Company.findOne({
    name: { $regex: new RegExp(`^${normalizedName}$`, 'i') }
  });

  return {
    companyExists: !!existenceCheck,
    userExists: false, // Legacy field removed from User
    available: !existenceCheck
  };
};



const createCompany = async (req, res, next) => {
  console.log(req.body)
  let createdCompany = null;
  let createdGlobalUser = null;
  let createdVisa = null;
  let didCreateGlobalUser = false;
  const superAdminEmail = req.user?.email;

  try {
    const {
      company_name,
      contactPerson,
      companyEmail,
    } = req.body;

    if (!company_name || !companyEmail) {
      return apiResponse(res, 400, false, "Missing required fields");
    }

    const companyPortalProductId = process.env.COMPANY_PORTAL_PRODUCT_ID;
    if (!companyPortalProductId) {
      return apiResponse(
        res,
        500,
        false,
        "COMPANY_PORTAL_PRODUCT_ID is not configured"
      );
    }
   
    

    // 1: Check existence
    const existenceCheck = await checkCompanyExists(company_name);
    if (!existenceCheck.available) {
      return apiResponse(res, 400, false, "Company already exists");
    }

    const adminFullName = (contactPerson && contactPerson.name)
      ? contactPerson.name
      : company_name;

    const { firstName: adminFirstName, lastName: adminLastName } = splitFullName(adminFullName);
    const normalizedEmail = companyEmail.toLowerCase();

    // -------------------------------------
    // 2: CREATE COMPANY IN MONGODB
    // -------------------------------------
    createdCompany = await Company.create({
      name: company_name,
      db_uri: null,
      dbName: null,
      productIds: [],
      createdBy: req.user.id,
      admin_email: normalizedEmail,
      admin_first_name: adminFirstName,
      admin_last_name: adminLastName,
    });

    const verificationCode = generateVerificationCode();
    const defaultPassword = "ADMIN01";

    let globalUser = await GlobalUser.findOne({ email: normalizedEmail });
    if (!globalUser) {
      globalUser = await GlobalUser.create({
        email: normalizedEmail,
        password_hash: defaultPassword,
        status: 'Active',
        global_company_id: String(createdCompany._id),
        verification_code: verificationCode,
      });
      didCreateGlobalUser = true;
    } else {
      globalUser.verification_code = verificationCode;
      if (!globalUser.global_company_id) {
        globalUser.global_company_id = String(createdCompany._id);
      }
      await globalUser.save();
    }

    createdGlobalUser = globalUser;

    createdCompany = await Company.findByIdAndUpdate(
      createdCompany._id,
      {
        admin_global_user_id: globalUser.global_user_id,
        admin_email: normalizedEmail,
        admin_first_name: adminFirstName,
        admin_last_name: adminLastName,
      },
      { new: true }
    );

    const visaRole = process.env.COMPANY_PORTAL_VISA_ROLE || "Admin";
    const existingVisa = await Visa.findOne({
      global_user_id: globalUser.global_user_id,
      product_id: companyPortalProductId,
    });

    if (!existingVisa) {
      createdVisa = await Visa.create({
        global_user_id: globalUser.global_user_id,
        product_id: companyPortalProductId,
        role: visaRole,
        status: "Active",
      });
    }

    // -------------------------------------
    // 5: UPLOAD LOGO TO FILE-SERVER (if provided)
    // -------------------------------------
    let logoUrl = null;
    if (req.file) {
      try {
        const formData = new FormData();
        formData.append('file', req.file.buffer, {
          filename: `logo_${createdCompany._id}${path.extname(req.file.originalname)}`,
          contentType: req.file.mimetype
        });
        formData.append('folderPath', `logos/${createdCompany._id}`);

        const fileServerUrl = process.env.FILE_SERVER_URL || 'http://localhost:5001';
        const fileServerAuthToken = process.env.FILE_SERVER_AUTH_TOKEN;
        
        const uploadResponse = await axios.post(`${fileServerUrl}/upload`, formData, {
          headers: {
            ...formData.getHeaders(),
            'Authorization': `Bearer ${fileServerAuthToken}`
          }
        });

        if (uploadResponse.data.success) {
          logoUrl = uploadResponse.data.url;
          
          // Update company with logo URL
          await Company.findByIdAndUpdate(createdCompany._id, {
            logoUrl: logoUrl
          });
          
          console.log(`✅ Logo uploaded successfully: ${logoUrl}`);
        }
      } catch (logoError) {
        console.error('⚠️  Logo upload failed (non-critical):', logoError.message);
        // Don't fail company creation if logo upload fails
      }
    }


    try {
      await sendCompanyAdminVerificationEmail(globalUser.email, verificationCode);
    } catch (emailError) {
      console.error("Verification email failed:", emailError.message);
    }


    // SUCCESS RESPONSE
    return apiResponse(
      res,
      201,
      true,
      "Company created successfully",
      {
        company: {
          id: createdCompany._id,
          name: createdCompany.name,
          dbUri: createdCompany.db_uri || null,
          productIds: createdCompany.productIds || [],
          logoUrl: logoUrl
        },
        admin: {
          email: globalUser.email,
          global_user_id: globalUser.global_user_id,
        },
        superadmin: superAdminEmail,
      }
    );

  }catch (error) {
  console.error("🔥 ERROR:", error);

  if (createdVisa) {
    await Visa.findByIdAndDelete(createdVisa._id);
  }

  if (didCreateGlobalUser && createdGlobalUser) {
    await GlobalUser.findByIdAndDelete(createdGlobalUser._id);
  }

  if (createdCompany) {
    await Company.findByIdAndDelete(createdCompany._id);
  }

  // FINAL — pass error to global error handler
  return next(error);
}

};

const softDeleteCompany = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return apiResponse(res, 400, false, 'Company ID is required', null);
    }

    const company = await Company.findById(id);
    if (!company) {
      return apiResponse(res, 404, false, 'Company not found', null);
    }

    // Soft delete by updating the status
    company.status = 'deleted';
    company.deletedAt = new Date();
    company.deletedBy = req.user.id;
    await company.save();

    return apiResponse(res, 200, true, 'Company soft-deleted successfully', {
      id: company._id,
      name: company.name,
      status: company.status
    });
  } catch (error) {
    console.error('Error soft-deleting company:', error);
    return apiResponse(res, 500, false, 'Internal Server Error', { error: error.message });
  }
};

const undeleteCompany = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return apiResponse(res, 400, false, 'Company ID is required', null);
    }

    const company = await Company.findById(id);
    if (!company) {
      return apiResponse(res, 404, false, 'Company not found', null);
    }

    if (company.status !== 'deleted') {
      return apiResponse(res, 400, false, 'Company is not deleted', null);
    }

    // Restore the company
    company.status = 'inactive';
    company.deletedAt = null;
    company.deletedBy = null;
    await company.save();

    return apiResponse(res, 200, true, 'Company restored successfully', {
      id: company._id,
      name: company.name,
      status: company.status
    });
  } catch (error) {
    console.error('Error restoring company:', error);
    return apiResponse(res, 500, false, 'Internal Server Error', { error: error.message });
  }
};

// const updateCompanySuppliesStatus = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { is_supplies_enabled } = req.body;

//     if (!id) {
//       return apiResponse(res, 400, false, 'Company ID is required', null);
//     }

//     if (typeof is_supplies_enabled !== 'boolean') {
//       return apiResponse(res, 400, false, 'is_supplies_enabled must be a boolean', null);
//     }

//     const isSuperAdmin = Array.isArray(req.user?.role)
//       ? req.user.role.includes('superadmin')
//       : req.user?.role === 'superadmin';

//     if (!isSuperAdmin) {
//       return apiResponse(res, 403, false, 'You do not have permission to update supplies settings', null);
//     }

//     const company = await Company.findById(id);
//     if (!company) {
//       return apiResponse(res, 404, false, 'Company not found', null);
//     }

//     company.is_supplies_enabled = is_supplies_enabled;
//     await company.save();

//     return apiResponse(res, 200, true, `Supplies ${is_supplies_enabled ? 'enabled' : 'disabled'} successfully`, {
//       id: company._id,
//       name: company.name,
//       is_supplies_enabled: company.is_supplies_enabled,
//     });
//   } catch (error) {
//     console.error('Error updating company supplies status:', error);
//     return apiResponse(res, 500, false, 'Internal Server Error', { error: error.message });
//   }
// };

const updateCompanyFeatures = async (req, res) => {
  try {
    const { id } = req.params;
    const { feature, value } = req.body;

    if (!id || !feature || typeof value !== "boolean") {
      return apiResponse(
        res,
        400,
        false,
        "Missing required fields or invalid value"
      );
    }

    const isSuperAdmin = Array.isArray(req.user?.role)
      ? req.user.role.includes("superadmin")
      : req.user?.role === "superadmin";

    if (!isSuperAdmin) {
      return apiResponse(res, 403, false, "Permission denied");
    }

    const result = await Company.updateOne(
      { _id: id },
      { $set: { [`enabled_features.${feature}`]: value } }
    );

    if (result.matchedCount === 0) {
      return apiResponse(res, 404, false, "Company not found");
    }

    return apiResponse(
      res,
      200,
      true,
      `Feature '${feature}' updated successfully`
    );
  } catch (error) {
    console.error("Error updating company features:", error);
    return apiResponse(res, 500, false, "Internal Server Error", {
      error: error.message,
    });
  }
};

const checkCompanyNameAvailability = async (req, res) => {
  try {
    let { company_name } = req.query;

    if (!company_name) {
      return apiResponse(res, 400, false, "Company name is required");
    }

    // Normalize user input
    const cleanName = company_name.trim().toLowerCase();

    // Check if company exists (normalized)
    const existenceCheck = await checkCompanyExists(cleanName);

    return apiResponse(
      res,
      200,
      true,
      existenceCheck.available
        ? "Company name is available"
        : "Company name already exists",
      {
        available: existenceCheck.available,
        company_name: cleanName
      }
    );

  } catch (error) {
    console.error('Error checking company name availability:', error);
    return apiResponse(res, 500, false, 'Internal Server Error', null);
  }
};

const superAdminAccess = async (req, res) => {
  const {adminId} = req.params;
  const companyId = req.body?.companyId || req.query?.companyId;
  
  // Find membership for this user to get company context
  const query = { user_id: adminId };
  if (companyId) {
    query.company_id = companyId;
  }
  
  const membership = await UserCompanyMembership.findOne(query).lean();
  if (!membership) {
    return apiResponse(res, 404, false, "Membership not found for this admin");
  }

  const payload = {
    _id: req.user.id,
    user_id: 1,
    role: req.user.role,
    company_id: membership.company_id


  }
 const createToken = jwt.sign(
  payload,
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN }
);
const isProd = process.env.NODE_ENV === "production";

console.log("[superAdminAccess] adminId:", adminId);
console.log("[superAdminAccess] req.user.id:", req.user?.id);
console.log("[superAdminAccess] membership.company_id:", membership?.company_id);
console.log("[superAdminAccess] protocol/host/origin:", req.protocol, req.get("host"), req.get("origin"));
console.log("[superAdminAccess] JWT payload:", payload);

    res.cookie(`tenant_session_${adminId}`, createToken, {
  httpOnly: true,
   secure: isProd ? true : false,      // false in dev on HTTP
  sameSite: "lax",
  maxAge: 24 * 60 * 60 * 1000, // 1 day
});
console.log("[superAdminAccess] tenant_session cookie sent");
res.send("cookie set")
};

const resendCompanyRegistrationRequest = async (req, res) =>{
  try {
    const { id } = req.params;
    let legacyUser = null;
    let globalUser = await GlobalUser.findOne({ global_user_id: id });
    if (!globalUser) {
      legacyUser = await User.findById(id).lean();
      if (legacyUser?.user_id) {
        globalUser = await GlobalUser.findOne({ global_user_id: legacyUser.user_id });
      }
      if (!globalUser && legacyUser?.email) {
        globalUser = await GlobalUser.findOne({ email: legacyUser.email });
      }
    }

    if (!globalUser) {
      return apiResponse(res, 404, false, "User not found", null);
    }

    const verificationCode = generateVerificationCode();
    globalUser.verification_code = verificationCode;
    await globalUser.save();

    try {
      await sendCompanyAdminVerificationEmail(globalUser.email, verificationCode);
    } catch (emailError) {
      console.error("Verification email failed:", emailError.message);
      return apiResponse(res, 500, false, "Failed to send verification email", null);
    }

    const company = await Company.findOne({ admin_global_user_id: globalUser.global_user_id });
    if (company) {
      await Company.findByIdAndUpdate(company._id, { status: "inactive" });
    } else if (legacyUser?._id) {
      const membership = await UserCompanyMembership.findOne({ user_id: legacyUser._id }).lean();
      if (membership?.company_id) {
        await Company.findByIdAndUpdate(membership.company_id, { status: "inactive" });
      }
    }

    return apiResponse(
      res,
      200,
      true,
      "Verification email sent successfully",
      null
    );
  } catch (error) {
    console.error(error);
    return apiResponse(res, 500, false, "Internal Server Error", null);
  }
}


const updateCompanyLimits = async (req, res) => {
  try {
    const { id } = req.params;
    const { limits } = req.body;

    if (!id || !limits || typeof limits !== "object") {
      return apiResponse(
        res,
        400,
        false,
        "Missing required fields or invalid limits object"
      );
    }

    const isSuperAdmin = Array.isArray(req.user?.role)
      ? req.user.role.includes("superadmin")
      : req.user?.role === "superadmin";

    if (!isSuperAdmin) {
      return apiResponse(res, 403, false, "Permission denied");
    }

    // Build update object for capacity_limits
    const updatePayload = {};
    for (const [key, value] of Object.entries(limits)) {
      updatePayload[`capacity_limits.${key}`] = Number(value);
    }

    const result = await Company.updateOne(
      { _id: id },
      { $set: updatePayload }
    );

    if (result.matchedCount === 0) {
      return apiResponse(res, 404, false, "Company not found");
    }

    return apiResponse(
      res,
      200,
      true,
      "Company limits updated successfully"
    );
  } catch (error) {
    console.error("Error updating company limits:", error);
    return apiResponse(res, 500, false, "Internal Server Error", {
      error: error.message,
    });
  }
};

export { createCompany, checkCompanyNameAvailability, softDeleteCompany, undeleteCompany, updateCompanyFeatures, updateCompanyLimits, superAdminAccess, resendCompanyRegistrationRequest  };









  
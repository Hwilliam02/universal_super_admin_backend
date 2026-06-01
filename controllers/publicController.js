import TrialSignup from '../models/TrialSignup.js';
import Company from '../models/Company.js';
import User from '../models/User.js';
import UserCompanyMembership from '../models/UserCompanyMembership.js';
import apiResponse from '../utils/apiResponse.js';
import jwt from 'jsonwebtoken';
import { promisify  } from 'util';
import mysql from 'mysql2/promise';
import pool from '../config/sql.js';

import { sendTrialSignupEmail  } from '../templates/trialSignupEmail.js';
import { generateUUIDv7  } from '../utils/utils.js';

// ─────────────────────────────────────────────────────────────
// Helper: Check if company name is already taken
// ─────────────────────────────────────────────────────────────
const checkCompanyExists = async (company_name) => {
  if (!company_name) return { available: true };
  const normalizedName = company_name.trim().replace(/\s+/g, " ").toLowerCase();
  const existingCompany = await Company.findOne({
    name: { $regex: new RegExp(`^${normalizedName}$`, "i") },
  });
  return { available: !existingCompany };
};

// ─────────────────────────────────────────────────────────────
// Helper: Split full name into first/last
// ─────────────────────────────────────────────────────────────
function splitFullName(fullName = "") {
  const trimmed = (fullName || "").trim().replace(/\s+/g, " ");
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(" ");
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

// ═════════════════════════════════════════════════════════════
// 1. PUBLIC SIGNUP — Step 1 (Save temp data + send email)
//    POST /public/signup
// ═════════════════════════════════════════════════════════════
const publicSignup = async (req, res) => {
  try {
    const { company_name, companyEmail, admin_name } = req.body;

    // ── Validations ──────────────────────────────
    if (!company_name || !companyEmail) {
      return apiResponse(res, 400, false, "Company name and email are required");
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(companyEmail)) {
      return apiResponse(res, 400, false, "Invalid email format");
    }

    // Check company name availability
    const { available } = await checkCompanyExists(company_name);
    if (!available) {
      return apiResponse(res, 400, false, "Company name already exists");
    }

    // Check if there's a pending signup with same email
    const existingPending = await TrialSignup.findOne({
      email: companyEmail.toLowerCase(),
      status: "pending",
    });
    if (existingPending) {
      return apiResponse(
        res,
        400,
        false,
        "A registration link has already been sent to this email. Please check your inbox or try again later."
      );
    }

    // ── Create temp TrialSignup record ────────────
    const trialSignup = await TrialSignup.create({
      company_name: company_name.trim(),
      email: companyEmail.toLowerCase().trim(),
      admin_name: (admin_name || "").trim(),
    });

    // ── Generate JWT with type claim ─────────────
    const token = jwt.sign(
      {
        trialId: trialSignup._id,
        type: "trial_signup", // Security guard
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // ── Send email ───────────────────────────────
    await sendTrialSignupEmail(companyEmail, token, company_name);

    return apiResponse(res, 201, true, "Registration link sent to your email. Please check your inbox.", {
      email: companyEmail,
    });
  } catch (error) {
    console.error("🔥 Public Signup Error:", error);
    return apiResponse(res, 500, false, "Internal Server Error", {
      error: error.message,
    });
  }
};

// ═════════════════════════════════════════════════════════════
// 2. VERIFY TRIAL TOKEN — Pre-fill data for Step 2
//    GET /public/verify-trial/:token
// ═════════════════════════════════════════════════════════════
const verifyTrialToken = async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return apiResponse(res, 400, false, "Token is required");
    }

    // Verify JWT
    let decoded;
    try {
      decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return apiResponse(res, 401, false, "Registration link has expired. Please request a new one.");
      }
      return apiResponse(res, 400, false, "Invalid registration link");
    }

    // Check type claim
    if (decoded.type !== "trial_signup") {
      return apiResponse(res, 400, false, "Invalid token type");
    }

    // Find the TrialSignup record
    const trialSignup = await TrialSignup.findById(decoded.trialId);
    if (!trialSignup) {
      return apiResponse(res, 404, false, "Registration request not found or expired");
    }

    if (trialSignup.status === "completed") {
      return apiResponse(res, 400, false, "This registration has already been completed");
    }

    return apiResponse(res, 200, true, "Token verified", {
      email: trialSignup.email,
      company_name: trialSignup.company_name,
      admin_name: trialSignup.admin_name,
      delivery_type: trialSignup.delivery_type,
    });
  } catch (error) {
    console.error("🔥 Verify Trial Token Error:", error);
    return apiResponse(res, 500, false, "Internal Server Error", {
      error: error.message,
    });
  }
};

// ═════════════════════════════════════════════════════════════
// 3. COMPLETE TRIAL — Step 2 (Create everything)
//    PATCH /public/complete-trial/:token
// ═════════════════════════════════════════════════════════════
const completeTrial = async (req, res) => {
  const { token } = req.params;
  const { password, full_name, enabled_features, delivery_type: userDeliveryType } = req.body;

  let createdCompany = null;
  let adminUser = null;
  let tenantDbConnection = null;
  let dbName = null;

  try {
    // ── Validate inputs ──────────────────────────
    if (!token) {
      return apiResponse(res, 400, false, "Token is required");
    }
    if (!password || password.length < 6) {
      return apiResponse(res, 400, false, "Password must be at least 6 characters");
    }

    // ── Verify JWT ───────────────────────────────
    let decoded;
    try {
      decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return apiResponse(res, 401, false, "Registration link has expired. Please request a new one.");
      }
      return apiResponse(res, 400, false, "Invalid registration link");
    }

    // Check type claim — SECURITY GUARD
    if (decoded.type !== "trial_signup") {
      return apiResponse(res, 400, false, "Invalid token type");
    }

    // ── Find TrialSignup record ──────────────────
    const trialSignup = await TrialSignup.findById(decoded.trialId);
    if (!trialSignup) {
      return apiResponse(res, 404, false, "Registration request not found or expired");
    }

    if (trialSignup.status === "completed") {
      return apiResponse(res, 400, false, "This registration has already been completed");
    }

    const { company_name, email } = trialSignup;
    const finalDeliveryType = userDeliveryType || trialSignup.delivery_type || "willcall";

    // ── Double-check company name availability ───
    const { available } = await checkCompanyExists(company_name);
    if (!available) {
      return apiResponse(res, 400, false, "Company name is no longer available. Please start a new registration.");
    }

    // ─────────────────────────────────────────────
    // STEP A: CREATE TENANT MySQL DATABASE
    // ─────────────────────────────────────────────
    // Only allow alphanumeric characters and single underscores
    const sanitizedName = company_name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")  // Replace any non-alphanumeric char with _
      .replace(/_+/g, "_")         // Replace multiple underscores with a single one
      .replace(/^_+|_+$/g, "");    // Trim underscores from start/end

    dbName = `company_${sanitizedName}`;

    await pool.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);

    // ─────────────────────────────────────────────
    // STEP B: CREATE COMPANY IN MONGODB
    // ─────────────────────────────────────────────
    const features = enabled_features || {};

    createdCompany = await Company.create({
      name: company_name,
      db_uri: dbName,
      dbName,
      logoUrl: "/logos/default_trial_logo.png",
      delivery_type: finalDeliveryType,
      // is_supplies_enabled: features.supplies === true,
      enabled_features: {
        billing: features.billing !== false,   // default true
        reports: features.reports !== false,    // default true
        map_monitoring: features.map_monitoring !== false, // default true
        messaging: features.messaging !== false, // default true
        teams: features.teams !== false,        // default true
      },
      capacity_limits: {
        max_users: 10,
        max_admins: 10,
        max_dispatchers: 10,
        max_drivers: 10,
        max_managers: 10,
        max_jobs_per_day: 10,
        max_trips_per_day: 10,
        max_clinics: 10,
        max_routes: 10,
        max_willcalls: 10,
      },
      createdBy: null, // Self-service — no super-admin
      status: "active",
      is_trial: true,
    });

    // ─────────────────────────────────────────────
    // STEP C: CREATE ADMIN USER IN MONGODB
    // ─────────────────────────────────────────────
    const { firstName, lastName } = splitFullName(full_name || company_name);

    // Check if user already exists
    adminUser = await User.findOne({ email: email.toLowerCase() });

    if (!adminUser) {
      adminUser = await User.create({
        email: email,
        password: password, // Model pre-save hook will hash
        is_active: true,
        is_deleted: false,
      });
    } else {
      adminUser.password = password;
      adminUser.is_active = true;
      adminUser.is_deleted = false;
      await adminUser.save();
    }

    // ─────────────────────────────────────────────
    // STEP D: CREATE MEMBERSHIP
    // ─────────────────────────────────────────────
    await UserCompanyMembership.create({
      user_id: adminUser._id,
      company_id: createdCompany._id,
      first_name: firstName,
      last_name: lastName,
      role: ["admin"],
      status: "active",
      is_active: true,
      is_password_changed: true,
      is_primary_admin: true,
    });

    // ─────────────────────────────────────────────
    // STEP E: INSERT USERS INTO TENANT MYSQL DB
    // ─────────────────────────────────────────────
    // To maintain consistency, we insert a Super Admin first (ID 1)
    // followed by the Company Admin (ID 2).
    
    tenantDbConnection = await mysql.createConnection({
      host: process.env.MYSQL_HOST,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: dbName,
    });

    await tenantDbConnection.beginTransaction();

    // 1. Find the first available Super Admin from Master DB
    const superAdminMembership = await UserCompanyMembership.findOne({
      role: { $in: ["superadmin", ["superadmin"]] }
    }).populate("user_id");

    const sAdminEmail = superAdminMembership?.user_id?.email
    const sAdminFirstName = superAdminMembership?.first_name || "Super";
    const sAdminLastName = superAdminMembership?.last_name || "Admin";
    const sAdminUserId = generateUUIDv7();

    // 2. Insert Super Admin (will get ID 1)
    await tenantDbConnection.execute(
      `INSERT INTO users (user_id, first_name, last_name, email, is_deleted, is_active)
       VALUES (?, ?, ?, ?, 0, 1)`,
      [sAdminUserId, sAdminFirstName, sAdminLastName, sAdminEmail]
    );

    // 3. Insert Trial Admin (will get ID 2)
    const adminUserId = generateUUIDv7();
    await tenantDbConnection.execute(
      `INSERT INTO users (user_id, first_name, last_name, email, is_deleted, is_active)
       VALUES (?, ?, ?, ?, 0, 1)`,
      [adminUserId, firstName, lastName, email]
    );

    await tenantDbConnection.commit();
    await tenantDbConnection.end();

    // ─────────────────────────────────────────────
    // STEP F: MARK TRIAL SIGNUP AS COMPLETED
    // ─────────────────────────────────────────────
    trialSignup.status = "completed";
    trialSignup.delivery_type = finalDeliveryType;
    await trialSignup.save();

    // ── SUCCESS RESPONSE ─────────────────────────
    return apiResponse(res, 200, true, "Registration completed successfully! You can now log in.", {
      company: {
        id: createdCompany._id,
        name: createdCompany.name,
      },
      email: adminUser.email,
    });
  } catch (error) {
    console.error("🔥 Complete Trial Error:", error);

    // ── Rollback on failure ──────────────────────
    if (tenantDbConnection) {
      try {
        await tenantDbConnection.rollback();
        await tenantDbConnection.end();
      } catch (err) {
        console.error("Failed to rollback MySQL:", err);
      }
    }

    if (adminUser) {
      try {
        await User.findByIdAndDelete(adminUser._id);
        await UserCompanyMembership.deleteMany({ user_id: adminUser._id });
      } catch (err) {
        console.error("Failed to cleanup admin user:", err);
      }
    }

    if (createdCompany) {
      try {
        await Company.findByIdAndDelete(createdCompany._id);
      } catch (err) {
        console.error("Failed to cleanup company:", err);
      }
    }

    if (dbName) {
      try {
        await pool.query(`DROP DATABASE IF EXISTS \`${dbName}\`;`);
      } catch (err) {
        console.error("Failed to cleanup tenant DB:", err);
      }
    }

    return apiResponse(res, 500, false, "Internal Server Error", {
      error: error.message,
    });
  }
};

// ═════════════════════════════════════════════════════════════
// 4. CHECK NAME AVAILABILITY — Public
//    POST /public/check-name
// ═════════════════════════════════════════════════════════════
const checkNameAvailability = async (req, res) => {
  try {
    const { company_name } = req.body;

    if (!company_name) {
      return apiResponse(res, 400, false, "Company name is required");
    }

    const { available } = await checkCompanyExists(company_name);

    return apiResponse(
      res,
      200,
      true,
      available ? "Company name is available" : "Company name already exists",
      { available, company_name: company_name.trim().toLowerCase() }
    );
  } catch (error) {
    console.error("🔥 Check Name Error:", error);
    return apiResponse(res, 500, false, "Internal Server Error");
  }
};

export { publicSignup,
  verifyTrialToken,
  completeTrial,
  checkNameAvailability,
 };

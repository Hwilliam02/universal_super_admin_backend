import mongoose from 'mongoose';
import apiResponse from '../utils/apiResponse.js';
import ActivityLog from '../models/ActivityLog.js';
import ExceptionLog from '../models/ExceptionLog.js';
import User from '../models/User.js';
import Company from '../models/Company.js';
import UserCompanyMembership from '../models/UserCompanyMembership.js';


const buildFilters = (q, type) => {
  const match = {};

  // text filters (partial, case-insensitive)
  if (q.action) match.action = { $regex: q.action, $options: "i" };
  if (q.module) match.module = { $regex: q.module, $options: "i" };
  if (q.companyName) match.companyName = { $regex: q.companyName, $options: "i" };
  if (q.platform) match.platform = { $regex: q.platform, $options: "i" };
  if (q.source) match.source = { $regex: q.source, $options: "i" };

  if (type === "exception" && q.severity) match.severity = q.severity;

  // createdAt range
  if (q.startDate || q.endDate) {
    match.createdAt = {};
    if (q.startDate) match.createdAt.$gte = new Date(q.startDate);
    if (q.endDate) match.createdAt.$lte = new Date(q.endDate);
  }

  // keyword search in message
  if (q.search) {
    match.message = { $regex: q.search, $options: "i" };
  }

  return match;
};

// Ensure super admin access
const requireSuperAdmin = (req, res) => {
  const roles = Array.isArray(req.user?.role) ? req.user.role : [req.user?.role];
  if (!roles.includes("superadmin") && !roles.includes("lead")) {
    apiResponse(res, 403, false, "Only super admin can access logs");
    return false;
  }
  return true;
};

// Common aggregation to enrich with admin details
const aggregateWithUser = async (Model, match, page, limit, sort) => {
  const skip = (page - 1) * limit;

  const pipeline = [
    { $match: match },
    // Derive an objectId for lookup when possible
    {
      $addFields: {
        derivedUserId: {
          $cond: [
            { $eq: [{ $type: "$userObjectId" }, "objectId"] },
            "$userObjectId",
            {
              $cond: [
                {
                  $and: [
                    { $eq: [{ $type: "$userObjectId" }, "string"] },
                    { $eq: [{ $strLenCP: "$userObjectId" }, 24] }
                  ]
                },
                { $toObjectId: "$userObjectId" },
                null
              ]
            }
          ]
        }
      }
    },
    {
      $lookup: {
        from: "users",
        localField: "derivedUserId",
        foreignField: "_id",
        as: "user"
      }
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        action: 1,
        module: 1,
        payload: 1,
        previousData: 1,
        ip: 1,
        userObjectId: 1,
        message: 1,
        platform: 1,
        source: 1,
        role: 1,
        companyName: 1,
        companyDb_uri: 1,
        companyDbName: 1,
        severity: 1,
        createdAt: 1,
        updatedAt: 1,
        admin: {
          _id: "$user._id",
          first_name: "$user.first_name",
          last_name: "$user.last_name",
          email: "$user.email",
          role: "$user.role"
        }
      }
    },
    { $sort: sort },
    { $skip: skip },
    { $limit: limit }
  ];

  const [items, counts] = await Promise.all([
    Model.aggregate(pipeline),
    Model.countDocuments(match)
  ]);

  return { items, total: counts, page, limit, pages: Math.ceil(counts / limit) };
};

const getActivityLogs = async (req, res) => {
  try {
    if (!requireSuperAdmin(req, res)) return;

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const sortBy = req.query.sortBy || "createdAt";
    const order = req.query.order === "asc" ? 1 : -1;
    const sort = { [sortBy]: order };

    const match = buildFilters(req.query, "activity");

    const data = await aggregateWithUser(ActivityLog, match, page, limit, sort);
    return apiResponse(res, 200, true, "Activity logs fetched", data);
  } catch (err) {
    console.error("getActivityLogs error:", err);
    return apiResponse(res, 500, false, "Server error fetching activity logs", { error: err.message });
  }
};

const getExceptionLogs = async (req, res) => {
  try {
    if (!requireSuperAdmin(req, res)) return;

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
    const sortBy = req.query.sortBy || "createdAt";
    const order = req.query.order === "asc" ? 1 : -1;
    const sort = { [sortBy]: order };

    const match = buildFilters(req.query, "exception");

    const data = await aggregateWithUser(ExceptionLog, match, page, limit, sort);
    return apiResponse(res, 200, true, "Exception logs fetched", data);
  } catch (err) {
    console.error("getExceptionLogs error:", err);
    return apiResponse(res, 500, false, "Server error fetching exception logs", { error: err.message });
  }
};

// Company-level analytics for dashboard
const getCompanyAnalytics = async (req, res) => {
  try {
    if (!requireSuperAdmin(req, res)) return;

    const { companyId } = req.params;

    if (!companyId || !mongoose.Types.ObjectId.isValid(companyId)) {
      return apiResponse(res, 400, false, "Invalid or missing companyId", null);
    }

    const company = await Company.findById(companyId).lean();
    if (!company) {
      return apiResponse(res, 404, false, "Company not found", null);
    }

    const baseMembershipFilter = {
      company_id: company._id,
      is_deleted: { $ne: true },
    };

    const companyIdStr = String(company._id);

    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      activityLogs,
      exceptionLogs,
      loginLogs,
    ] = await Promise.all([
      UserCompanyMembership.countDocuments(baseMembershipFilter),
      UserCompanyMembership.countDocuments({ ...baseMembershipFilter, status: "active" }),
      UserCompanyMembership.countDocuments({ ...baseMembershipFilter, status: "suspended" }),
      aggregateWithUser(
        ActivityLog,
        { companyId: companyIdStr },
        1,
        1,
        { createdAt: -1 }
      ),
      aggregateWithUser(
        ExceptionLog,
        { companyId: companyIdStr },
        1,
        1,
        { createdAt: -1 }
      ),
      aggregateWithUser(
        ActivityLog,
        {
          module: { $regex: "login", $options: "i" },
          companyId: companyIdStr,
        },
        1,
        5,
        { createdAt: -1 }
      ),
    ]);

    const activityItem = activityLogs?.items?.[0];
    const exceptionItem = exceptionLogs?.items?.[0];

    let lastLog = null;
    if (activityItem && exceptionItem) {
      lastLog =
        new Date(activityItem.createdAt) >= new Date(exceptionItem.createdAt)
          ? activityItem
          : exceptionItem;
    } else if (activityItem) {
      lastLog = activityItem;
    } else if (exceptionItem) {
      lastLog = exceptionItem;
    }

    const lastActivity = lastLog
      ? {
          action: lastLog.action,
          module: lastLog.module,
          createdAt: lastLog.createdAt,
          message: lastLog.message,
          userEmail: lastLog.admin?.email,
        }
      : null;

    const lastLogins = Array.isArray(loginLogs?.items)
      ? loginLogs.items.map((log) => ({
          userId:
            (log.admin && log.admin._id && String(log.admin._id)) ||
            (log.userObjectId ? String(log.userObjectId) : ""),
          userEmail: log.admin?.email,
          createdAt: log.createdAt,
        }))
      : [];

    const payload = {
      companyId: company._id,
      companyName: company.name,
      totalUsers,
      activeUsers,
      suspendedUsers,
      lastActivity,
      lastLogins,
      delivery_type: company.delivery_type,
      enabled_features: company.enabled_features,
      capacity_limits: company.capacity_limits,
    };

    return apiResponse(res, 200, true, "Company analytics fetched", payload);
  } catch (err) {
    console.error("getCompanyAnalytics error:", err);
    return apiResponse(res, 500, false, "Server error fetching company analytics", {
      error: err.message,
    });
  }
};

export { getActivityLogs, getExceptionLogs, getCompanyAnalytics  };

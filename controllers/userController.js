import apiResponse from '../utils/apiResponse.js';
import User from '../models/User.js';
import Company from '../models/Company.js';
import mongoose from 'mongoose';
import UserCompanyMembership from '../models/UserCompanyMembership.js';
import GlobalUser from '../models/GlobalUser.js';
import Visa from '../models/Visa.js';
import ProductRegistry from '../models/ProductRegistry.js';

const createSuperAdmin = async (req,res) => {
    try {
        const {first_name, last_name, email, password, role} = req.body;
        if(!first_name || !last_name || !email || !password) {
           return apiResponse(res, 400, 'error', 'Name, email and password are required');
        };
        
        // Check if a superadmin already exists (only one superadmin allowed)
        const existingSuperAdmin = await User.findOne({
            role: { $in: ['superadmin', ['superadmin']] }
        });
        if(existingSuperAdmin) {
           return apiResponse(res, 403, false, 'A superadmin account is already registered. Only login is allowed.');
        }
        
        const createdSuperAdmin = await User.create({
            first_name: first_name,
            last_name: last_name,
            email: email,
            password: password,
            role: role,
            status:'active'
        });

        // Create a 'global' membership with null company_id for the superadmin
        await UserCompanyMembership.create({
            user_id: createdSuperAdmin._id,
            company_id: null,
            first_name: first_name,
            last_name: last_name,
            role: ["superadmin"],
            status: 'active',
            is_active: true,
            is_password_changed: true,
            is_primary_admin: false,
        });

        return apiResponse(res, 201, 'success', 'Super admin created successfully', {
            id: createdSuperAdmin._id,
            first_name: createdSuperAdmin.first_name,
            last_name: createdSuperAdmin.last_name,
            email: createdSuperAdmin.email,
        });            
} catch (error) {
        console.error('Error creating super admin:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};


const getCompanies = async (req, res) => {
  try {
    const { id, role, companyId } = req.user; // role and companyId from token

    // SUPER ADMIN → Get all registered companies with admin details
    if (role.includes('superadmin')) {
      const companiesWithAdmins = await Company.aggregate([
        {
          $lookup: {
            from: 'usercompanymemberships',
            let: { companyId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$company_id', '$$companyId'] },
                  role: { $in: ['admin', ['admin']] },
                  is_deleted: false
                }
              },
              {
                $sort: { createdAt: 1 }
              },
              {
                $limit: 1
              },
              {
                $lookup: {
                  from: 'users',
                  localField: 'user_id',
                  foreignField: '_id',
                  as: 'userDetails'
                }
              },
              {
                $project: {
                  _id: '$user_id',
                  first_name: { $ifNull: ['$first_name', { $arrayElemAt: ['$userDetails.first_name', 0] }] },
                  last_name: { $ifNull: ['$last_name', { $arrayElemAt: ['$userDetails.last_name', 0] }] },
                  email: { $arrayElemAt: ['$userDetails.email', 0] },
                  status: 1,
                  createdAt: 1
                }
              }
            ],
            as: 'membershipAdmin'
          }
        },
        {
          $lookup: {
            from: 'globalusers',
            let: { companyId: { $toString: '$_id' }, adminId: '$admin_global_user_id' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$global_company_id', '$$companyId'] },
                      { $ne: ['$global_user_id', '$$adminId'] }
                    ]
                  },
                  status: 'Active'
                }
              },
              { $count: 'count' }
            ],
            as: 'companyUsers'
          }
        },
        {
          $addFields: {
            userCount: { 
              $ifNull: [{ $arrayElemAt: ['$companyUsers.count', 0] }, 0]
            }
          }
        },
        {
          $addFields: {
            admin: {
              $cond: [
                { $ifNull: ['$admin_global_user_id', false] },
                {
                  _id: '$admin_global_user_id',
                  first_name: { $ifNull: ['$admin_first_name', ''] },
                  last_name: { $ifNull: ['$admin_last_name', ''] },
                  email: { $ifNull: ['$admin_email', ''] },
                  status: '$status',
                  createdAt: '$createdAt'
                },
                { $arrayElemAt: ['$membershipAdmin', 0] }
              ]
            },
            displayEmail: {
              $cond: [
                { $ifNull: ['$admin_email', false] },
                '$admin_email',
                { $arrayElemAt: ['$membershipAdmin.email', 0] }
              ]
            }
          }
        },
        {
          $project: {
            __v: 0,
            membershipAdmin: 0,
            companyUsers: 0
          }
        },
        {
          $sort: { createdAt: -1 } // Latest companies first
        }
      ]);
      
      return res.status(200).json({
        status: "success",
        total: companiesWithAdmins.length,
        data: companiesWithAdmins,
      });
    }

    // 🏢 COMPANY ADMIN → Get users they created in their company
    const isAdmin = Array.isArray(role) ? role.includes("admin") : role === "admin";
    if (isAdmin) {
      // 1️⃣ Find this admin's company metadata from the Master DB
      const companyRecord = await Company.findById(companyId);
      if (!companyRecord) {
        return res.status(404).json({
          status: "fail",
          message: "Company not found for this admin.",
        });
      }

      // 2️⃣ Connect dynamically to the company's database
      const companyConnection = await mongoose.createConnection(companyRecord.dbUri);
      const CompanyUser = companyConnection.model("User", companyUserSchema);

      // 3️⃣ Query all users created by this admin
      const users = await CompanyUser.find({ createdBy: id }).select("-password -__v");

      // 4️⃣ Close the connection (important)
      await companyConnection.close();

      return res.status(200).json({
        status: "success",
        total: users.length,
        data: users,
      });
    }

    // 🧍‍♂️ MANAGER / EMPLOYEE → Forbidden
    return res.status(403).json({
      status: "fail",
      message: "You do not have permission to view this resource.",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: "error",
      message: "Server error retrieving company users.",
      error: err.message,
    });
  }
};



const getCompanyUsers = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { role } = req.user; // role from token

    // Only super admin can access this endpoint
    if (!role.includes('superadmin')) {
      return res.status(403).json({
        status: "fail",
        message: "You do not have permission to view this resource.",
      });
    }

    // Find users by company_id in the main database
    const users = await User.find({ company_id: companyId })
      .select("-password -__v")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      status: "success",
      total: users.length,
      data: users,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: "error",
      message: "Server error retrieving company users.",
      error: err.message,
    });
  }
};

const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status } = req.body;
    const { role } = req.user; // role from token

    // Only super admin can update user status
    if (!role.includes('superadmin')) {
      return res.status(403).json({
        status: "fail",
        message: "You do not have permission to update user status.",
      });
    }

    // Validate status
    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid status. Must be active, inactive, or suspended.",
      });
    }

    // Update user status
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { status: status },
      { new: true, select: "-password -__v" }
    );

    if (!updatedUser) {
      return res.status(404).json({
        status: "fail",
        message: "User not found.",
      });
    }

    return res.status(200).json({
      status: "success",
      message: `User status updated to ${status}`,
      data: updatedUser,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: "error",
      message: "Server error updating user status.",
      error: err.message,
    });
  }
};


const undeleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.user; // role from token

    // Only super admin can restore users
    if (!role.includes('superadmin')) {
      return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to restore users.',
      });
    }

    const restoredUser = await User.findByIdAndUpdate(
      userId,
      { is_deleted: false },
      { new: true, select: '-password -__v' }
    );

    if (!restoredUser) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found.',
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'User restored successfully',
      data: restoredUser,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: 'error',
      message: 'Server error restoring user.',
      error: err.message,
    });
  }
};

const getGlobalUsers = async (req, res) => {
  try {
    const { role } = req.user;

    if (!role.includes('superadmin')) {
      return res.status(403).json({
        status: "fail",
        message: "You do not have permission to view this resource.",
      });
    }

    // Find GlobalUsers where global_company_id is null or empty
    const globalUsers = await GlobalUser.find({ 
      $or: [
        { global_company_id: null },
        { global_company_id: "" }
      ]
    }).select("-password_hash -__v").lean();

    // For each user, fetch their visas and product names
    const usersWithVisas = await Promise.all(globalUsers.map(async (user) => {
      const visas = await Visa.find({ global_user_id: user.global_user_id }).lean();
      
      const visasWithProductDetails = await Promise.all(visas.map(async (visa) => {
        const product = await ProductRegistry.findOne({ product_id: visa.product_id }).select('name').lean();
        return {
          ...visa,
          product_name: product?.name || visa.product_id
        };
      }));

      return {
        ...user,
        visas: visasWithProductDetails
      };
    }));

    return res.status(200).json({
      status: "success",
      total: usersWithVisas.length,
      data: usersWithVisas,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: "error",
      message: "Server error retrieving global users.",
      error: err.message,
    });
  }
};

const updateGlobalUserStatus = async (req, res) => {
  try {
    const { globalUserId } = req.params;
    const { status } = req.body;
    const { role } = req.user;

    if (!role.includes('superadmin')) {
      return res.status(403).json({
        status: "fail",
        message: "You do not have permission to update global user status.",
      });
    }

    const validStatuses = ['Active', 'Suspended'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid status. Must be Active or Suspended.",
      });
    }

    const updatedUser = await GlobalUser.findOneAndUpdate(
      { global_user_id: globalUserId },
      { status: status },
      { new: true, select: "-password_hash -__v" }
    );

    if (!updatedUser) {
      return res.status(404).json({
        status: "fail",
        message: "Global user not found.",
      });
    }

    return res.status(200).json({
      status: "success",
      message: `Global user status updated to ${status}`,
      data: updatedUser,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: "error",
      message: "Server error updating global user status.",
      error: err.message,
    });
  }
};

export { createSuperAdmin, getCompanies, getCompanyUsers, updateUserStatus, undeleteUser, getGlobalUsers, updateGlobalUserStatus };

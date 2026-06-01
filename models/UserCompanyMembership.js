import mongoose from 'mongoose';
const { Schema } = mongoose;

const UserCompanyMembershipSchema = new Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: false,
      default: null,
    },
    first_name: {
      type: String,
      trim: true,
    },
    last_name: {
      type: String,
      trim: true,
    },
    role: {
      type: [String],
      required: true,
      default: ["user"],
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    phone: {
      type: String,
    },
    time_zone: {
      type: String,
    },
    // territory: {
    //   type: String,
    // },
    is_primary_admin: {
      type: Boolean,
      default: false,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    is_deleted: {
      type: Boolean,
      default: false,
    },
    // is_agreed: {
    //   type: Boolean,
    //   default: false,
    // },
    // is_password_changed: {
    //   type: Boolean,
    //   default: true,
    // },
    access_scope: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

// Unique compound index — one membership per user-company pair
UserCompanyMembershipSchema.index(
  { user_id: 1, company_id: 1 },
  { unique: true }
);

// Fast lookup by user (e.g., "which companies does this user belong to?")
UserCompanyMembershipSchema.index({ user_id: 1 });

// Fast lookup by company (e.g., "which users belong to this company?")
UserCompanyMembershipSchema.index({ company_id: 1 });

const UserCompanyMembership =
  mongoose.models.UserCompanyMembership ||
  mongoose.model("UserCompanyMembership", UserCompanyMembershipSchema);

export default UserCompanyMembership;;

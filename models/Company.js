import mongoose from 'mongoose';

const tenantSchema = new mongoose.Schema(
 {
    // Basic company info
    name: {
      type: String,
      required: true,
      trim: true,
    },
    logoUrl: {
      type: String,
      default: null,
    },
    productIds: {
      type: [String],
      required: false,
      default: [],
    },
    domain: {
      type: String,
      trim: true,
    },
    // DB connection info
    db_uri: {
      type: String,
      required: false,
      default: null,
    },
    dbName: {
      type: String,
      required: false,
      default: null,
    },
    admin_global_user_id: {
      type: String,
      default: null,
    },
    admin_email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    admin_first_name: {
      type: String,
      trim: true,
      default: null,
    },
    admin_last_name: {
      type: String,
      trim: true,
      default: null,
    },
    // Admin reference (important addition)
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Global User reference or master mapping
      required: false,
    },

    // Status and lifecycle
    status: {
      type: String,
      enum: ["active", "suspended", "inactive", "deleted"],
      default: "inactive",
    },
    enabled_features: {
      billing: { type: Boolean, default: true },
      reports: { type: Boolean, default: true },
      map_monitoring: { type: Boolean, default: true },
      messaging: { type: Boolean, default: true },
      teams: { type: Boolean, default: true },
    },
    capacity_limits: {
      max_users: { type: Number, default: 0 },
      max_admins: { type: Number, default: 0 },
      max_dispatchers: { type: Number, default: 0 },
      max_drivers: { type: Number, default: 0 },
      max_managers: { type: Number, default: 0 },
      max_jobs_per_day: { type: Number, default: 0 },
      max_trips_per_day: { type: Number, default: 0 },
      max_clinics: { type: Number, default: 0 },
      max_routes: { type: Number, default: 0 },
      max_willcalls: { type: Number, default: 0 },
    },
    is_trial: { type: Boolean, default: false },
  },
  { timestamps: true }
);
const Company = mongoose.model("Company", tenantSchema);

export default Company;

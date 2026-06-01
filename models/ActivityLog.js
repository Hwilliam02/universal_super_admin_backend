import mongoose from 'mongoose';

const ActivityLogSchema = new mongoose.Schema(
  {
    action: { type: String },
    module: { type: String },
    payload: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
    userId: { type: mongoose.Schema.Types.Mixed },
    message: { type: String },
    platform: { type: String },
    source: { type: String },
    role: { type: [String], default: undefined },
    companyName: { type: String },
    companyDb_uri: { type: String },
    companyDbName: { type: String },
  },
  { timestamps: true, collection: "activitylogs" }
);

export default mongoose.model("ActivityLog", ActivityLogSchema);;

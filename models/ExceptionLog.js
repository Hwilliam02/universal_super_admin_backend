import mongoose from 'mongoose';

const ExceptionLogSchema = new mongoose.Schema(
  {
    action: { type: String },
    module: { type: String },
    errorDetails: { type: mongoose.Schema.Types.Mixed },
    payload: { type: mongoose.Schema.Types.Mixed },
    ip: { type: String },
    userId: { type: mongoose.Schema.Types.Mixed },
    message: { type: String },
    severity: { type: String },
    platform: { type: String },
    source: { type: String },
    role: { type: [String], default: undefined },
    companyName: { type: String },
    companyDb_uri: { type: String },
    companyDbName: { type: String },
  },
  { timestamps: true, collection: "exceptionlogs" }
);

export default mongoose.model("ExceptionLog", ExceptionLogSchema);;

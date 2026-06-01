import mongoose from 'mongoose';

const trialSignupSchema = new mongoose.Schema(
  {
    company_name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    admin_name: {
      type: String,
      trim: true,
    },
    delivery_type: {
      type: String,
      enum: ["willcall", "job"],
    },
    status: {
      type: String,
      enum: ["pending", "completed", "expired"],
      default: "pending",
    },
  },
  { timestamps: true }
);

// Auto-delete pending signups after 24 hours
trialSignupSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 86400, partialFilterExpression: { status: "pending" } }
);

// Prevent duplicate pending signups for same email
trialSignupSchema.index({ email: 1, status: 1 });

const TrialSignup = mongoose.model("TrialSignup", trialSignupSchema);

export default TrialSignup;;

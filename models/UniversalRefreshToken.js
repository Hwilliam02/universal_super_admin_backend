import mongoose from 'mongoose';

const universalRefreshTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  global_user_id: { type: String, required: true, ref: 'GlobalUser' },
  expiresAt: { type: Date, required: true },
  revoked: { type: Boolean, default: false },
  // Optional: Track device info or IP address for security audits
  userAgent: { type: String },
  ipAddress: { type: String }
}, { timestamps: true });

// TTL index to automatically delete expired tokens from the DB
universalRefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('UniversalRefreshToken', universalRefreshTokenSchema);

import mongoose from 'mongoose';
const { Schema } = mongoose;

const refreashTokenSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    token_hash: { type: String, required: true },
    device_info: { type: Object, default: null },
    is_revoked: { type: Boolean, default: false },
    revoked_at: { type: Date },
    expires_at: { type: Date, required: true },
  },
  { timestamps: true }
);

const refreshToken = mongoose.model('RefreshToken', refreashTokenSchema);
export default refreshToken;
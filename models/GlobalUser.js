import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

const globalUserSchema = new mongoose.Schema({
  global_user_id: { type: String, default: uuidv4, unique: true },
  username: { type: String, unique: true, sparse: true },
  email: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  global_company_id: { type: String, default: null }, // Optional, if you want B2B structures at a global level
  status: { type: String, enum: ['Active', 'Suspended', 'Pending'], default: 'Active' },
  verification_code: { type: String, default: null },
  verification_token: { type: String, default: null },
  verification_expires_at: { type: Date, default: null },
}, { timestamps: true });

// Hash password before saving
globalUserSchema.pre('save', async function (next) {
  if (!this.isModified('password_hash')) return next();
  this.password_hash = await bcrypt.hash(this.password_hash, 12);
  next();
});

// Method to verify password
globalUserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password_hash);
};

export default mongoose.model('GlobalUser', globalUserSchema);

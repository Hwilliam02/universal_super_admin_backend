import mongoose from 'mongoose';

const visaSchema = new mongoose.Schema({
  global_user_id: { type: String, required: true, ref: 'GlobalUser' },
  product_id: { type: String, required: true, ref: 'ProductRegistry' },
  role: { type: String, default: 'User' },
  status: { type: String, enum: ['Active', 'Suspended'], default: 'Active' },
}, { timestamps: true });

// Ensure a user can only have one visa per product
visaSchema.index({ global_user_id: 1, product_id: 1 }, { unique: true });

export default mongoose.model('Visa', visaSchema);

import mongoose from 'mongoose';

const companyRateLimitSchema = new mongoose.Schema({
  ip: { type: String, required: true, unique: true },

  count: { type: Number, default: 0 },

  lastReset: { type: Date, default: Date.now },  // for daily reset
});
const CompanyRate =  mongoose.model("CompanyRateLimit", companyRateLimitSchema);
export default CompanyRate;

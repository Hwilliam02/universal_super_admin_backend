// import mongoose from 'mongoose';

// const leadSchema = new mongoose.Schema(
//   {
//     company_name: {
//       type: String,
//       required: false,
//       trim: true,
//     },
//     contact_person: {
//       type: String,
//       required: false,
//       trim: true,
//     },
//     email: {
//       type: String,
//       required: true,
//       lowercase: true,
//       trim: true,
//     },
//     phone: {
//       type: String,
//       default: null,
//     },
//     service_area: {
//       type: String,
//       default: null,
//       trim: true,
//     },
//     delivery_type: {
//       type: String,
//       enum: ["willcall", "job"],
//       required: false,
//       default: "willcall",
//     },
//     company_type: {
//       type: String,
//       default: null,
//       trim: true,
//     },
//     delivery_model: {
//       type: String,
//       default: null,
//       trim: true,
//     },
//     monthly_order_value: {
//       type: String,
//       default: null,
//       trim: true,
//     },
//     implementation_timeline: {
//       type: String,
//       default: null,
//       trim: true,
//     },
//     your_role: {
//       type: String,
//       default: null,
//       trim: true,
//     },
//     fleet_size: {
//       type: String,
//       default: null,
//       trim: true,
//     },
//     logo_url: {
//       type: String,
//       default: null,
//     },
//     notes: {
//       type: String,
//       default: null,
//     },
//     status: {
//       type: String,
//       enum: ["new", "contacted", "converted", "rejected"],
//       default: "new",
//     },
//     submitted_by: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: false,
//       default: null,
//     },
//   },
//   { timestamps: true }
// );

// // Index for fast lookups
// leadSchema.index({ submitted_by: 1 });
// leadSchema.index({ status: 1 });

// const Lead = mongoose.model("Lead", leadSchema);

// export default Lead;;

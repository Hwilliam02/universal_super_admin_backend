// import Lead from '../models/Lead.js';
// import apiResponse from '../utils/apiResponse.js';
// import axios from 'axios';
// import FormData from 'form-data';
// import path from 'path';

// // Create a new lead
// const createLead = async (req, res) => {
//   try {
//     const {
//       company_name,
//       contact_person,
//       email,
//       phone,
//       service_area,
//       delivery_type,
//       notes,
//       company_type,
//       delivery_model,
//       monthly_order_value,
//       implementation_timeline,
//       your_role,
//       fleet_size,
//     } = req.body;

//     if (!email) {
//       return apiResponse(res, 400, false, "Missing required field (email)");
//     }

//     // Handle logo upload if provided
//     let logo_url = null;
//     if (req.file) {
//       try {
//         const formData = new FormData();
//         formData.append("file", req.file.buffer, {
//           filename: `lead_logo_${Date.now()}${path.extname(req.file.originalname)}`,
//           contentType: req.file.mimetype,
//         });
//         formData.append("folderPath", `leads/logos`);

//         const fileServerUrl = process.env.FILE_SERVER_URL || "http://localhost:5001";
//         const fileServerAuthToken = process.env.FILE_SERVER_AUTH_TOKEN;

//         const uploadResponse = await axios.post(`${fileServerUrl}/upload`, formData, {
//           headers: {
//             ...formData.getHeaders(),
//             Authorization: `Bearer ${fileServerAuthToken}`,
//           },
//         });

//         if (uploadResponse.data.success) {
//           logo_url = uploadResponse.data.url;
//         }
//       } catch (logoError) {
//         console.error("⚠️  Lead logo upload failed (non-critical):", logoError.message);
//       }
//     }

//     const lead = await Lead.create({
//       company_name: company_name || null,
//       contact_person: contact_person || null,
//       email,
//       phone: phone || null,
//       service_area: service_area || null,
//       delivery_type: delivery_type || "willcall",
//       logo_url,
//       notes: notes || null,
//       company_type: company_type || null,
//       delivery_model: delivery_model || null,
//       monthly_order_value: monthly_order_value || null,
//       implementation_timeline: implementation_timeline || null,
//       your_role: your_role || null,
//       fleet_size: fleet_size || null,
//       status: "new",
//       submitted_by: req.user ? req.user._id : null,
//     });

//     return apiResponse(res, 201, true, "Lead created successfully", lead);
//   } catch (error) {
//     console.error("Error creating lead:", error);
//     return apiResponse(res, 500, false, "Internal Server Error", { error: error.message });
//   }
// };

// // Get all leads
// const getLeads = async (req, res) => {
//   try {
//     const leads = await Lead.find()
//       .sort({ createdAt: -1 })
//       .populate("submitted_by", "email");

//     return apiResponse(res, 200, true, "Leads fetched successfully", leads);
//   } catch (error) {
//     console.error("Error fetching leads:", error);
//     return apiResponse(res, 500, false, "Internal Server Error", { error: error.message });
//   }
// };

// // Update lead status
// const updateLeadStatus = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { status } = req.body;

//     const validStatuses = ["new", "contacted", "converted", "rejected"];
//     if (!validStatuses.includes(status)) {
//       return apiResponse(res, 400, false, `Invalid status. Must be one of: ${validStatuses.join(", ")}`);
//     }

//     const lead = await Lead.findByIdAndUpdate(
//       id,
//       { status },
//       { new: true }
//     );

//     if (!lead) {
//       return apiResponse(res, 404, false, "Lead not found");
//     }

//     return apiResponse(res, 200, true, "Lead status updated successfully", lead);
//   } catch (error) {
//     console.error("Error updating lead status:", error);
//     return apiResponse(res, 500, false, "Internal Server Error", { error: error.message });
//   }
// };

// // Delete lead
// const deleteLead = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const lead = await Lead.findByIdAndDelete(id);

//     if (!lead) {
//       return apiResponse(res, 404, false, "Lead not found");
//     }

//     return apiResponse(res, 200, true, "Lead deleted successfully");
//   } catch (error) {
//     console.error("Error deleting lead:", error);
//     return apiResponse(res, 500, false, "Internal Server Error", { error: error.message });
//   }
// };

// export { createLead, getLeads, updateLeadStatus, deleteLead  };

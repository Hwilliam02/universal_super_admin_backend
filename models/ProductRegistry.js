import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const productRegistrySchema = new mongoose.Schema({
  product_id: { type: String, default: uuidv4, unique: true },
  name: { type: String, required: true, unique: true },
  
  // App Architecture
  architecture_type: { type: String, enum: ['SINGLE_DB', 'MULTI_TENANT'], required: true },
  
  // Database Connection
  db_driver: { type: String, enum: ['MONGODB', 'MYSQL'], required: true },
  db_uri: { type: String, required: true }, // Should be encrypted
  
  // Asymmetric Keys for JWT Signing
  app_private_key: { type: String, required: true }, // Encrypted Private Key for this specific app
  app_public_key: { type: String, required: true },  // Public Key for this specific app
  
  // User verification method for registration
  verification_method: { 
    type: String, 
    enum: ['code', 'link', 'none'], 
    default: 'code' 
  },

  // Frontend URL for post-verification redirects
  frontend_url: { type: String, default: null },

  // Optional: Dynamic UI Schema for provisioning
  ui_schema: [{
    field_name: String,
    label: String,
    type: { type: String, enum: ['text', 'email', 'password', 'select'] },
    required: Boolean
  }]
}, { timestamps: true });

export default mongoose.model('ProductRegistry', productRegistrySchema);

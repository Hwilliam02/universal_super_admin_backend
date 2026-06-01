import ProductRegistry from '../models/ProductRegistry.js';
import GlobalUser from '../models/GlobalUser.js';
import Visa from '../models/Visa.js';
import apiResponse from '../utils/apiResponse.js';
import crypto from 'crypto';

// Utility to generate RSA key pairs for each product
const generateRSAKeyPair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
  return { publicKey, privateKey };
};

// POST /api/products
const registerProduct = async (req, res) => {
  try {
    const { name, architecture_type, db_driver, db_uri, ui_schema } = req.body;

    // Generate keys
    const { publicKey, privateKey } = generateRSAKeyPair();
    
    // In production, encrypt the db_uri and privateKey before storing!
    // For now, storing as received/generated.
    
    const newProduct = new ProductRegistry({
      name,
      architecture_type,
      db_driver,
      db_uri,
      app_public_key: publicKey,
      app_private_key: privateKey,
      ui_schema
    });

    const savedProduct = await newProduct.save();
    
    // Never send the private key back in the response
    const productResponse = savedProduct.toObject();
    delete productResponse.app_private_key;

    return apiResponse(res, 201, true, "Product registered successfully", productResponse);
  } catch (error) {
    return apiResponse(res, 400, "error", error.message);
  }
};

// GET /api/products
const getAllProducts = async (req, res) => {
  try {
    const products = await ProductRegistry.find().select('-app_private_key');
    return apiResponse(res, 200, "success", "Products fetched successfully", products);
  } catch (error) {
    return apiResponse(res, 500, false, error.message);
  }
};

// GET /api/products/:id
const getProductById = async (req, res) => {
  try {
    const product = await ProductRegistry.findById(req.params.id).select('-app_private_key');
    if (!product) {
      return apiResponse(res, 404, false, "Product not found");
    }
    return apiResponse(res, 200, "success", "Product fetched successfully", product);
  } catch (error) {
    return apiResponse(res, 500, false, error.message);
  }
};

// GET /api/products/by-product-id/:productId
const getProductByProductId = async (req, res) => {
  try {
    const product = await ProductRegistry.findOne({ product_id: req.params.productId })
      .select('product_id name app_public_key');
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/products/by-product-id/:productId/users
const getProductUsersByProductId = async (req, res) => {
  try {
    const product = await ProductRegistry.findOne({ product_id: req.params.productId }).select('product_id name');
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const visas = await Visa.find({ product_id: product.product_id, status: 'Active' }).lean();
    if (!visas.length) {
      return res.json([]);
    }

    const userIds = visas.map(v => v.global_user_id);
    const users = await GlobalUser.find({ global_user_id: { $in: userIds } })
      .select('global_user_id email username')
      .lean();

    const userMap = new Map(users.map(u => [u.global_user_id, u]));
    const result = visas.map(visa => {
      const user = userMap.get(visa.global_user_id);
      return {
        global_user_id: visa.global_user_id,
        email: user?.email || '',
        username: user?.username || '',
        role: visa.role,
        status: visa.status
      };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// PATCH /api/products/:id/verification-method
const updateProductVerificationMethod = async (req, res) => {
  try {
    const { id } = req.params;
    const { verification_method } = req.body;

    const validMethods = ['code', 'link', 'none'];
    if (!validMethods.includes(verification_method)) {
      return apiResponse(res, 400, false, 'Invalid verification method. Must be code, link, or none');
    }

    const product = await ProductRegistry.findByIdAndUpdate(
      id,
      { verification_method },
      { new: true, select: '-app_private_key' }
    );

    if (!product) {
      return apiResponse(res, 404, false, 'Product not found');
    }

    return apiResponse(res, 200, true, `Verification method updated to '${verification_method}'`, product);
  } catch (error) {
    return apiResponse(res, 500, false, error.message);
  }
};

export { registerProduct,
  getAllProducts,
  getProductById,
  getProductByProductId,
  getProductUsersByProductId,
  updateProductVerificationMethod
 };

import mongoose from 'mongoose';

// Cache connections to avoid reconnecting constantly
const connections = {};

const connectToMongoDB = async (uri) => {
  if (connections[uri]) {
    // Check if connection is still valid
    if (connections[uri].readyState === 1) return connections[uri];
    // If disconnected, remove from cache to try again
    delete connections[uri];
  }
  
  // Create connection with a short timeout to prevent hanging the whole server
  const conn = mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 5000, // 5 seconds timeout
    connectTimeoutMS: 10000,       // 10 seconds initial connection timeout
  });

  // Store in cache
  connections[uri] = conn;

  // We don't await conn here because createConnection returns the object immediately
  // and will queue operations. However, for provisioning, we might want to know it's ready.
  return conn;
};

// Lazy provisioning logic
const provisionUserInSatellite = async (product, globalUser, role) => {
  try {
    const { db_driver, db_uri } = product;

    if (!db_uri) {
      console.warn(`No DB URI configured for product ${product.name}, skipping lazy provisioning.`);
      return true;
    }

    if (db_driver === 'MONGODB') {
      const conn = await connectToMongoDB(db_uri);
      
      // We must wait for the connection to be established or failed
      // to avoid hanging on the findOne call if the server is unreachable
      const checkStatus = () => new Promise((resolve, reject) => {
        if (conn.readyState === 1) return resolve();
        if (conn.readyState === 2) { // connecting
          conn.once('open', resolve);
          conn.once('error', reject);
          // Set a fallback timeout just in case
          setTimeout(() => reject(new Error('Connection timeout')), 5000);
        } else {
          reject(new Error('Connection not open'));
        }
      });

      try {
        await checkStatus();
      } catch (connError) {
        console.error(`⚠️ Satellite DB for ${product.name} is unreachable: ${connError.message}`);
        return false; // Soft fail
      }

      const SatelliteUser = conn.models.User || conn.model('User', new mongoose.Schema({
        global_user_id: String,
        username: String,
        name: String,
        email: String,
        global_company_id: String,
        role: String,
        status: String
      }, { strict: false }), 'users');

      const displayName = globalUser.username || globalUser.email;
      const existingUser = await SatelliteUser.findOne({ global_user_id: globalUser.global_user_id });
      
      if (!existingUser) {
        await SatelliteUser.create({
          global_user_id: globalUser.global_user_id,
          username: globalUser.username,
          name: displayName,
          email: globalUser.email,
          global_company_id: globalUser.global_company_id,
          role: role,
          status: 'Active',
          provisioned_by: 'Universal-Master',
          provisioned_at: new Date()
        });
        console.log(`✅ Provisioned user ${globalUser.email} in ${product.name} (MongoDB)`);
      }
      return true;

    } else if (db_driver === 'MYSQL') {
      console.log(`MySQL provisioning logic pending for ${product.name}.`);
      return true;
    } else {
      throw new Error(`Unsupported DB Driver: ${db_driver}`);
    }
  } catch (error) {
    console.error(`❌ Failed to provision user in ${product.name}:`, error.message);
    return false; // Crucial: Return false instead of throwing to prevent blocking the response
  }
};

export { provisionUserInSatellite };

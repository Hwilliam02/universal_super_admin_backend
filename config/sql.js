// Stubbed to avoid establishing a MySQL connection at startup.
const pool = {
  query: async () => {
    throw new Error('MySQL pool is disabled. Connection is not created.');
  },
};

export default pool;

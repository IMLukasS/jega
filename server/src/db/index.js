const { Pool } = require('pg');

// Initialize the connection pool using our secure .env variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Catch unexpected errors on idle clients to prevent background crashes
pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

// Export the query helper function so our routes can use it
module.exports = {
  query: (text, params) => pool.query(text, params),
  connect: () => pool.connect(),
};
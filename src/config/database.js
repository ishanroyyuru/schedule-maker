const { Pool } = require('pg');

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test the connection
pool.on('connect', () => {
  console.log('Connected to database');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

// Export a query function that uses the pool
const query = (text, params) => pool.query(text, params);

// Export the pool for transactions
const getClient = () => pool.connect();

module.exports = {
  query,
  getClient,
  pool
}; 
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// FORCE loading of .env here just in case server.js is too slow
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

console.log("DATABASE STARTUP: Attempting to connect to host:", process.env.DB_HOST);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
  ssl: {
    ca: fs.readFileSync(path.join(__dirname, 'DigiCertGlobalRootG2.crt.pem')),
    rejectUnauthorized: true
  }
});

// Test the connection immediately
pool.getConnection()
  .then(conn => {
    console.log('✅ SUCCESS: Connected to Azure MySQL (authdb)');
    conn.release();
  })
  .catch(err => {
    console.error('❌ ERROR: Database connection failed.');
    console.error('Check if your IP is whitelisted in Azure. Error code:', err.code);
  });

module.exports = pool;
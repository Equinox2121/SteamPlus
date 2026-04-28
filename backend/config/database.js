
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const caPath = path.join(__dirname, 'DigiCertGlobalRootG2.crt.pem');

const caCert = fs.readFileSync(caPath);

console.log('CA cert:', caPath);
console.log('connect to', `${process.env.DB_HOST}:${process.env.DB_PORT}`);

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    ca: caCert, // use the CA for TLS validation
    rejectUnauthorized: true
  }
});

pool.getConnection()
  .then(conn => {
    console.log('connected to MySQL');
    conn.release();
  })
  .catch(err => {
    console.error('MySQL connection failed on startup:', err);
  });

module.exports = pool;
// utils/db.js
import mysql from 'mysql2';
import dotenv from 'dotenv';

dotenv.config();

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Optional: test connection
connection.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
  } else {
    console.log('Connected to MySQL database');
  }
});

// ✅ Export the Promise-based connection
const db = connection.promise();
export default db;

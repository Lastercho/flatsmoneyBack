const { Pool } = require('pg');
require('dotenv').config();

// Проверка на конфигурацията
// console.log('Database Config:', {
//   user: process.env.DB_USER,
//   host: process.env.DB_HOST,
//   database: process.env.DB_NAME,
//   // password: hidden
//   port: process.env.DB_PORT
// });

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'flatmoney',
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

module.exports = pool; 
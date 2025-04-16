const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Конфигурация за връзка с PostgreSQL
const config = {
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'flatmoney',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
};

// Създаване на pool за връзка с базата данни
const pool = new Pool(config);

// Функция за инициализация на базата данни
async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    // Проверка дали базата данни съществува
    const dbExists = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = 'flatmoney'"
    );

    if (dbExists.rows.length === 0) {
      // Създаване на базата данни
      await client.query('CREATE DATABASE flatmoney');
      console.log('База данни flatmoney е създадена успешно.');
    }

    // Освобождаване на връзката с postgres
    await client.release();

    // Създаване на нова връзка с flatmoney базата
    const flatmoneyPool = new Pool({
      ...config,
      database: 'flatmoney'
    });

    const flatmoneyClient = await flatmoneyPool.connect();

    try {
      // Четене на SQL файла
      const sqlPath = path.join(__dirname, 'init.sql');
      const sqlContent = fs.readFileSync(sqlPath, 'utf8');

      // Премахване на командата за създаване на базата данни и \c команда
      const cleanSql = sqlContent
        .replace(/CREATE DATABASE flatmoney;/g, '')
        .replace(/\\c flatmoney;/g, '')
        .split(';')
        .filter(command => command.trim())
        .join(';');

      // Изпълнение на SQL командите
      await flatmoneyClient.query(cleanSql);
      console.log('Таблиците са създадени успешно.');

    } catch (error) {
      if (error.code === '42P07') {
        console.log('Таблиците вече съществуват.');
      } else {
        console.error('Грешка при създаване на таблиците:', error);
        throw error;
      }
    } finally {
      await flatmoneyClient.release();
    }

  } catch (error) {
    console.error('Грешка при инициализация на базата данни:', error);
    throw error;
  }
}

// Експортиране на pool и функцията за инициализация
module.exports = {
  pool: new Pool({
    ...config,
    database: 'flatmoney'
  }),
  initializeDatabase
}; 
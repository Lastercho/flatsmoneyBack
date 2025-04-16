const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();
const { pool: databasePool, initializeDatabase } = require('./database/database');
const auth = require('./middleware/auth'); // Import the auth middleware

// Импортиране на auth routes
const authRoutes = require('./routes/auth');
const buildingsRouter = require('./routes/buildings');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// PostgreSQL връзка
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'flatmoney',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// Тестова връзка с базата данни
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  console.log('Successfully connected to PostgreSQL database');
  release();
});

// Инициализация на базата данни при стартиране
initializeDatabase()
  .then(() => {
    console.log('Базата данни е инициализирана успешно');
  })
  .catch(error => {
    console.error('Грешка при инициализация на базата данни:', error);
    process.exit(1);
  });

// Регистриране на routes
app.use('/api/auth', authRoutes);
app.use('/api/buildings', auth, buildingsRouter); // Add auth middleware

// API endpoints
app.get('/api/buildings', auth, async (req, res) => { // Add auth middleware
  try {
    const result = await pool.query('SELECT * FROM buildings WHERE is_deleted = FALSE');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/buildings', auth, async (req, res) => { // Add auth middleware
  const { name, address, total_floors } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO buildings (name, address, total_floors) VALUES ($1, $2, $3) RETURNING *',
      [name, address, total_floors]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/buildings/:buildingId/floors', auth, async (req, res) => { // Add auth middleware
  try {
    const result = await pool.query(
      'SELECT * FROM floors WHERE building_id = $1 AND is_deleted = FALSE',
      [req.params.buildingId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/buildings/:buildingId/floors', auth, async (req, res) => { // Add auth middleware
  const { floor_number, total_apartments } = req.body;
  try {
    // Проверяваме дали съществува изтрит етаж със същия номер
    const existingFloor = await pool.query(
      'SELECT id FROM floors WHERE building_id = $1 AND floor_number = $2 AND is_deleted = TRUE',
      [req.params.buildingId, floor_number]
    );

    let result;
    if (existingFloor.rows.length > 0) {
      // Ако има изтрит етаж, го актуализираме
      result = await pool.query(
        'UPDATE floors SET total_apartments = $1, is_deleted = FALSE WHERE id = $2 RETURNING *',
        [total_apartments, existingFloor.rows[0].id]
      );
    } else {
      // Ако няма изтрит етаж, създаваме нов
      result = await pool.query(
        'INSERT INTO floors (building_id, floor_number, total_apartments) VALUES ($1, $2, $3) RETURNING *',
        [req.params.buildingId, floor_number, total_apartments]
      );
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') { // Unique violation error code
      res.status(409).json({ 
        error: 'Етаж с този номер вече съществува в тази сграда.',
        details: err.detail 
      });
    } else {
      res.status(500).json({ error: 'Възникна грешка при добавяне на етаж.' });
    }
  }
});

app.delete('/api/floors/:id', auth, async (req, res) => { // Add auth middleware
  try {
    await pool.query('UPDATE floors SET is_deleted = TRUE WHERE id = $1', [req.params.id]);
    res.json({ message: 'Етажът е изтрит успешно' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/floors/:floorId/apartments', auth, async (req, res) => { // Add auth middleware
  try {
    const result = await pool.query(
      'SELECT a.*, f.floor_number FROM apartments a JOIN floors f ON a.floor_id = f.id WHERE a.floor_id = $1 AND a.is_deleted = FALSE',
      [req.params.floorId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/floors/:floorId/apartments', auth, async (req, res) => { // Add auth middleware
  const { apartment_number, owner_name, area } = req.body;
  try {
    // Проверяваме дали етажът съществува
    const floorExists = await pool.query(
      'SELECT * FROM floors WHERE id = $1 AND is_deleted = FALSE',
      [req.params.floorId]
    );

    if (floorExists.rows.length === 0) {
      return res.status(404).json({ error: 'Етажът не е намерен' });
    }

    // Проверяваме дали вече има апартамент с този номер на този етаж (включително и изтритите)
    const existingApartment = await pool.query(
      'SELECT * FROM apartments WHERE floor_id = $1 AND apartment_number = $2',
      [req.params.floorId, apartment_number]
    );

    if (existingApartment.rows.length > 0) {
      const isDeleted = existingApartment.rows[0].is_deleted;
      if (isDeleted) {
        // Ако апартаментът е бил изтрит, го възстановяваме с новите данни
        const result = await pool.query(
          'UPDATE apartments SET owner_name = $1, area = $2, is_deleted = FALSE WHERE id = $3 RETURNING *',
          [owner_name, area, existingApartment.rows[0].id]
        );
        return res.json(result.rows[0]);
      } else {
        return res.status(409).json({ error: 'Апартамент с този номер вече съществува на този етаж' });
      }
    }

    // Валидираме входните данни
    if (!apartment_number || !owner_name || !area) {
      return res.status(400).json({ error: 'Всички полета са задължителни' });
    }

    if (parseFloat(area) <= 0) {
      return res.status(400).json({ error: 'Площта трябва да бъде положително число' });
    }

    // Създаваме нов апартамент
    const result = await pool.query(
      'INSERT INTO apartments (floor_id, apartment_number, owner_name, area) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.floorId, apartment_number, owner_name, area]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code === '23505') {
      res.status(409).json({ error: 'Апартамент с този номер вече съществува на този етаж' });
    } else {
      res.status(500).json({ error: 'Възникна грешка при добавяне на апартамента' });
    }
  }
});

app.get('/api/apartments/:apartmentId/deposits', auth, async (req, res) => { // Add auth middleware
  try {
    const result = await pool.query(
      'SELECT * FROM deposits WHERE apartment_id = $1 AND is_deleted = FALSE ORDER BY date DESC',
      [req.params.apartmentId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/apartments/:apartmentId/deposits', auth, async (req, res) => { // Add auth middleware
  const { amount, date, description } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO deposits (apartment_id, amount, date, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.apartmentId, amount, date, description]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/apartments/:apartmentId/obligations', auth, async (req, res) => { // Add auth middleware
  try {
    const result = await pool.query(
      'SELECT * FROM obligations WHERE apartment_id = $1 AND is_deleted = FALSE ORDER BY due_date ASC',
      [req.params.apartmentId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/apartments/:apartmentId/obligations', auth, async (req, res) => { // Add auth middleware
  const { amount, due_date, description } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO obligations (apartment_id, amount, due_date, description) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.params.apartmentId, amount, due_date, description]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Маркиране на задължението като платено
app.put('/api/obligations/:id', auth, async (req, res) => { // Add auth middleware
  const { is_paid, payment_date } = req.body;
  try {
    const result = await pool.query(
      'UPDATE obligations SET is_paid = $1, payment_date = $2 WHERE id = $3 RETURNING *',
      [is_paid, payment_date, req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Задължението не е намерено' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/buildings/:id', auth, async (req, res) => { // Add auth middleware
  try {
    await pool.query('UPDATE buildings SET is_deleted = TRUE WHERE id = $1', [req.params.id]);
    res.json({ message: 'Сградата е изтрита успешно' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Взимане на конкретна сграда
app.get('/api/buildings/:id', auth, async (req, res) => { // Add auth middleware
  try {
    const result = await pool.query(
      'SELECT * FROM buildings WHERE id = $1 AND is_deleted = FALSE',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Сградата не е намерена' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/apartments/:id', auth, async (req, res) => { // Add auth middleware
  try {
    const result = await pool.query(
      'UPDATE apartments SET is_deleted = TRUE WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Апартаментът не е намерен' });
    }

    res.json({ message: 'Апартаментът е изтрит успешно' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Възникна грешка при изтриване на апартамента' });
  }
});

// Взимане на конкретен етаж
app.get('/api/floors/:id', auth, async (req, res) => { // Add auth middleware
  try {
    const result = await pool.query(
      'SELECT * FROM floors WHERE id = $1 AND is_deleted = FALSE',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Етажът не е намерен' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Изтриване на депозит
app.delete('/api/apartments/:apartmentId/deposits/:id', auth, async (req, res) => { // Add auth middleware
  try {
    const result = await pool.query(
      'UPDATE deposits SET is_deleted = TRUE WHERE id = $1 AND apartment_id = $2 RETURNING *',
      [req.params.id, req.params.apartmentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Депозитът не е намерен' });
    }

    res.json({ message: 'Депозитът е изтрит успешно' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Възникна грешка при изтриване на депозита' });
  }
});

// Взимане на всички типове разходи
app.get('/api/expense-types', auth, async (req, res) => { // Add auth middleware
  try {
    const result = await pool.query(
      'SELECT * FROM expense_types WHERE is_deleted = FALSE ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Възникна грешка при зареждане на типовете разходи' });
  }
});

// Взимане на разходите за конкретна сграда
app.get('/api/buildings/:buildingId/expenses', auth, async (req, res) => { // Add auth middleware
  try {
    const result = await pool.query(
      `SELECT be.*, et.name as expense_type_name 
       FROM building_expenses be 
       JOIN expense_types et ON be.expense_type_id = et.id 
       WHERE be.building_id = $1 AND be.is_deleted = FALSE 
       ORDER BY be.date DESC`,
      [req.params.buildingId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Възникна грешка при зареждане на разходите' });
  }
});

// Добавяне на нов разход
app.post('/api/buildings/:buildingId/expenses', auth, async (req, res) => { // Add auth middleware
  const { expense_type_id, amount, date, description } = req.body;
  
  try {
    // Проверка за валидни данни
    if (!expense_type_id || !amount || !date) {
      return res.status(400).json({ error: 'Всички полета са задължителни' });
    }

    if (parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Сумата трябва да бъде положително число' });
    }

    const result = await pool.query(
      `INSERT INTO building_expenses 
       (building_id, expense_type_id, amount, date, description) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [req.params.buildingId, expense_type_id, amount, date, description]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Възникна грешка при добавяне на разхода' });
  }
});

// Изтриване на разход
app.delete('/api/buildings/:buildingId/expenses/:expenseId', auth, async (req, res) => { // Add auth middleware
  try {
    const result = await pool.query(
      'UPDATE building_expenses SET is_deleted = TRUE WHERE id = $1 AND building_id = $2 RETURNING *',
      [req.params.expenseId, req.params.buildingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Разходът не е намерен' });
    }

    res.json({ message: 'Разходът е изтрит успешно' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Възникна грешка при изтриване на разхода' });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
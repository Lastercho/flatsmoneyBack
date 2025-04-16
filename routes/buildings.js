const express = require('express');
const router = express.Router();
const pool = require('../database');
const auth = require('../middleware/auth');

// Прилагаме auth middleware към всички routes
router.use(auth);

// Създаване на нова сграда
router.post('/', async (req, res) => {
  try {
    const { name, address, total_floors, description } = req.body;
    const userId = req.user.id;

    const result = await pool.query(
      `INSERT INTO buildings (name, address, total_floors, description, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, address, total_floors, description`,
      [name, address, total_floors, description || null, userId]
    );

    await pool.query(
      `INSERT INTO building_access (user_id, building_id, is_owner, can_edit)
       VALUES ($1, $2, true, true)`,
      [userId, result.rows[0].id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating building:', error);
    res.status(500).json({ 
      message: 'Грешка при създаване на сградата',
      error: error.message,
      user: req.user 
    });
  }
});

// Получаване на детайли за конкретна сграда
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT b.* 
       FROM buildings b
       JOIN building_access ba ON b.id = ba.building_id
       WHERE b.id = $1 AND ba.user_id = $2 AND b.is_deleted = false`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Сградата не е намерена' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching building details:', error);
    res.status(500).json({ message: 'Грешка при зареждане на детайлите за сградата' });
  }
});

module.exports = router; 
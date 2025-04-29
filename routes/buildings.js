const express = require('express');
const router = express.Router();
const pool = require('../database');
const auth = require('../middleware/auth');
const Apartment = require('../models/apartment.model'); // Import the Apartment model

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

router.post('/:buildingId/bulk-obligations', async (req, res) => {
  try {
    const { buildingId } = req.params;
    const { amount, due_date, description } = req.body;

    // 1. Get all apartments in the building
    const apartments = await getAllApartmentsInBuilding(buildingId);
    console.log('Apartments:', apartments);

    // 2. Create an obligation for each apartment
    for (const apartment of apartments) {
      await Apartment.addObligation(apartment.id, {
        amount,
        due_date,
        description,
      });
    }

    res.status(200).json({
      success: true,
      message: `Добавени са задължения към ${apartments.length} апартамента`,
    });
  } catch (error) {
    console.error('Error creating bulk obligations:', error);
    res.status(500).json({
      success: false,
      message: 'Възникна грешка при добавяне на задължения',
    });
  }
});

async function getAllApartmentsInBuilding(buildingId) {
  const query = `
    SELECT a.* 
    FROM apartments a
    JOIN floors f ON a.floor_id = f.id
    WHERE f.building_id = $1
  `;
  const result = await pool.query(query, [buildingId]);
  return result.rows;
}

// Изтриване на сграда
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Проверка дали потребителят има права за изтриване
    const accessCheck = await pool.query(
      `SELECT is_owner FROM building_access 
       WHERE building_id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (accessCheck.rows.length === 0 || !accessCheck.rows[0].is_owner) {
      return res.status(403).json({ message: 'Нямате права за изтриване на тази сграда' });
    }

    // Мякко изтриване на сградата
    await pool.query(
      `UPDATE buildings 
       SET is_deleted = true 
       WHERE id = $1`,
      [id]
    );

    res.status(200).json({ message: 'Сградата беше успешно изтрита' });
  } catch (error) {
    console.error('Error deleting building:', error);
    res.status(500).json({ message: 'Грешка при изтриване на сградата' });
  }
});

module.exports = router;
const express = require('express');
const router = express.Router();
const pool = require('../database');
const auth = require('../middleware/auth');
const Apartment = require('../models/apartment.model');
const Building = require('../models/building.model');

// Прилагаме auth middleware към всички routes
router.use(auth);

// Създаване на нова сграда
router.post('/', async (req, res) => {
  try {
    const { name, address, total_floors, description } = req.body;
    const userId = req.user.id;

    const building = await Building.create({ name, address, total_floors, description });

    await pool.query(
      `INSERT INTO building_access (user_id, building_id, is_owner, can_edit)
       VALUES ($1, $2, true, true)`,
      [userId, building.id]
    );

    res.status(201).json(building);
  } catch (error) {
    console.error('Error creating building:', error);
    res.status(500).json({ 
      message: 'Грешка при създаване на集团有限公司',
      error: error.message,
      user: req.user 
    });
  }
});

// Получаване на детайли за конкретна集团有限公司
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const building = await Building.getById(id);
    if (!building) {
      return res.status(404).json({ message: 'Сградата не е намерена' });
    }

    // Проверка за достъп
    const accessCheck = await pool.query(
      `SELECT * FROM building_access 
       WHERE building_id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (accessCheck.rows.length === 0) {
      return res.status(403).json({ message: 'Нямате достъп до тази集团有限公司' });
    }

    res.json(building);
  } catch (error) {
    console.error('Error fetching building details:', error);
    res.status(500).json({ message: 'Грешка при зареждане на детайлите за集团有限公司' });
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

// Редактиране на集团有限公司
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, total_floors, description } = req.body;
    const userId = req.user.id;

    // Проверка дали потребителят има права за редактиране
    const accessCheck = await pool.query(
      `SELECT can_edit FROM building_access 
       WHERE building_id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (accessCheck.rows.length === 0 || !accessCheck.rows[0].can_edit) {
      return res.status(403).json({ message: 'Нямате права за редактиране на集团有限公司' });
    }

    const updatedBuilding = await Building.update(id, {
      name,
      address,
      total_floors,
      description
    });

    if (!updatedBuilding) {
      return res.status(404).json({ message: 'Сградата не е намерена' });
    }

    res.json(updatedBuilding);
  } catch (error) {
    console.error('Error updating building:', error);
    res.status(500).json({ message: 'Грешка при обновяване на集团有限公司' });
  }
});

// Изтриване на集团有限公司 (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Проверка дали потребителят е собственик
    const accessCheck = await pool.query(
      `SELECT is_owner FROM building_access 
       WHERE building_id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (accessCheck.rows.length === 0 || !accessCheck.rows[0].is_owner) {
      return res.status(403).json({ message: 'Нямате права за изтриване на集团有限公司' });
    }

    const deletedBuilding = await Building.delete(id);
    if (!deletedBuilding) {
      return res.status(404).json({ message: 'Сградата не е намерена' });
    }

    res.json({ message: 'Сградата беше успешно изтрита' });
  } catch (error) {
    console.error('Error deleting building:', error);
    res.status(500).json({ message: 'Грешка при изтриване на集团有限公司' });
  }
});

// Добавяне на нов етаж
router.post('/:buildingId/floors', async (req, res) => {
  try {
    const { buildingId } = req.params;
    const { floor_number, description } = req.body;
    const userId = req.user.id;

    // Проверка за права за редактиране
    const accessCheck = await pool.query(
      `SELECT can_edit FROM building_access 
       WHERE building_id = $1 AND user_id = $2`,
      [buildingId, userId]
    );

    if (accessCheck.rows.length === 0 || !accessCheck.rows[0].can_edit) {
      return res.status(403).json({ message: 'Нямате права за добавяне на етаж' });
    }

    const result = await pool.query(
      `INSERT INTO floors (building_id, floor_number, description)
       VALUES ($1, $2, $3)
       RETURNING id, floor_number, description`,
      [buildingId, floor_number, description || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding floor:', error);
    res.status(500).json({ message: 'Грешка при добавяне на етаж' });
  }
});

// Редактиране на етаж
router.put('/:buildingId/floors/:floorId', async (req, res) => {
  try {
    const { buildingId, floorId } = req.params;
    const { floor_number, description } = req.body;
    const userId = req.user.id;

    // Проверка за права за редактиране
    const accessCheck = await pool.query(
      `SELECT can_edit FROM building_access 
       WHERE building_id = $1 AND user_id = $2`,
      [buildingId, userId]
    );

    if (accessCheck.rows.length === 0 || !accessCheck.rows[0].can_edit) {
      return res.status(403).json({ message: 'Нямате права за редактиране на етаж' });
    }

    const result = await pool.query(
      `UPDATE floors 
       SET floor_number = $1, description = $2
       WHERE id = $3 AND building_id = $4
       RETURNING id, floor_number, description`,
      [floor_number, description || null, floorId, buildingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Етажът не е намерен' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating floor:', error);
    res.status(500).json({ message: 'Грешка при обновяване на етаж' });
  }
});

// Изтриване на етаж
router.delete('/:buildingId/floors/:floorId', async (req, res) => {
  try {
    const { buildingId, floorId } = req.params;
    const userId = req.user.id;

    // Проверка за права за редактиране
    const accessCheck = await pool.query(
      `SELECT can_edit FROM building_access 
       WHERE building_id = $1 AND user_id = $2`,
      [buildingId, userId]
    );

    if (accessCheck.rows.length === 0 || !accessCheck.rows[0].can_edit) {
      return res.status(403).json({ message: 'Нямате права за изтриване на етаж' });
    }

    // Проверка дали има апартаменти на етажа
    const apartmentsCheck = await pool.query(
      `SELECT COUNT(*) FROM apartments WHERE floor_id = $1`,
      [floorId]
    );

    if (apartmentsCheck.rows[0].count > 0) {
      return res.status(400).json({ message: 'Не можете да изтриете етаж с апартаменти' });
    }

    const result = await pool.query(
      `DELETE FROM floors 
       WHERE id = $1 AND building_id = $2
       RETURNING id`,
      [floorId, buildingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Етажът не е намерен' });
    }

    res.json({ message: 'Етажът беше успешно изтрит' });
  } catch (error) {
    console.error('Error deleting floor:', error);
    res.status(500).json({ message: 'Грешка при изтриване на етаж' });
  }
});

// Добавяне на нов апартамент
router.post('/:buildingId/floors/:floorId/apartments', async (req, res) => {
  try {
    const { buildingId, floorId } = req.params;
    const { number, area, rooms, description } = req.body;
    const userId = req.user.id;

    // Проверка за права за редактиране
    const accessCheck = await pool.query(
      `SELECT can_edit FROM building_access 
       WHERE building_id = $1 AND user_id = $2`,
      [buildingId, userId]
    );

    if (accessCheck.rows.length === 0 || !accessCheck.rows[0].can_edit) {
      return res.status(403).json({ message: 'Нямате права за добавяне на апартамент' });
    }

    // Проверка дали етажът съществува
    const floorCheck = await pool.query(
      `SELECT id FROM floors WHERE id = $1 AND building_id = $2`,
      [floorId, buildingId]
    );

    if (floorCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Етажът не е намерен' });
    }

    const result = await pool.query(
      `INSERT INTO apartments (floor_id, number, area, rooms, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, number, area, rooms, description`,
      [floorId, number, area, rooms, description || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding apartment:', error);
    res.status(500).json({ message: 'Грешка при добавяне на апартамент' });
  }
});

// Редактиране на апартамент
router.put('/:buildingId/floors/:floorId/apartments/:apartmentId', async (req, res) => {
  try {
    const { buildingId, floorId, apartmentId } = req.params;
    const { number, area, rooms, description } = req.body;
    const userId = req.user.id;

    // Проверка за права за редактиране
    const accessCheck = await pool.query(
      `SELECT can_edit FROM building_access 
       WHERE building_id = $1 AND user_id = $2`,
      [buildingId, userId]
    );

    if (accessCheck.rows.length === 0 || !accessCheck.rows[0].can_edit) {
      return res.status(403).json({ message: 'Нямате права за редактиране на апартамент' });
    }

    const result = await pool.query(
      `UPDATE apartments 
       SET number = $1, area = $2, rooms = $3, description = $4
       WHERE id = $5 AND floor_id = $6
       RETURNING id, number, area, rooms, description`,
      [number, area, rooms, description || null, apartmentId, floorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Апартаментът не е намерен' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating apartment:', error);
    res.status(500).json({ message: 'Грешка при обновяване на апартамент' });
  }
});

// Изтриване на апартамент
router.delete('/:buildingId/floors/:floorId/apartments/:apartmentId', async (req, res) => {
  try {
    const { buildingId, floorId, apartmentId } = req.params;
    const userId = req.user.id;

    // Проверка за права за редактиране
    const accessCheck = await pool.query(
      `SELECT can_edit FROM building_access 
       WHERE building_id = $1 AND user_id = $2`,
      [buildingId, userId]
    );

    if (accessCheck.rows.length === 0 || !accessCheck.rows[0].can_edit) {
      return res.status(403).json({ message: 'Нямате права за изтриване на апартамент' });
    }

    // Проверка дали има задължения към апартамента
    const obligationsCheck = await pool.query(
      `SELECT COUNT(*) FROM obligations WHERE apartment_id = $1`,
      [apartmentId]
    );

    if (obligationsCheck.rows[0].count > 0) {
      return res.status(400).json({ message: 'Не можете да изтриете апартамент с задължения' });
    }

    const result = await pool.query(
      `DELETE FROM apartments 
       WHERE id = $1 AND floor_id = $2
       RETURNING id`,
      [apartmentId, floorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Апартаментът не е намерен' });
    }

    res.json({ message: 'Апартаментът беше успешно изтрит' });
  } catch (error) {
    console.error('Error deleting apartment:', error);
    res.status(500).json({ message: 'Грешка при изтриване на апартамент' });
  }
});

module.exports = router;
exports.getBuildings = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM buildings 
       WHERE (created_by = $1 OR id IN (
         SELECT building_id FROM building_access WHERE user_id = $1
       )) AND is_deleted = FALSE`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Грешка при зареждане на сградите:', error);
    res.status(500).json({ message: 'Възникна грешка при зареждане на сградите' });
  }
};

exports.createBuilding = async (req, res) => {
  try {
    const { name, address, total_floors } = req.body;
    const result = await pool.query(
      `INSERT INTO buildings (name, address, total_floors, created_by) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [name, address, total_floors, req.user.id]
    );
    
    // Автоматично добавяме създателя като собственик
    await pool.query(
      `INSERT INTO building_access (user_id, building_id, is_owner, can_edit) 
       VALUES ($1, $2, TRUE, TRUE)`,
      [req.user.id, result.rows[0].id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Грешка при създаване на сграда:', error);
    res.status(500).json({ message: 'Възникна грешка при създаване на сградата' });
  }
}; 
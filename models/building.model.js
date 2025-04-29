const pool = require('../config/db.config');

class Building {
  static async create(buildingData) {
    const { name, address, total_floors } = buildingData;
    const query = `
      INSERT INTO buildings (name, address, total_floors)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const values = [name, address, total_floors];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async getAll() {
    const query = 'SELECT * FROM buildings WHERE is_deleted = false';
    const result = await pool.query(query);
    return result.rows;
  }

  static async getById(id) {
    const query = 'SELECT * FROM buildings WHERE id = $1 AND is_deleted = false';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async update(id, buildingData) {
    const { name, address, total_floors, description } = buildingData;
    const query = `
      UPDATE buildings 
      SET name = $1, address = $2, total_floors = $3, description = $4
      WHERE id = $5 AND is_deleted = false
      RETURNING *
    `;
    const values = [name, address, total_floors, description || null, id];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async delete(id) {
    const query = `
      UPDATE buildings 
      SET is_deleted = true 
      WHERE id = $1 AND is_deleted = false
      RETURNING id
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = Building; 
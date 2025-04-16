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
    const query = 'SELECT * FROM buildings';
    const result = await pool.query(query);
    return result.rows;
  }

  static async getById(id) {
    const query = 'SELECT * FROM buildings WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = Building; 
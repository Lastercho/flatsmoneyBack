const pool = require('../config/db.config');

class Floor {
  static async create(floorData) {
    const { building_id, floor_number, total_apartments } = floorData;
    const query = `
      INSERT INTO floors (building_id, floor_number, total_apartments)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const values = [building_id, floor_number, total_apartments];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async getByBuildingId(buildingId) {
    const query = 'SELECT * FROM floors WHERE building_id = $1';
    const result = await pool.query(query, [buildingId]);
    return result.rows;
  }

  static async getById(id) {
    const query = 'SELECT * FROM floors WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }
}

module.exports = Floor; 
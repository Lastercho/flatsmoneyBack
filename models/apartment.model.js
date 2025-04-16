const pool = require('../config/db.config');

class Apartment {
  static async create(apartmentData) {
    const { floor_id, apartment_number, owner_name, area } = apartmentData;
    const query = `
      INSERT INTO apartments (floor_id, apartment_number, owner_name, area)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [floor_id, apartment_number, owner_name, area];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async getByFloorId(floorId) {
    const query = 'SELECT * FROM apartments WHERE floor_id = $1';
    const result = await pool.query(query, [floorId]);
    return result.rows;
  }

  static async getById(id) {
    const query = 'SELECT * FROM apartments WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async addDeposit(apartmentId, depositData) {
    const { amount, date, description } = depositData;
    const query = `
      INSERT INTO deposits (apartment_id, amount, date, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [apartmentId, amount, date, description];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async addObligation(apartmentId, obligationData) {
    const { amount, due_date, description } = obligationData;
    const query = `
      INSERT INTO obligations (apartment_id, amount, due_date, description)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [apartmentId, amount, due_date, description];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async getDeposits(apartmentId) {
    const query = 'SELECT * FROM deposits WHERE apartment_id = $1 ORDER BY date DESC';
    const result = await pool.query(query, [apartmentId]);
    return result.rows;
  }

  static async getObligations(apartmentId) {
    const query = 'SELECT * FROM obligations WHERE apartment_id = $1 ORDER BY due_date ASC';
    const result = await pool.query(query, [apartmentId]);
    return result.rows;
  }
}

module.exports = Apartment; 
const db = require('../config/database');

class User {
  static async create(userData) {
    const { email, name, googleId, timezone } = userData;
    
    const query = `
      INSERT INTO users (email, name, google_id, timezone, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `;
    
    const values = [email, name, googleId, timezone];
    
    try {
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating user:', error);
      throw new Error('Failed to create user');
    }
  }

  static async findByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    
    try {
      const result = await db.query(query, [email]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw new Error('Failed to find user');
    }
  }

  static async verifyPassword(email, password) {
    const user = await this.findByEmail(email);
    if (!user || !user.password_hash) {
      return null;
    }
    
    const isValid = await bcrypt.compare(password, user.password_hash);
    return isValid ? user : null;
  }

  static async findById(id) {
    const query = 'SELECT * FROM users WHERE id = $1';
    
    try {
      const result = await db.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw new Error('Failed to find user');
    }
  }

  static async update(id, updateData) {
    const { name, timezone } = updateData;
    
    const query = `
      UPDATE users 
      SET name = COALESCE($2, name), 
          timezone = COALESCE($3, timezone),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const values = [id, name, timezone];
    
    try {
      const result = await db.query(query, values);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error updating user:', error);
      throw new Error('Failed to update user');
    }
  }

  static async delete(id) {
    const query = 'DELETE FROM users WHERE id = $1 RETURNING *';
    
    try {
      const result = await db.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Failed to delete user');
    }
  }

  static async findAll() {
    const query = 'SELECT * FROM users ORDER BY created_at DESC';
    
    try {
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      console.error('Error finding all users:', error);
      throw new Error('Failed to find users');
    }
  }

  static async search(query, excludeIds = []) {
    const searchQuery = `
      SELECT id, name, email
      FROM users
      WHERE (
        LOWER(name) LIKE LOWER($1) OR
        LOWER(email) LIKE LOWER($1)
      )
      AND google_id IS NOT NULL
      ${excludeIds.length > 0 ? 'AND id != ALL($2)' : ''}
      ORDER BY name
      LIMIT 10
    `;

    try {
      const params = [`%${query}%`];
      if (excludeIds.length > 0) {
        params.push(excludeIds);
      }

      const result = await db.query(searchQuery, params);
      return result.rows;
    } catch (error) {
      console.error('Error searching users:', error);
      throw new Error('Failed to search users');
    }
  }
}

module.exports = User; 
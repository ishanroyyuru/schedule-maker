require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const migrations = [
  '001_create_users_table.sql',
  '002_create_calendar_connections_table.sql',
  '003_create_calendar_events_table.sql',
  '004_add_calendar_summary.sql',
  '005_add_calendar_color.sql',
  '006_create_friends_table.sql'
];

async function runMigrations() {
  try {
    console.log('Connecting to Neon database...');
    await pool.query('SELECT 1');
    console.log('✅ Connected to Neon database successfully!');
    
    for (const migration of migrations) {
      const filePath = path.join(__dirname, '..', 'database', 'migrations', migration);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      console.log(`\n🔄 Running migration: ${migration}`);
      await pool.query(sql);
      console.log(`✅ Migration ${migration} completed successfully!`);
    }
    
    console.log('\n🎉 All migrations completed successfully!');
    
    // Show tables
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('\n📋 Database tables:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations(); 
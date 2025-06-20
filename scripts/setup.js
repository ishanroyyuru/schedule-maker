const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
  console.log('🚀 Setting up database...');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set!');
    console.log('Please create a .env file with your database configuration.');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  try {
    // Read and execute migration files
    const migrationsDir = path.join(__dirname, '../database/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      console.log(`📄 Running migration: ${file}`);
      const migrationPath = path.join(migrationsDir, file);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      await pool.query(migrationSQL);
      console.log(`✅ Migration ${file} completed successfully`);
    }

    console.log('🎉 Database setup completed successfully!');
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
  } finally {
    await pool.end();
  }
}

function printSetupInstructions() {
  console.log('\n📋 Setup Instructions:');
  console.log('=====================\n');
  
  console.log('1. 📝 Create a .env file:');
  console.log('   Copy env.example to .env and fill in your configuration\n');
  
  console.log('2. 🔐 Set up Google OAuth:');
  console.log('   a) Go to https://console.developers.google.com/');
  console.log('   b) Create a new project or select existing one');
  console.log('   c) Enable Google Calendar API');
  console.log('   d) Create OAuth 2.0 credentials');
  console.log('   e) Add authorized redirect URI: http://localhost:3001/api/auth/google/callback');
  console.log('   f) Copy Client ID and Client Secret to your .env file\n');
  
  console.log('3. 🗄️  Set up PostgreSQL database:');
  console.log('   a) Install PostgreSQL if not already installed');
  console.log('   b) Create a new database');
  console.log('   c) Update DATABASE_URL in your .env file\n');
  
  console.log('4. 📦 Install dependencies:');
  console.log('   npm install\n');
  
  console.log('5. 🚀 Start the server:');
  console.log('   npm run dev\n');
  
  console.log('6. 🌐 Test the API:');
  console.log('   GET http://localhost:3001/api/health\n');
}

async function main() {
  console.log('🎯 Schedule Maker Setup\n');
  
  // Check if .env file exists
  if (!fs.existsSync('.env')) {
    console.log('⚠️  .env file not found!');
    printSetupInstructions();
    return;
  }

  // Setup database
  await setupDatabase();
  
  // Print additional instructions
  printSetupInstructions();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { setupDatabase }; 
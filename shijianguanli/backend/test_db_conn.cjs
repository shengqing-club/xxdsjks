const mysql = require('mysql2/promise');
require('dotenv').config();

async function test() {
  const url = process.env.DATABASE_URL;
  console.log('Connecting to:', url);
  
  const u = new URL(url);
  const config = {
    host: u.hostname,
    port: parseInt(u.port) || 3306,
    user: u.username,
    password: u.password,
    database: u.pathname.replace(/^\//, ''),
  };
  
  console.log('Config:', JSON.stringify(config, null, 2));
  
  try {
    const pool = mysql.createPool({...config, connectionLimit: 1});
    const [rows] = await pool.query('SELECT 1 as test');
    console.log('Connected! Result:', rows);
    await pool.end();
  } catch(e) {
    console.error('Connection failed:', e.message);
  }
}
test();

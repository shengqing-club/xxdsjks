const mysql = require('mysql2/promise');

async function test() {
  try {
    console.log('Testing MySQL connection from PM2-like environment...');
    const pool = mysql.createPool({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: 'admin123',
      database: 'student_management',
      connectionLimit: 1
    });
    const [rows] = await pool.query('SELECT 1 as test');
    console.log('Success:', rows);
    await pool.end();
  } catch(e) {
    console.error('Failed:', e.message);
  }
}
test();

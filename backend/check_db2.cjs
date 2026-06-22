const mysql = require('mysql2/promise');

async function test() {
  try {
    const c = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'admin123',
      database: 'student_management'
    });
    const [rows] = await c.execute('SHOW TABLES');
    console.log('Tables:', rows.length);
    rows.forEach(r => console.log('  ', r[Object.keys(r)[0]]));
    
    const [s] = await c.execute('SELECT COUNT(*) as c FROM students');
    console.log('Students:', s[0].c);
    
    const [u] = await c.execute('SELECT COUNT(*) as c FROM users');
    console.log('Users:', u[0].c);
    
    await c.end();
  } catch(e) {
    console.error('Error:', e.message);
  }
}
test();

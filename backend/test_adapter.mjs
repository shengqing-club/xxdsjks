
import pool from './db.js';
console.log('Pool created, testing query...');
try {
  const r = await pool.query('SELECT 1 as test');
  console.log('Query OK:', JSON.stringify(r));
} catch(e) {
  console.error('Query ERROR:', e.message, e.stack);
}
process.exit(0);

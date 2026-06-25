import pool from './db.js'

const r = await pool.query("SELECT student_id, name, password_hash FROM students WHERE student_id = '2024002'")
console.log(r.rows)

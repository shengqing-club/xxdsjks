import pool from './db.js'
import bcrypt from 'bcryptjs'

const passwords = ['2024002', '123456', 'password', '000000', '111111', 'abc123']
const r = await pool.query("SELECT student_id, password_hash FROM students WHERE student_id = '2024002'")
const hash = r.rows[0]?.password_hash

for (const pwd of passwords) {
  const valid = await bcrypt.compare(pwd, hash)
  if (valid) {
    console.log('Password found:', pwd)
    break
  }
}
console.log('Done checking')

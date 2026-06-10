import pool from './db.js'

const r = await pool.query(
  `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position`,
  ['majors']
)
console.log(r.rows)
await pool.end()

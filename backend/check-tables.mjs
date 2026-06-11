import pool from './db.js'

const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
console.log(r.rows.map(x => x.table_name))

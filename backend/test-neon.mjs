import pg from 'pg'

const pool = new pg.Pool({
  connectionString: 'postgresql://neondb_owner:npg_AvOmIHM5wDt8@ep-flat-hat-ao566lsu-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  max: 3,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false }
})

try {
  const r = await pool.query('SELECT current_database(), current_user')
  console.log('连接成功! 数据库:', r.rows[0].current_database, '用户:', r.rows[0].current_user)
  const tables = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
  console.log('表数量:', tables.rows.length)
  for (const t of tables.rows) console.log(' ', t.table_name)
} catch(e) {
  console.error('失败:', e.message)
}
await pool.end()

import { Pool } from 'pg'

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_AvOmIHM5wDt8@ep-flat-hat-ao566lsu-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  max: 1,
})

const r = await pool.query('SELECT id, name, code, class_names FROM majors ORDER BY id')
console.log('当前 majors 表数据：')
r.rows.forEach(row => console.log(`  id=${row.id} name="${row.name}" code="${row.code}" class_names="${row.class_names || '(空)'}"`))
await pool.end()

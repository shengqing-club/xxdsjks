import 'dotenv/config'
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
})

const data = {
  '计算机科学与技术': '计科2401,计科2402,计科2403',
  '软件工程': '软工2401,软工2402',
  '人工智能': '人工智能2401',
  '电子信息工程': '电信2401,电信2402',
  '通信工程': '通信2401,通信2402',
  '物联网工程': '物联2401',
  '数据科学与大数据': '数据2401',
}

for (const [name, classes] of Object.entries(data)) {
  const r = await pool.query('UPDATE majors SET class_names = $1 WHERE name = $2', [classes, name])
  if (r.rowCount > 0) console.log(`  ✓ ${name} ← ${classes}`)
}

console.log('\n完成！')
const check = await pool.query('SELECT name, class_names FROM majors')
check.rows.forEach(r => console.log(`  ${r.name}: ${r.class_names || '(空)'}`))
await pool.end()

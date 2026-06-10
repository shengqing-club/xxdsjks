import { Pool } from 'pg'

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_AvOmIHM5wDt8@ep-flat-hat-ao566lsu-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  max: 1,
})

// 检查并添加 class_names 字段
const r = await pool.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name = 'majors' AND column_name = 'class_names'`
)
if (r.rows.length === 0) {
  await pool.query(`ALTER TABLE majors ADD COLUMN class_names TEXT DEFAULT ''`)
  console.log('✓ 已添加 class_names 字段')
} else {
  console.log('class_names 字段已存在')
}

// 写入示例班级数据
const classes = {
  '计科': '计科2401,计科2402,计科2403',
  '软工': '软工2401,软工2402',
  '人工智能': '人工智能2401',
  '通信': '通信2401,通信2402',
  '数据': '数据2401',
  '智能': '智能2401',
  '物联': '物联2401',
}
for (const [name, cn] of Object.entries(classes)) {
  const r = await pool.query('UPDATE majors SET class_names = $1 WHERE name = $2', [cn, name])
  if (r.rowCount > 0) console.log(`  ✓ ${name} ← ${cn}`)
}

const check = await pool.query('SELECT name, class_names FROM majors')
console.log('\n当前数据:')
check.rows.forEach(r => console.log(`  ${r.name}: ${r.class_names || '(空)'}`))

await pool.end()
console.log('\n完成！')

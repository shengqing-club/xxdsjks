import pool from './db.js'

async function fix() {
  try {
    await pool.query(`ALTER TABLE study_materials ALTER COLUMN file_type TYPE VARCHAR(200)`)
    console.log('file_type 字段已扩展为 VARCHAR(200)')
  } catch (e) {
    console.error('修复失败:', e.message)
  } finally {
    await pool.end()
  }
}
fix()

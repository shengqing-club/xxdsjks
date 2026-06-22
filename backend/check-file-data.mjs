import pool from './db.js'

async function check() {
  // 检查file_data的实际存储
  const r = await pool.query(
    "SELECT id, title, file_name, file_size, file_type, pg_column_size(file_data) as data_size, length(file_data::text) as text_length FROM study_materials WHERE id = 40"
  )
  if (r.rows.length === 0) { console.log('id=40 不存在'); return }
  const row = r.rows[0]
  console.log('id:', row.id)
  console.log('title:', row.title)
  console.log('file_name:', row.file_name)
  console.log('file_size:', row.file_size)
  console.log('file_type:', row.file_type)
  console.log('pg_column_size(file_data):', row.data_size)
  console.log('length(file_data::text):', row.text_length)

  // 获取原始file_data检查类型
  const r2 = await pool.query("SELECT file_data FROM study_materials WHERE id = 40")
  const fd = r2.rows[0].file_data
  console.log('\nfile_data type:', typeof fd)
  console.log('file_data isBuffer:', Buffer.isBuffer(fd))
  if (Buffer.isBuffer(fd)) {
    console.log('Buffer length:', fd.length)
    console.log('First 4 bytes:', [fd[0], fd[1], fd[2], fd[3]])
  } else if (typeof fd === 'string') {
    console.log('String length:', fd.length)
    console.log('Starts with:', fd.substring(0, 20))
  }

  await pool.end()
}
check().catch(console.error)

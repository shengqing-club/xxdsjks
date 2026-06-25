import pool from './db.js'

async function check() {
  console.log('========== 数据库检查 ==========\n')

  // 1. 表列表
  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  )
  console.log('数据库表列表:')
  for (const t of tables.rows) {
    const cnt = await pool.query('SELECT COUNT(*) FROM "' + t.table_name + '"')
    console.log('  ' + t.table_name + ': ' + cnt.rows[0].count + ' 条')
  }

  // 2. 检查冗余数据
  console.log('\n--- 冗余数据检查 ---')

  // 检查重复学号
  const dupStudents = await pool.query(
    'SELECT student_id, COUNT(*) FROM students GROUP BY student_id HAVING COUNT(*) > 1'
  )
  console.log('重复学号:', dupStudents.rows.length > 0 ? dupStudents.rows : '无')

  // 检查无效复习资料记录
  const files = await pool.query('SELECT id, file_data FROM study_materials')
  let invalidFiles = 0
  for (const f of files.rows) {
    if (!f.file_data) invalidFiles++
  }
  console.log('无效复习资料记录（无文件数据）:', invalidFiles)

  // 检查无效文件共享记录
  const files2 = await pool.query('SELECT id, file_path FROM files')
  let invalidFiles2 = 0
  for (const f of files2.rows) {
    if (!f.file_path) invalidFiles2++
  }
  console.log('无效文件共享记录（无文件路径）:', invalidFiles2)

  // 检查孤立通知
  const orphanNotices = await pool.query(
    'SELECT n.id FROM notifications n LEFT JOIN students s ON n.sender_id = s.student_id WHERE s.id IS NULL AND n.sender_id IS NOT NULL'
  )
  console.log('孤立通知（发送者不存在）:', orphanNotices.rows.length)

  // 检查空消息
  const emptyMsgs = await pool.query(
    "SELECT COUNT(*) FROM chat_messages WHERE content IS NULL AND image_url IS NULL"
  )
  console.log('空聊天消息记录:', emptyMsgs.rows[0].count)

  // 检查过期考试
  const expiredExams = await pool.query(
    "SELECT COUNT(*) FROM exams WHERE exam_date < CURRENT_DATE - INTERVAL '1 year'"
  )
  console.log('1年前过期考试:', expiredExams.rows[0].count)

  // 3. 数据库大小
  const size = await pool.query(
    "SELECT pg_size_pretty(pg_database_size(current_database())) as size"
  )
  console.log('\n数据库总大小:', size.rows[0].size)

  // 4. 检查重复表（student vs students）
  console.log('\n--- 重复表检查 ---')
  const studentCount = await pool.query('SELECT COUNT(*) FROM student')
  const studentsCount = await pool.query('SELECT COUNT(*) FROM students')
  console.log('student 表:', studentCount.rows[0].count, '条')
  console.log('students 表:', studentsCount.rows[0].count, '条')
  if (studentCount.rows[0].count > 0 && studentsCount.rows[0].count > 0) {
    console.log('⚠️ 警告：同时存在 student 和 students 两张表，可能冗余')
  }

  const gradeCount = await pool.query('SELECT COUNT(*) FROM grade')
  const gradesCount = await pool.query('SELECT COUNT(*) FROM grades')
  console.log('grade 表:', gradeCount.rows[0].count, '条')
  console.log('grades 表:', gradesCount.rows[0].count, '条')
  if (gradeCount.rows[0].count > 0 && gradesCount.rows[0].count > 0) {
    console.log('⚠️ 警告：同时存在 grade 和 grades 两张表，可能冗余')
  }

  await pool.end()
}

check().catch(e => { console.error(e); process.exit(1) })

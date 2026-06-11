import pool from './db.js'

async function clean() {
  console.log('========== 数据库清理 ==========\n')

  // 1. 删除重复表 student 的数据（保留 students）
  const sc = await pool.query('SELECT COUNT(*) FROM student')
  if (parseInt(sc.rows[0].count) > 0) {
    await pool.query('DELETE FROM student')
    console.log('已清空 student 旧表（' + sc.rows[0].count + ' 条）')
  }

  // 2. 删除重复表 grade 的数据（保留 grades）
  const gc = await pool.query('SELECT COUNT(*) FROM grade')
  if (parseInt(gc.rows[0].count) > 0) {
    await pool.query('DELETE FROM grade')
    console.log('已清空 grade 旧表（' + gc.rows[0].count + ' 条）')
  }

  // 3. 删除 sys_user 旧表数据
  const suc = await pool.query('SELECT COUNT(*) FROM sys_user')
  if (parseInt(suc.rows[0].count) > 0) {
    await pool.query('DELETE FROM sys_user')
    console.log('已清空 sys_user 旧表（' + suc.rows[0].count + ' 条）')
  }

  // 4. 删除 file_record 旧表数据
  const frc = await pool.query('SELECT COUNT(*) FROM file_record')
  if (parseInt(frc.rows[0].count) > 0) {
    await pool.query('DELETE FROM file_record')
    console.log('已清空 file_record 旧表（' + frc.rows[0].count + ' 条）')
  }

  // 5. 清理过期通知（3个月前的）
  const oldNotices = await pool.query("DELETE FROM notifications WHERE created_at < CURRENT_DATE - INTERVAL '3 months' RETURNING id")
  console.log('已删除 ' + oldNotices.rowCount + ' 条3个月前的旧通知')

  console.log('\n清理完成！')
  await pool.end()
}

clean().catch(e => { console.error(e); process.exit(1) })

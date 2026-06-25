import pool from '../db.js'

async function migrate() {
  try {
    // 1. 创建 classes 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        major_id INTEGER REFERENCES majors(id) ON DELETE SET NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('classes 表已创建')

    // 2. 从 majors.class_names 迁移现有班级数据
    const { rows: majors } = await pool.query('SELECT id, name, class_names FROM majors WHERE class_names IS NOT NULL AND class_names != \'\'')
    let migrated = 0
    for (const major of majors) {
      const classNames = major.class_names.split(',').map(c => c.trim()).filter(Boolean)
      for (const className of classNames) {
        try {
          await pool.query(
            'INSERT INTO classes (name, major_id, description) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
            [className, major.id, `隶属于 ${major.name}`]
          )
          migrated++
        } catch (e) {
          console.warn(`迁移班级 ${className} 失败:`, e.message)
        }
      }
    }
    console.log(`已迁移 ${migrated} 个班级`)

    // 3. 检查是否已有数据
    const { rows } = await pool.query('SELECT COUNT(*) as c FROM classes')
    console.log(`classes 表现有 ${rows[0].c} 条记录`)

  } catch (e) {
    console.error('迁移失败:', e)
  } finally {
    await pool.end()
  }
}

migrate()

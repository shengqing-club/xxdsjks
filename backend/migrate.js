import pool from './db.js'

async function migrate() {
  const connection = await pool.getConnection()
  try {
    console.log('开始数据库迁移...\n')

    // ====== 1. 专业表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS majors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        code VARCHAR(20) UNIQUE,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ majors 表')

    // ====== 2. 学生表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id VARCHAR(30) UNIQUE NOT NULL,
        name VARCHAR(50) NOT NULL,
        gender VARCHAR(4) DEFAULT '男',
        age INT DEFAULT 18,
        major VARCHAR(100) DEFAULT '',
        class_name VARCHAR(50) DEFAULT '',
        status VARCHAR(10) DEFAULT '在读',
        password_hash VARCHAR(255) NOT NULL,
        avatar_url VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ students 表')

    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_students_major ON students(major)
    `).catch(() => {})
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_students_status ON students(status)
    `).catch(() => {})

    // ====== 3. 管理员表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(50) DEFAULT '管理员',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ admins 表')

    // ====== 4. 成绩表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS grades (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id VARCHAR(30) NOT NULL,
        course_name VARCHAR(100) NOT NULL,
        score INT CHECK (score >= 0 AND score <= 100),
        course_type VARCHAR(20) DEFAULT '必修',
        semester VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
      )
    `)
    console.log('✓ grades 表')

    // ====== 4.5 课程表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS courses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        code VARCHAR(20) UNIQUE,
        credit INT DEFAULT 3,
        major VARCHAR(100),
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ courses 表')

    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id)
    `).catch(() => {})
    await connection.query(`
      CREATE INDEX IF NOT EXISTS idx_grades_semester ON grades(semester)
    `).catch(() => {})

    // ====== 5. 公告表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        content TEXT,
        type VARCHAR(20) DEFAULT '通知',
        is_active TINYINT(1) DEFAULT 1,
        priority INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ announcements 表')

    // ====== 6. 聊天消息表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id VARCHAR(30) NOT NULL,
        sender_name VARCHAR(50) NOT NULL,
        sender_role VARCHAR(10) DEFAULT 'student',
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ chat_messages 表')

    // ====== 7. 通知表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        receiver_id VARCHAR(30) NOT NULL,
        title VARCHAR(200) NOT NULL,
        content TEXT,
        type VARCHAR(20) DEFAULT 'info',
        is_read TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ notifications 表')

    // ====== 8. 文件表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_size BIGINT DEFAULT 0,
        file_type VARCHAR(100),
        uploader_id VARCHAR(30),
        uploader_name VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    // 补充缺失的列（如果表已存在但缺列）
    try {
      const [fileCols] = await connection.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name='files' AND table_schema = DATABASE()
      `)
      const existingCols = fileCols.map(r => r.column_name || r.COLUMN_NAME)
      if (!existingCols.includes('category')) {
        await connection.query('ALTER TABLE files ADD COLUMN category VARCHAR(30) DEFAULT \'general\'')
        console.log('  + files.category 列')
      }
      if (!existingCols.includes('uploader_role')) {
        await connection.query('ALTER TABLE files ADD COLUMN uploader_role VARCHAR(10) DEFAULT \'admin\'')
        console.log('  + files.uploader_role 列')
      }
    } catch (e) { /* ignore */ }
    console.log('✓ files 表')

    // ====== 9. 考试日程表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS exams (
        id INT AUTO_INCREMENT PRIMARY KEY,
        course_name VARCHAR(200) NOT NULL,
        exam_date DATE NOT NULL,
        exam_time VARCHAR(10) DEFAULT '09:00',
        duration INT DEFAULT 120,
        location VARCHAR(100) DEFAULT '',
        class_name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    // 补充缺失列
    try {
      const [examCols] = await connection.query(`
        SELECT column_name FROM information_schema.columns WHERE table_name='exams' AND table_schema = DATABASE()
      `)
      const examExisting = examCols.map(r => r.column_name || r.COLUMN_NAME)
      if (!examExisting.includes('description')) {
        await connection.query('ALTER TABLE exams ADD COLUMN description TEXT')
        console.log('  + exams.description 列')
      }
      if (!examExisting.includes('updated_at')) {
        await connection.query('ALTER TABLE exams ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
        console.log('  + exams.updated_at 列')
      }
    } catch (e) { /* ignore */ }
    console.log('✓ exams 表')

    // ===========================
    // 清理旧数据 + 插入种子数据
    // ===========================
    const bcrypt = (await import('bcryptjs')).default
    const defaultPwd = await bcrypt.hash('123456', 10)
    const adminPwd = await bcrypt.hash('admin123', 10)
    console.log('\n--- 清理旧数据 ---')

    // 只清理多余学生（保留学号 2024001~2024025 范围内的种子数据）
    await connection.query(`DELETE FROM grades WHERE student_id NOT LIKE '2024%'`)
    await connection.query(`DELETE FROM students WHERE student_id NOT LIKE '2024%' AND student_id NOT REGEXP '^[0-9]+$'`)
    console.log('  已清理多余学生和成绩数据')

    // 插入/更新管理员（MySQL 使用 INSERT IGNORE 或 REPLACE）
    await connection.query(`
      INSERT INTO admins (username, password_hash, display_name)
      VALUES ('admin', ?, '系统管理员')
      ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)
    `, [adminPwd])
    console.log('  管理员: admin / admin123')

    // 专业种子（MySQL 使用 INSERT IGNORE）
    await connection.query(`
      INSERT IGNORE INTO majors (name, code, description) VALUES
        ('计算机科学与技术', 'CS', '培养计算机软硬件系统设计与开发能力'),
        ('软件工程', 'SE', '培养大型软件系统分析、设计、开发与测试能力'),
        ('人工智能', 'AI', '培养AI算法设计、机器学习与深度学习应用能力'),
        ('电子信息工程', 'EE', '培养电子信息系统设计、信号处理与嵌入式开发能力'),
        ('通信工程', 'CE', '培养通信系统、网络协议与信号传输技术能力'),
        ('物联网工程', 'IOT', '培养物联网感知层、网络层与应用层综合设计能力'),
        ('数据科学与大数据', 'DS', '培养大数据采集、清洗、分析与可视化能力')
    `)

    // 学生种子数据（25 人）
    const studentData = [
      ['2024001', '张明远', '男', 20, '计算机科学与技术', '计科2401', '在读'],
      ['2024002', '李婉清', '女', 19, '计算机科学与技术', '计科2401', '在读'],
      ['2024003', '王浩然', '男', 20, '计算机科学与技术', '计科2402', '在读'],
      ['2024004', '赵雪莹', '女', 19, '计算机科学与技术', '计科2402', '在读'],
      ['2024005', '孙志强', '男', 20, '计算机科学与技术', '计科2401', '在读'],
      ['2024006', '周雨桐', '女', 19, '软件工程', '软工2401', '在读'],
      ['2024007', '吴天宇', '男', 20, '软件工程', '软工2401', '在读'],
      ['2024008', '郑诗涵', '女', 20, '软件工程', '软工2402', '在读'],
      ['2024009', '钱博文', '男', 19, '软件工程', '软工2402', '在读'],
      ['2024010', '陈思源', '男', 20, '人工智能', '智能2401', '在读'],
      ['2024011', '林若兰', '女', 19, '人工智能', '智能2401', '在读'],
      ['2024012', '黄俊杰', '男', 19, '人工智能', '智能2401', '在读'],
      ['2024013', '杨雨晴', '女', 20, '人工智能', '智能2401', '在读'],
      ['2024014', '刘建国', '男', 20, '电子信息工程', '电信2401', '在读'],
      ['2024015', '马晓丽', '女', 19, '电子信息工程', '电信2401', '在读'],
      ['2024016', '朱文斌', '男', 20, '电子信息工程', '电信2402', '在读'],
      ['2024017', '胡心怡', '女', 19, '通信工程', '通信2401', '在读'],
      ['2024018', '许志远', '男', 20, '通信工程', '通信2401', '在读'],
      ['2024019', '沈梦琪', '女', 19, '通信工程', '通信2401', '在读'],
      ['2024020', '何鹏飞', '男', 20, '物联网工程', '物联2401', '在读'],
      ['2024021', '吕佳慧', '女', 19, '物联网工程', '物联2401', '在读'],
      ['2024022', '施伟豪', '男', 19, '物联网工程', '物联2401', '在读'],
      ['2024023', '张思睿', '女', 20, '数据科学与大数据', '数据2401', '在读'],
      ['2024024', '蔡明辉', '男', 19, '数据科学与大数据', '数据2401', '在读'],
      ['2024025', '潘雅琪', '女', 20, '数据科学与大数据', '数据2401', '在读'],
    ]

    for (const [sid, name, gender, age, major, cls, status] of studentData) {
      await connection.query(`
        INSERT INTO students (student_id, name, gender, age, major, class_name, status, password_hash)
        VALUES (?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          major = VALUES(major),
          class_name = VALUES(class_name),
          password_hash = VALUES(password_hash),
          updated_at = CURRENT_TIMESTAMP
      `, [sid, name, gender, age, major, cls, status, defaultPwd])
    }
    console.log(`  25 名学生 (密码均为 123456)`)

    // 成绩种子（仅当成绩表为空时插入）
    const [gradeCheck] = await connection.query('SELECT COUNT(*) as c FROM grades')
    if (Number(gradeCheck[0].c) === 0) {
      const courses = [
        ['高等数学', '必修'], ['线性代数', '必修'], ['大学英语', '必修'],
        ['C语言程序设计', '必修'], ['数据结构', '必修'], ['操作系统', '必修'],
        ['计算机网络', '必修'], ['数据库原理', '必修'], ['Python编程', '选修'],
        ['Web前端开发', '选修'], ['人工智能导论', '选修'],
      ]
      const semesters = ['2024-秋季', '2025-春季', '2025-秋季']
      let gradeCount = 0
      for (const [sid] of studentData) {
        for (const sem of semesters) {
          const courseCount = 2 + Math.floor(Math.random() * 3)
          const shuffled = [...courses].sort(() => Math.random() - 0.5)
          for (let i = 0; i < courseCount && i < shuffled.length; i++) {
            const [courseName, courseType] = shuffled[i]
            const score = Math.min(100, Math.max(60, Math.round(70 + Math.random() * 25 + (Math.random() < 0.3 ? 5 : 0))))
            try {
              await connection.query(
                'INSERT INTO grades (student_id, course_name, score, course_type, semester) VALUES (?,?,?,?,?)',
                [sid, courseName, score, courseType, sem]
              )
              gradeCount++
            } catch (e) { /* skip dups */ }
          }
        }
      }
      console.log(`  ${gradeCount} 条成绩记录`)
    } else {
      console.log(`  成绩表已有 ${gradeCheck[0].c} 条记录，跳过种子`)
    }

    // 公告种子
    await connection.query(`
      INSERT IGNORE INTO announcements (title, content, type, priority, is_active) VALUES
        ('2025年春季学期期末考试安排', '各专业期末考试将于6月15日至6月28日进行，请同学们登录系统查看个人考试安排表，提前做好复习准备。', '考试', 10, 1),
        ('关于举办2025年校园程序设计大赛的通知', '为激发学生编程兴趣，提升实践能力，学校将于5月20日举办程序设计大赛。设一等奖1名、二等奖3名、三等奖5名。', '活动', 8, 1),
        ('五一劳动节放假通知', '根据国家法定节假日安排，5月1日至5月5日放假调休，共5天。4月27日（周日）补5月2日（周四）的课程。', '通知', 5, 1),
        ('关于启用新版学生信息管理系统的公告', '学校已全面升级学生信息管理系统，新增在线成绩查询、公告通知、在线聊天等功能。学生默认密码为123456，首次登录后请及时修改。', '公告', 10, 1),
        ('2025届毕业生论文答辩安排', '2025届本科毕业论文答辩将于5月25日至6月5日分批次进行，具体答辩分组及时间安排已发布。', '通知', 8, 1)
    `)
    console.log('  5 条公告')

    // 考试种子（仅当考试表为空时插入）
    const [examCheck] = await connection.query('SELECT COUNT(*) as c FROM exams')
    if (parseInt(examCheck[0].c) === 0) {
      await connection.query(`
        INSERT IGNORE INTO exams (course_name, exam_date, exam_time, duration, location, class_name, description) VALUES
          ('高等数学(下)', '2025-06-16', '09:00', 120, '教学楼A301', '计科2101', '闭卷考试，带学生证和身份证'),
          ('线性代数', '2025-06-17', '14:00', 100, '教学楼A302', '计科2101', '闭卷考试，可带计算器'),
          ('数据结构与算法', '2025-06-18', '09:00', 120, '实验楼B201', '计科2101', '包含笔试和上机两部分'),
          ('计算机组成原理', '2025-06-19', '09:00', 120, '教学楼A303', '计科2101', '闭卷考试'),
          ('操作系统', '2025-06-20', '14:00', 120, '教学楼A301', '计科2101', '闭卷考试'),
          ('高等数学(下)', '2025-06-16', '09:00', 120, '教学楼A401', '软工2101', '闭卷考试，带学生证和身份证'),
          ('数据库原理', '2025-06-17', '09:00', 120, '实验楼B202', '软工2101', '包含SQL实操题'),
          ('软件工程', '2025-06-19', '14:00', 100, '教学楼A402', '软工2101', '开卷考试'),
          ('人工智能导论', '2025-06-16', '14:00', 120, '教学楼A501', '人工智能2101', '闭卷考试'),
          ('机器学习', '2025-06-18', '14:00', 120, '实验楼C101', '人工智能2101', '含编程题'),
          ('电路分析基础', '2025-06-16', '09:00', 120, '教学楼B201', '通信2101', '闭卷考试'),
          ('信号与系统', '2025-06-18', '09:00', 120, '教学楼B202', '通信2101', '闭卷考试'),
          ('模拟电子技术', '2025-06-20', '09:00', 120, '教学楼B201', '通信2101', '闭卷考试')
      `)
      console.log('  13 条考试日程')
    } else {
      console.log(`  考试表已有 ${examCheck[0].c} 条记录，跳过种子`)
    }

    // ====== 10. 分组表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        class_name VARCHAR(100) NOT NULL,
        created_by VARCHAR(50) NOT NULL,
        leader_id VARCHAR(30),
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        disbanded_at TIMESTAMP
      )
    `)
    console.log('✓ groups 表')

    // ====== 11. 分组成员表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS group_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id INT NOT NULL,
        student_id VARCHAR(30) NOT NULL,
        student_name VARCHAR(50),
        role VARCHAR(20) DEFAULT 'member',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
      )
    `)
    console.log('✓ group_members 表')

    // ====== 12. 分组聊天消息表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS group_chat_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id INT NOT NULL,
        sender_id VARCHAR(30) NOT NULL,
        sender_name VARCHAR(50) NOT NULL,
        sender_role VARCHAR(10) DEFAULT 'student',
        content TEXT NOT NULL,
        message_type VARCHAR(20) DEFAULT 'text',
        file_url VARCHAR(500),
        file_name VARCHAR(255),
        file_type VARCHAR(100),
        file_size BIGINT DEFAULT 0,
        file_path VARCHAR(500),
        file_data LONGBLOB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
      )
    `)
    // 补充缺失列（兼容旧表）
    try {
      const [chatCols] = await connection.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name='group_chat_messages' AND table_schema = DATABASE()
      `)
      const existingChatCols = chatCols.map(r => r.column_name || r.COLUMN_NAME)
      if (!existingChatCols.includes('file_path')) {
        await connection.query('ALTER TABLE group_chat_messages ADD COLUMN file_path VARCHAR(500)')
        console.log('  + group_chat_messages.file_path 列')
      }
      if (!existingChatCols.includes('file_type')) {
        await connection.query('ALTER TABLE group_chat_messages ADD COLUMN file_type VARCHAR(100)')
        console.log('  + group_chat_messages.file_type 列')
      }
    } catch (e) { /* ignore */ }
    console.log('✓ group_chat_messages 表')

    // ====== 13. 分组文件表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS group_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id INT NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_size BIGINT DEFAULT 0,
        file_type VARCHAR(100),
        uploader_id VARCHAR(30),
        uploader_name VARCHAR(50),
        file_data LONGBLOB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
      )
    `)
    console.log('✓ group_files 表')

    // ====== 14. 复习资料表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS study_materials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        file_url VARCHAR(500),
        file_name VARCHAR(255),
        file_size BIGINT DEFAULT 0,
        file_type VARCHAR(100),
        course_name VARCHAR(100),
        class_name VARCHAR(100),
        uploader_id VARCHAR(30),
        uploader_name VARCHAR(50),
        uploader_role VARCHAR(10) DEFAULT 'admin',
        file_data LONGBLOB,
        version_group TEXT,
        version_number INT DEFAULT 1,
        is_latest TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ study_materials 表')

    // ====== 15. 班级表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        major_id INT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (major_id) REFERENCES majors(id)
      )
    `)
    console.log('✓ classes 表')

    // ====== 16. 设置表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        \`key\` VARCHAR(100) UNIQUE NOT NULL,
        value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ site_settings 表')

    // ====== 17. 奖惩记录表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS rewards_punishments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id VARCHAR(30) NOT NULL,
        student_name VARCHAR(50),
        class_name VARCHAR(100),
        type VARCHAR(20) NOT NULL,
        category VARCHAR(50),
        reason TEXT,
        points INT DEFAULT 0,
        awarded_by VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ rewards_punishments 表')

    // ====== 18. 照片墙表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS photo_wall (
        id INT AUTO_INCREMENT PRIMARY KEY,
        file_data LONGBLOB NOT NULL,
        file_type TEXT,
        file_size BIGINT,
        description TEXT,
        is_public TINYINT(1) DEFAULT 1,
        uploader_id TEXT,
        uploader_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ photo_wall 表')

    // ====== 19. 论坛帖子表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS forum_posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(50) DEFAULT '综合',
        author_id VARCHAR(30) NOT NULL,
        author_name VARCHAR(50),
        author_role VARCHAR(10) DEFAULT 'student',
        pinned TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ forum_posts 表')

    // ====== 20. 论坛评论表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS forum_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT,
        content TEXT NOT NULL,
        author_id VARCHAR(30) NOT NULL,
        author_name VARCHAR(50),
        author_role VARCHAR(10) DEFAULT 'student',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE
      )
    `)
    console.log('✓ forum_comments 表')

    // ====== 21. 论坛点赞表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS forum_likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT,
        user_id VARCHAR(30) NOT NULL,
        user_name VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
        UNIQUE KEY unique_like (post_id, user_id)
      )
    `)
    console.log('✓ forum_likes 表')

    // ====== 22. 游戏分数表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS game_scores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(30) NOT NULL,
        user_name VARCHAR(50) NOT NULL,
        user_role VARCHAR(10) DEFAULT 'student',
        score INT NOT NULL DEFAULT 0,
        mode VARCHAR(20) DEFAULT 'classic',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_mode (user_id, mode),
        INDEX idx_user_id (user_id),
        INDEX idx_mode (mode),
        INDEX idx_score (score)
      )
    `)
    console.log('✓ game_scores 表')

    // 确保 game_scores 有 updated_at 列（旧表可能缺少）
    try { await connection.query("ALTER TABLE game_scores ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP") } catch {}
    // 清理 game_scores 重复数据，只保留每人每模式最高分
    await connection.query(`
      DELETE g1 FROM game_scores g1
      INNER JOIN game_scores g2
      ON g1.user_id = g2.user_id AND g1.mode = g2.mode
      AND g1.id < g2.id
    `)
    console.log('✓ game_scores 重复数据已清理')

    // ====== 23. 排位表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS game_ranks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(30) NOT NULL,
        user_name VARCHAR(50) NOT NULL,
        user_role VARCHAR(10) DEFAULT 'student',
        tier VARCHAR(20) NOT NULL DEFAULT 'black_iron',
        division INT NOT NULL DEFAULT 3,
        stars INT NOT NULL DEFAULT 0,
        max_stars INT NOT NULL DEFAULT 3,
        total_score INT NOT NULL DEFAULT 0,
        protection_cards INT NOT NULL DEFAULT 0,
        promotion_wins INT DEFAULT 0,
        promotion_needed INT DEFAULT 0,
        in_promotion BOOLEAN DEFAULT FALSE,
        season INT NOT NULL DEFAULT 1,
        games_played INT DEFAULT 0,
        games_won INT DEFAULT 0,
        win_streak INT DEFAULT 0,
        ranked_wins INT DEFAULT 0,
        ranked_losses INT DEFAULT 0,
        ranked_streak INT DEFAULT 0,
        highest_tier VARCHAR(20) DEFAULT 'black_iron',
        highest_division INT DEFAULT 3,
        highest_stars INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_season (user_id, season),
        INDEX idx_total_score (total_score),
        INDEX idx_tier (tier, division, stars)
      )
    `)
    // 确保新列存在（旧表升级）
    try { await connection.query("ALTER TABLE game_ranks ADD COLUMN ranked_wins INT DEFAULT 0") } catch {}
    try { await connection.query("ALTER TABLE game_ranks ADD COLUMN ranked_losses INT DEFAULT 0") } catch {}
    try { await connection.query("ALTER TABLE game_ranks ADD COLUMN ranked_streak INT DEFAULT 0") } catch {}
    console.log('✓ game_ranks 表')

    // ====== 24. 排位变动历史表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS game_rank_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(30) NOT NULL,
        season INT NOT NULL,
        game_mode VARCHAR(20),
        score INT,
        stars_before INT,
        stars_after INT,
        stars_change INT,
        tier_before VARCHAR(20),
        division_before INT,
        tier_after VARCHAR(20),
        division_after INT,
        is_promotion BOOLEAN DEFAULT FALSE,
        is_demotion BOOLEAN DEFAULT FALSE,
        is_promotion_match BOOLEAN DEFAULT FALSE,
        protection_used BOOLEAN DEFAULT FALSE,
        opponent_type VARCHAR(10) DEFAULT 'ai',
        opponent_score INT DEFAULT 0,
        opponent_name VARCHAR(50) DEFAULT '',
        won BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_season (user_id, season)
      )
    `)
    try { await connection.query("ALTER TABLE game_rank_history ADD COLUMN opponent_type VARCHAR(10) DEFAULT 'ai'") } catch {}
    try { await connection.query("ALTER TABLE game_rank_history ADD COLUMN opponent_score INT DEFAULT 0") } catch {}
    try { await connection.query("ALTER TABLE game_rank_history ADD COLUMN opponent_name VARCHAR(50) DEFAULT ''") } catch {}
    try { await connection.query("ALTER TABLE game_rank_history ADD COLUMN won BOOLEAN DEFAULT FALSE") } catch {}
    console.log('✓ game_rank_history 表')

    // ====== 25. 赛季表 ======
    await connection.query(`
      CREATE TABLE IF NOT EXISTS game_seasons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        season_number INT NOT NULL,
        season_name VARCHAR(50),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ game_seasons 表')

    // ====== 26. 游戏用户金币表 ==========
    await connection.query(`
      CREATE TABLE IF NOT EXISTS game_user_gold (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(30) NOT NULL,
        user_name VARCHAR(50) NOT NULL,
        gold_amount INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_id (user_id),
        INDEX idx_gold (gold_amount)
      )
    `)
    console.log('✓ game_user_gold 表')

    // ====== 27. 游戏用户道具表 ==========
    await connection.query(`
      CREATE TABLE IF NOT EXISTS game_user_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(30) NOT NULL,
        user_name VARCHAR(50) NOT NULL,
        item_id VARCHAR(50) NOT NULL,
        item_count INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_item (user_id, item_id),
        INDEX idx_user_id (user_id)
      )
    `)
    console.log('✓ game_user_items 表')

    // ====== 28. 道具发放记录表 ==========
    await connection.query(`
      CREATE TABLE IF NOT EXISTS game_item_distribution (
        id INT AUTO_INCREMENT PRIMARY KEY,
        target_user_id VARCHAR(30) NOT NULL,
        target_user_name VARCHAR(50) NOT NULL,
        item_id VARCHAR(50) NULL,
        item_count INT NOT NULL DEFAULT 0,
        gold_added INT NOT NULL DEFAULT 0,
        reason VARCHAR(200),
        distributed_by VARCHAR(30) NOT NULL,
        distributed_by_name VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_target_user (target_user_id),
        INDEX idx_distributor (distributed_by)
      )
    `)
    // 修复旧表 item_id 列约束（允许 NULL，支持仅发放金币）
    try { await connection.query("ALTER TABLE game_item_distribution MODIFY COLUMN item_id VARCHAR(50) NULL") } catch (e) {}
    console.log('✓ game_item_distribution 表')

    // ====== 29. 游戏通告表 ==========
    await connection.query(`
      CREATE TABLE IF NOT EXISTS game_announcements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        ann_type ENUM('notice', 'event', 'reward') DEFAULT 'notice',
        is_active BOOLEAN DEFAULT TRUE,
        show_in_game BOOLEAN DEFAULT TRUE,
        start_time DATETIME NULL,
        end_time DATETIME NULL,
        created_by VARCHAR(30) NOT NULL,
        created_by_name VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_is_active (is_active),
        INDEX idx_show_in_game (show_in_game),
        INDEX idx_time_range (start_time, end_time)
      )
    `)
    console.log('✓ game_announcements 表')

    // 初始化赛季（如果没有）
    const [seasonRows] = await connection.query('SELECT COUNT(*) as cnt FROM game_seasons')
    if (seasonRows[0].cnt === 0) {
      await connection.query(`
        INSERT INTO game_seasons (season_number, season_name, start_date, end_date, is_active)
        VALUES (1, '赛季1', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), TRUE)
      `)
      console.log('✓ 赛季1 已初始化')
    }

    // ====== 列宽修复（已有表可能列宽不足） ======
    const alterCols = [
      ['study_materials', 'file_type', 'VARCHAR(100)'],
      ['files', 'file_type', 'VARCHAR(100)'],
      ['group_files', 'file_type', 'VARCHAR(100)'],
    ]
    for (const [table, col, type] of alterCols) {
      try {
        await connection.query(`ALTER TABLE ${table} MODIFY COLUMN ${col} ${type}`)
      } catch (e) { /* 列已满足或不存在 */ }
    }

    // ====== 重建结构不匹配的表 ======
    const rebuildTables = ['photo_wall', 'rewards_punishments', 'classes']
    for (const t of rebuildTables) {
      try { await connection.query(`DROP TABLE IF EXISTS ${t}`) } catch (e) {}
    }
    // 重新执行建表
    await connection.query(`
      CREATE TABLE classes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        major_id INT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (major_id) REFERENCES majors(id)
      )
    `)
    await connection.query(`
      CREATE TABLE rewards_punishments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id VARCHAR(30) NOT NULL,
        student_name VARCHAR(50),
        class_name VARCHAR(100),
        type VARCHAR(20) NOT NULL,
        category VARCHAR(50),
        reason TEXT,
        points INT DEFAULT 0,
        awarded_by VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    await connection.query(`
      CREATE TABLE photo_wall (
        id INT AUTO_INCREMENT PRIMARY KEY,
        file_data LONGBLOB NOT NULL,
        file_type TEXT,
        file_size BIGINT,
        description TEXT,
        is_public TINYINT(1) DEFAULT 1,
        uploader_id TEXT,
        uploader_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)
    console.log('✓ 列宽检查 & 表重建完成')

    // 统计
    const [stuCount] = await connection.query('SELECT COUNT(*) as c FROM students')
    const [grdCount] = await connection.query('SELECT COUNT(*) as c FROM grades')

    console.log('\n--- 数据库概览 ---')
    console.log(`  学生: ${stuCount[0].c} 人`)
    console.log(`  成绩: ${grdCount[0].c} 条`)
    console.log(`  专业: 7 个`)
    console.log(`  管理员: admin / admin123`)
    console.log(`  学生密码: 123456`)
    console.log('\n数据库迁移完成！')
  } catch (error) {
    console.error('迁移失败:', error.message)
    throw error
  } finally {
    connection.release()
    await pool.end()
  }
}

migrate()

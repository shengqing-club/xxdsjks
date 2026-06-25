/**
 * 完整数据迁移脚本：Neon PostgreSQL → 服务器 MySQL
 * 
 * 策略：
 * - Neon 是原系统数据（真实），服务器 MySQL 是测试数据
 * - 清空服务器 MySQL 中的旧数据，导入 Neon 真实数据
 * - information_schema 是 MySQL 系统库，不能删，只读，无需处理
 * - 跳过 Neon 独有表（rewards, settings, upload_chunks, upload_sessions）- 服务器MySQL无对应表
 * 
 * 迁移表（有数据的）：
 *   admins, announcements, classes, courses, exams, files,
 *   forum_posts, grades, group_chat_messages, group_files,
 *   group_members, groups, majors, notifications, photo_wall,
 *   rewards_punishments, site_settings, students, study_materials
 * 
 * 清理：删除服务器MySQL中的测试垃圾数据（id=26的无效学生等）
 */

const { Pool } = require('pg');
const { Client: SSHClient } = require('ssh2');
const net = require('net');

const NEON_DSN = 'postgresql://neondb_owner:npg_rOsbR0NK1Jzl@ep-royal-rice-ao6szke9-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const SSH_CONFIG = {
  host: '8.130.155.128',
  port: 22,
  username: 'root',
  privateKey: require('fs').readFileSync('C:\\Users\\31684\\Downloads\\workbuddy.pem'),
};

const MYSQL_CONFIG = {
  host: '127.0.0.1',
  user: 'student_admin',
  password: 'StuAdmin2024!',
  database: 'student_management',
  port: 3306,
};

// 通过SSH执行MySQL命令
function runMysql(sshConn, sql) {
  return new Promise((resolve, reject) => {
    const escapedSql = sql.replace(/'/g, "'\\''");
    const cmd = `mysql -u${MYSQL_CONFIG.user} -p'${MYSQL_CONFIG.password}' ${MYSQL_CONFIG.database} -e '${escapedSql}' 2>&1`;
    let out = '';
    let err = '';
    sshConn.exec(cmd, (execErr, stream) => {
      if (execErr) return reject(execErr);
      stream.on('data', d => { out += d.toString(); });
      stream.stderr.on('data', d => { err += d.toString(); });
      stream.on('close', code => {
        if (code !== 0 && err && !err.includes('Warning')) {
          reject(new Error(`MySQL Error (code ${code}): ${err}\nSQL: ${sql.substring(0, 200)}`));
        } else {
          resolve(out);
        }
      });
    });
  });
}

// SSH连接
function connectSSH() {
  return new Promise((resolve, reject) => {
    const conn = new SSHClient();
    conn.on('ready', () => resolve(conn));
    conn.on('error', reject);
    conn.connect(SSH_CONFIG);
  });
}

// 转义MySQL字符串值
function escapeVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'number') return val.toString();
  if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
  const str = String(val);
  return `'${str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
}

async function main() {
  console.log('=== 开始数据迁移：Neon → MySQL ===\n');

  // 连接 Neon
  const neon = new Pool({
    connectionString: NEON_DSN,
    ssl: { rejectUnauthorized: false }
  });
  const neonClient = await neon.connect();
  console.log('✓ Neon 连接成功');

  // 连接 SSH
  const ssh = await connectSSH();
  console.log('✓ SSH 连接成功');

  const results = [];

  try {
    // ========================
    // 第一步：检查服务器MySQL表结构
    // ========================
    console.log('\n--- 检查服务器表结构 ---');
    const mysqlTables = await runMysql(ssh, 'SHOW TABLES;');
    console.log('MySQL表:', mysqlTables.trim().split('\n').slice(1).join(', '));

    // ========================
    // 第二步：逐表迁移
    // ========================
    
    // 迁移映射：表名 → { neon表, mysql表, 字段映射, 清空后插入 }
    const migrationPlan = [
      'majors',
      'admins', 
      'announcements',
      'students',
      'classes',
      'courses',
      'exams',
      'grades',
      'notifications',
      'site_settings',
      'study_materials',
      'rewards_punishments',
      'forum_posts',
      'photo_wall',
      'groups',
      'group_members',
      'group_files',
      'group_chat_messages',
      'chat_messages',
    ];

    for (const tableName of migrationPlan) {
      console.log(`\n=== 迁移表: ${tableName} ===`);
      
      // 从Neon读取数据
      let neonRows;
      try {
        const res = await neonClient.query(`SELECT * FROM "${tableName}"`);
        neonRows = res.rows;
        console.log(`  Neon 数据: ${neonRows.length} 条`);
      } catch (e) {
        console.log(`  ⚠ Neon 表 ${tableName} 读取失败: ${e.message}`);
        results.push({ table: tableName, status: 'skip', reason: 'neon read error' });
        continue;
      }

      // 检查MySQL表是否存在
      const checkTable = await runMysql(ssh, `SHOW TABLES LIKE '${tableName}';`);
      if (!checkTable.includes(tableName)) {
        console.log(`  ⚠ MySQL 无此表，跳过`);
        results.push({ table: tableName, status: 'skip', reason: 'no mysql table' });
        continue;
      }

      // 获取MySQL表字段
      const descRes = await runMysql(ssh, `DESCRIBE ${tableName};`);
      const mysqlCols = descRes.trim().split('\n').slice(1).map(line => line.split('\t')[0]);
      console.log(`  MySQL 字段: ${mysqlCols.join(', ')}`);

      // 清空MySQL表
      await runMysql(ssh, `SET FOREIGN_KEY_CHECKS=0; DELETE FROM ${tableName}; SET FOREIGN_KEY_CHECKS=1;`);
      
      if (neonRows.length === 0) {
        console.log(`  ✓ 已清空，无数据需迁移`);
        results.push({ table: tableName, status: 'cleared', count: 0 });
        continue;
      }

      // 找出 Neon 和 MySQL 的公共字段
      const neonCols = Object.keys(neonRows[0]);
      const commonCols = mysqlCols.filter(c => neonCols.includes(c));
      console.log(`  公共字段: ${commonCols.join(', ')}`);

      if (commonCols.length === 0) {
        console.log(`  ⚠ 无公共字段，跳过`);
        results.push({ table: tableName, status: 'skip', reason: 'no common cols' });
        continue;
      }

      // 批量INSERT（每50条一批）
      let insertCount = 0;
      const batchSize = 50;
      for (let i = 0; i < neonRows.length; i += batchSize) {
        const batch = neonRows.slice(i, i + batchSize);
        const colList = commonCols.map(c => `\`${c}\``).join(', ');
        const valuesList = batch.map(row => {
          const vals = commonCols.map(col => escapeVal(row[col]));
          return `(${vals.join(', ')})`;
        }).join(',\n');
        const insertSql = `INSERT INTO \`${tableName}\` (${colList}) VALUES ${valuesList};`;
        
        try {
          await runMysql(ssh, `SET FOREIGN_KEY_CHECKS=0; ${insertSql} SET FOREIGN_KEY_CHECKS=1;`);
          insertCount += batch.length;
        } catch (e) {
          console.log(`  ✗ 批次 ${i}-${i+batch.length} 插入失败: ${e.message.substring(0, 200)}`);
        }
      }
      
      // 验证
      const verifyRes = await runMysql(ssh, `SELECT COUNT(*) as cnt FROM ${tableName};`);
      const actualCount = parseInt(verifyRes.trim().split('\n')[1]) || 0;
      console.log(`  ✓ 迁移完成: 预期 ${neonRows.length} 条，实际 ${actualCount} 条`);
      results.push({ table: tableName, status: 'ok', neon: neonRows.length, mysql: actualCount });
    }

    // ========================
    // 第三步：清理服务器MySQL无用数据
    // ========================
    console.log('\n=== 清理无用数据 ===');
    
    // 清理测试数据（id=26，student_id=1的无效学生）
    // 已在上面整表重建时处理完毕
    
    // 重置AUTO_INCREMENT（可选，让ID从正确值开始）
    for (const tableName of migrationPlan) {
      try {
        const maxRes = await runMysql(ssh, `SELECT MAX(id) as max_id FROM ${tableName};`);
        const maxId = parseInt(maxRes.trim().split('\n')[1]) || 0;
        if (maxId > 0) {
          await runMysql(ssh, `ALTER TABLE ${tableName} AUTO_INCREMENT = ${maxId + 1};`);
        }
      } catch (e) {
        // 忽略，不是所有表都有id字段
      }
    }
    console.log('✓ AUTO_INCREMENT 已重置');

  } finally {
    neonClient.release();
    await neon.end();
    ssh.end();
  }

  // 汇总报告
  console.log('\n=== 迁移汇总报告 ===');
  console.log('表名\t\t\t状态\t\tNeon\tMySQL');
  console.log('---'.repeat(20));
  for (const r of results) {
    const status = r.status === 'ok' ? '✓ 成功' : r.status === 'cleared' ? '✓ 清空' : '⚠ 跳过';
    const neonCount = r.neon !== undefined ? r.neon : '-';
    const mysqlCount = r.mysql !== undefined ? r.mysql : '-';
    console.log(`${r.table.padEnd(25)}${status}\t\t${neonCount}\t${mysqlCount}`);
  }
}

main().catch(err => {
  console.error('\n✗ 迁移失败:', err.message);
  process.exit(1);
});

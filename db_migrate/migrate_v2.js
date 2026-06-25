/**
 * 完整数据迁移脚本 v2：Neon PostgreSQL → 服务器 MySQL
 * 修复：INSERT语句单独执行，不合并多条语句
 */

const { Pool } = require('pg');
const { Client: SSHClient } = require('ssh2');
const fs = require('fs');

const NEON_DSN = 'postgresql://neondb_owner:npg_rOsbR0NK1Jzl@ep-royal-rice-ao6szke9-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const SSH_CONFIG = {
  host: '8.130.155.128',
  port: 22,
  username: 'root',
  privateKey: fs.readFileSync('C:\\Users\\31684\\Downloads\\workbuddy.pem'),
};

const MYSQL_USER = 'student_admin';
const MYSQL_PASS = 'StuAdmin2024!';
const MYSQL_DB = 'student_management';

// 通过SSH执行单条MySQL命令
function runMysql(sshConn, sql) {
  return new Promise((resolve, reject) => {
    // 写入临时文件再执行，避免命令行引号转义问题
    const tmpFile = `/tmp/migrate_${Date.now()}.sql`;
    const writeCmd = `cat > ${tmpFile} << 'SQLEOF'\n${sql}\nSQLEOF`;
    const execCmd = `mysql -u${MYSQL_USER} -p'${MYSQL_PASS}' ${MYSQL_DB} < ${tmpFile} 2>&1; rm -f ${tmpFile}`;
    
    let out = '';
    let err = '';
    
    // 先写文件
    sshConn.exec(`bash -c ${JSON.stringify(writeCmd + ' && ' + execCmd)}`, (execErr, stream) => {
      if (execErr) return reject(execErr);
      stream.on('data', d => { out += d.toString(); });
      stream.stderr.on('data', d => { err += d.toString(); });
      stream.on('close', code => {
        const combined = out + err;
        // 忽略Warning
        if (combined && !combined.includes('Warning') && combined.trim() !== '') {
          if (code !== 0) {
            reject(new Error(`MySQL Error: ${combined.substring(0, 300)}`));
            return;
          }
        }
        resolve(out);
      });
    });
  });
}

// 更简单的SSH exec
function sshExec(sshConn, cmd) {
  return new Promise((resolve, reject) => {
    let out = '';
    let err = '';
    sshConn.exec(cmd, (execErr, stream) => {
      if (execErr) return reject(execErr);
      stream.on('data', d => { out += d.toString(); });
      stream.stderr.on('data', d => { err += d.toString(); });
      stream.on('close', () => resolve({ out, err }));
    });
  });
}

// 连接SSH
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
  return `'${str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\0/g, '')}'`;
}

async function migrateTable(ssh, tableName, neonRows, mysqlCols) {
  if (neonRows.length === 0) {
    console.log(`  ✓ 已清空，无数据`);
    return { status: 'cleared', count: 0 };
  }

  const neonCols = Object.keys(neonRows[0]);
  const commonCols = mysqlCols.filter(c => neonCols.includes(c));
  console.log(`  公共字段(${commonCols.length}): ${commonCols.join(', ')}`);

  if (commonCols.length === 0) {
    console.log(`  ⚠ 无公共字段，跳过`);
    return { status: 'skip', reason: 'no common cols' };
  }

  // 生成完整SQL文件，通过SCP上传到服务器执行
  const colList = commonCols.map(c => `\`${c}\``).join(', ');
  let sqlLines = [];
  sqlLines.push('SET FOREIGN_KEY_CHECKS=0;');
  sqlLines.push('SET NAMES utf8mb4;');
  
  // 每50条一批
  const batchSize = 50;
  for (let i = 0; i < neonRows.length; i += batchSize) {
    const batch = neonRows.slice(i, i + batchSize);
    const valuesList = batch.map(row => {
      const vals = commonCols.map(col => escapeVal(row[col]));
      return `(${vals.join(', ')})`;
    }).join(',\n');
    sqlLines.push(`INSERT INTO \`${tableName}\` (${colList}) VALUES\n${valuesList};`);
  }
  
  sqlLines.push('SET FOREIGN_KEY_CHECKS=1;');
  const fullSql = sqlLines.join('\n');

  // 写SQL到本地临时文件
  const localTmp = `C:\\Users\\31684\\AppData\\Local\\Temp\\migrate_${tableName}.sql`;
  fs.writeFileSync(localTmp, fullSql, 'utf8');
  
  // SCP上传
  const scpResult = await new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    const cmd = `"C:\\Windows\\System32\\OpenSSH\\scp.exe" -i "C:\\Users\\31684\\Downloads\\workbuddy.pem" -o StrictHostKeyChecking=no "${localTmp}" root@8.130.155.128:/tmp/migrate_${tableName}.sql`;
    exec(cmd, (err, stdout, stderr) => {
      if (err) reject(new Error(`SCP失败: ${stderr}`));
      else resolve(stdout);
    });
  });

  // 在服务器执行SQL文件
  const execResult = await sshExec(ssh, `mysql -u${MYSQL_USER} -p'${MYSQL_PASS}' ${MYSQL_DB} < /tmp/migrate_${tableName}.sql 2>&1; rm -f /tmp/migrate_${tableName}.sql`);
  
  const execOutput = execResult.out + execResult.err;
  if (execOutput && !execOutput.includes('Warning') && execOutput.trim()) {
    console.log(`  ⚠ 执行输出: ${execOutput.substring(0, 300)}`);
  }

  // 验证行数
  const verifyResult = await sshExec(ssh, `mysql -u${MYSQL_USER} -p'${MYSQL_PASS}' ${MYSQL_DB} -e "SELECT COUNT(*) FROM \\\`${tableName}\\\`;" 2>/dev/null`);
  const lines = verifyResult.out.trim().split('\n').filter(l => !l.includes('Warning'));
  const actualCount = parseInt(lines[lines.length - 1]) || 0;
  
  const ok = actualCount === neonRows.length;
  console.log(`  ${ok ? '✓' : '✗'} 迁移: 预期 ${neonRows.length} 条，实际 ${actualCount} 条`);
  
  // 清理本地临时文件
  try { fs.unlinkSync(localTmp); } catch(e) {}
  
  return { status: ok ? 'ok' : 'partial', neon: neonRows.length, mysql: actualCount };
}

async function main() {
  console.log('=== 数据迁移 v2：Neon → MySQL ===\n');

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
    // 迁移顺序（注意外键依赖）
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
      'forum_comments',
      'forum_likes',
      'photo_wall',
      'groups',
      'group_members',
      'group_files',
      'group_chat_messages',
      'chat_messages',
    ];

    for (const tableName of migrationPlan) {
      console.log(`\n=== 迁移表: ${tableName} ===`);

      // Neon读取
      let neonRows;
      try {
        const res = await neonClient.query(`SELECT * FROM "${tableName}"`);
        neonRows = res.rows;
        console.log(`  Neon: ${neonRows.length} 条`);
      } catch (e) {
        console.log(`  ⚠ Neon读取失败: ${e.message}`);
        results.push({ table: tableName, status: 'skip', reason: 'neon error' });
        continue;
      }

      // 检查MySQL表
      const checkResult = await sshExec(ssh, `mysql -u${MYSQL_USER} -p'${MYSQL_PASS}' ${MYSQL_DB} -e "SHOW TABLES LIKE '${tableName}';" 2>/dev/null`);
      if (!checkResult.out.includes(tableName)) {
        console.log(`  ⚠ MySQL无此表，跳过`);
        results.push({ table: tableName, status: 'skip', reason: 'no mysql table' });
        continue;
      }

      // 获取MySQL字段
      const descResult = await sshExec(ssh, `mysql -u${MYSQL_USER} -p'${MYSQL_PASS}' ${MYSQL_DB} -e "DESCRIBE \\\`${tableName}\\\`;" 2>/dev/null`);
      const mysqlCols = descResult.out.trim().split('\n')
        .filter(l => !l.startsWith('Field') && l.trim())
        .map(l => l.split('\t')[0].trim())
        .filter(Boolean);
      console.log(`  MySQL字段: ${mysqlCols.join(', ')}`);

      // 清空表
      await sshExec(ssh, `mysql -u${MYSQL_USER} -p'${MYSQL_PASS}' ${MYSQL_DB} -e "SET FOREIGN_KEY_CHECKS=0; DELETE FROM \\\`${tableName}\\\`; SET FOREIGN_KEY_CHECKS=1;" 2>/dev/null`);
      console.log(`  已清空 MySQL ${tableName}`);

      // 迁移数据
      const result = await migrateTable(ssh, tableName, neonRows, mysqlCols);
      results.push({ table: tableName, ...result });
    }

    // 重置AUTO_INCREMENT
    console.log('\n=== 重置 AUTO_INCREMENT ===');
    for (const tableName of migrationPlan) {
      try {
        const r = await sshExec(ssh, `mysql -u${MYSQL_USER} -p'${MYSQL_PASS}' ${MYSQL_DB} -e "SELECT COALESCE(MAX(id),0)+1 FROM \\\`${tableName}\\\`;" 2>/dev/null`);
        const lines = r.out.trim().split('\n').filter(l => !l.includes('Warning') && l.trim());
        const nextId = parseInt(lines[lines.length - 1]) || 1;
        await sshExec(ssh, `mysql -u${MYSQL_USER} -p'${MYSQL_PASS}' ${MYSQL_DB} -e "ALTER TABLE \\\`${tableName}\\\` AUTO_INCREMENT=${nextId};" 2>/dev/null`);
        console.log(`  ${tableName}: AUTO_INCREMENT=${nextId}`);
      } catch(e) { /* 不是所有表都有id */ }
    }

  } finally {
    neonClient.release();
    await neon.end();
    ssh.end();
  }

  // 报告
  console.log('\n' + '='.repeat(60));
  console.log('迁移汇总报告');
  console.log('='.repeat(60));
  console.log(`${'表名'.padEnd(30)}${'状态'.padEnd(10)}Neon → MySQL`);
  console.log('-'.repeat(60));
  let successCount = 0, totalNeon = 0, totalMysql = 0;
  for (const r of results) {
    const icon = r.status === 'ok' ? '✓' : r.status === 'cleared' ? '○' : r.status === 'partial' ? '△' : '✗';
    const neonC = r.neon !== undefined ? r.neon : '-';
    const mysqlC = r.mysql !== undefined ? r.mysql : '-';
    console.log(`${icon} ${r.table.padEnd(28)}${r.status.padEnd(10)}${neonC} → ${mysqlC}`);
    if (r.status === 'ok') successCount++;
    if (r.neon) totalNeon += r.neon;
    if (r.mysql) totalMysql += r.mysql;
  }
  console.log('='.repeat(60));
  console.log(`总计: ${successCount}/${results.length} 表成功，${totalNeon} 条 Neon → ${totalMysql} 条 MySQL`);
  
  // 保存报告
  const report = { timestamp: new Date().toISOString(), results, totalNeon, totalMysql };
  fs.writeFileSync('E:\\白雨轩文件\\bianyi\\vue\\阿里云在线系统\\myfirstvue3\\db_migrate\\migration_report.json', JSON.stringify(report, null, 2), 'utf8');
  console.log('\n报告已保存至 db_migrate/migration_report.json');
}

main().catch(err => {
  console.error('\n✗ 迁移失败:', err.message);
  console.error(err.stack);
  process.exit(1);
});

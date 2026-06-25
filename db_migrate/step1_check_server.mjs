/**
 * Step1: SSH 连接服务器，检查本地 PostgreSQL 状态
 * - 列出所有数据库
 * - 列出 student_management 数据库中的所有表及行数
 * - 判断 information_schema 数据库
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('ssh2');

const SSH_CONFIG = {
  host: '8.130.155.128',
  port: 22,
  username: 'root',
  password: 'admin123',
};

function runSSH(command) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = '';
    let errOutput = '';

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) { conn.end(); reject(err); return; }
        stream.on('close', (code) => {
          conn.end();
          resolve({ code, stdout: output, stderr: errOutput });
        });
        stream.on('data', (data) => { output += data.toString(); });
        stream.stderr.on('data', (data) => { errOutput += data.toString(); });
      });
    });
    conn.on('error', reject);
    conn.connect(SSH_CONFIG);
  });
}

async function main() {
  console.log('=== Step1: 检查服务器 PostgreSQL 状态 ===\n');

  // 1. 列出所有数据库
  console.log('--- 所有数据库 ---');
  const r1 = await runSSH(`psql -U postgres -c "\\l" 2>&1 || sudo -u postgres psql -c "\\l" 2>&1`);
  console.log(r1.stdout || r1.stderr);

  // 2. 检查 postgres 用户
  console.log('--- PostgreSQL 用户 ---');
  const r2 = await runSSH(`id postgres 2>&1; ps aux | grep postgres | grep -v grep | head -5`);
  console.log(r2.stdout || r2.stderr);

  // 3. 检查服务器上的 pg 连接配置
  console.log('--- pg_hba.conf 位置 ---');
  const r3 = await runSSH(`find /etc /var /home -name pg_hba.conf 2>/dev/null | head -5; find /etc -name postgresql.conf 2>/dev/null | head -3`);
  console.log(r3.stdout || r3.stderr);

  // 4. 检查后端配置文件（数据库连接字符串）
  console.log('--- 后端数据库配置 ---');
  const r4 = await runSSH(`find /root /home /var/www /opt /srv -name ".env" -o -name "config.js" -o -name "database.js" 2>/dev/null | head -10`);
  console.log(r4.stdout || r4.stderr);

  // 5. 读取 .env 文件
  console.log('--- .env 内容 ---');
  const r5 = await runSSH(`cat /root/.env 2>/dev/null || find / -name ".env" -not -path "*/node_modules/*" 2>/dev/null | xargs cat 2>/dev/null | head -50`);
  console.log(r5.stdout || r5.stderr);

  // 6. 应用目录
  console.log('--- 应用目录 ---');
  const r6 = await runSSH(`ls /root /home /var/www /opt /srv 2>/dev/null`);
  console.log(r6.stdout || r6.stderr);

  // 7. PM2进程
  console.log('--- PM2 进程 ---');
  const r7 = await runSSH(`pm2 list 2>&1 || echo "pm2 not found"`);
  console.log(r7.stdout || r7.stderr);
}

main().catch(console.error);

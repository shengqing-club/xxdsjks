// db.js 需要自行加载 dotenv，因为 ES 模块 import 提升机制
// 会导致 db.js 在 index.js 的 dotenv.config() 之前执行
import dotenv from 'dotenv'
dotenv.config()

import mysql from 'mysql2/promise'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('ERROR: DATABASE_URL 环境变量未设置！')
}

// 解析 DATABASE_URL 为 MySQL 连接参数
function parseConnectionUrl(url) {
  try {
    const parsed = new URL(url)
    // 将 localhost 强制转换为 127.0.0.1，避免 IPv6 解析问题
    let host = parsed.hostname
    if (host === 'localhost') host = '127.0.0.1'
    return {
      host: host,
      port: parsed.port ? parseInt(parsed.port) : 3306,
      user: parsed.username,
      password: parsed.password,
      database: parsed.pathname.replace(/^\//, ''),
      ssl: parsed.searchParams.get('sslmode') === 'require' ? { rejectUnauthorized: false } : undefined
    }
  } catch {
    // 如果不是 URL 格式，尝试使用简单配置
    return {
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'student_management'
    }
  }
}

const dbConfig = connectionString ? parseConnectionUrl(connectionString) : {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'student_management'
}

// 连接池配置（MySQL）
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000,
  timezone: '+08:00'
})

// 每个新连接设置时区为北京时间
pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+08:00'")
})

pool.on('error', (err) => {
  console.error('数据库连接池异常:', err.message)
})

// MySQL 查询适配：将 $1, $2... 替换为 ?，并转换结果格式以兼容 pg 风格
// 同时确保 insertId/affectedRows 等属性可直接访问（全路由依赖）

// SQL 占位符适配：$1, $2... → ?
function adaptSql(sql) {
  return sql.replace(/\$(\d+)/g, '?')
}

// 结果适配器：统一 mysql2 的返回格式
function adaptResult(rows, fields) {
  if (Array.isArray(rows)) {
    // SELECT: rows 是行数组
    return { rows, fields, rowCount: rows.length }
  }
  // INSERT/UPDATE/DELETE: rows 是 ResultSetHeader
  return {
    rows: [],
    fields,
    rowCount: rows.affectedRows || 0,
    insertId: rows.insertId,
    affectedRows: rows.affectedRows,
    changedRows: rows.changedRows
  }
}

// 包装 pool.query
const originalQuery = pool.query.bind(pool)
pool.query = async function(sql, values) {
  const [rows, fields] = await originalQuery(adaptSql(sql), values)
  return adaptResult(rows, fields)
}

// 添加 pool.connect() 方法（兼容 pg 的事务 API）
// mysql2 Pool 没有 connect()，只有 getConnection()
pool.connect = async function() {
  const conn = await pool.getConnection()
  const origConnQuery = conn.query.bind(conn)
  // 包装连接的 query 方法，保持与 pool.query 一致的返回格式
  conn.query = async function(sql, values) {
    const [rows, fields] = await origConnQuery(adaptSql(sql), values)
    return adaptResult(rows, fields)
  }
  // conn.release() 已由 mysql2 提供
  return conn
}

export default pool

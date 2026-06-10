import 'dotenv/config'
import pkg from 'pg'
const { Pool, types } = pkg

// 覆盖 TIMESTAMP 和 TIMESTAMPTZ 类型解析器
// 返回原始字符串而不是 Date 对象，避免 JSON.stringify 的 UTC 转换
types.setTypeParser(1114, (val) => val)   // TIMESTAMP (without time zone)
types.setTypeParser(1184, (val) => val)   // TIMESTAMPTZ (with time zone)

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('ERROR: DATABASE_URL 环境变量未设置！')
}
const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

// 每个新连接设置时区为北京时间
pool.on('connect', (client) => {
  client.query("SET timezone = 'Asia/Shanghai'").catch(() => {})
})

pool.on('error', (err) => {
  console.error('数据库连接池异常:', err.message)
})

export default pool

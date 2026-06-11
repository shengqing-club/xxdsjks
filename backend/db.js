import 'dotenv/config'
import pkg from 'pg'
const { Pool, types } = pkg

// 覆盖 TIMESTAMP 和 TIMESTAMPTZ 类型解析器
types.setTypeParser(1114, (val) => val)   // TIMESTAMP (without time zone)
types.setTypeParser(1184, (val) => val)   // TIMESTAMPTZ (with time zone)

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('ERROR: DATABASE_URL 环境变量未设置！')
}

// serverless 环境下连接池要小，避免耗尽数据库连接
const isServerless = !!process.env.NETLIFY || !!process.env.LAMBDA_TASK_ROOT
const pool = new Pool({
  connectionString,
  max: isServerless ? 3 : 20,
  idleTimeoutMillis: isServerless ? 10000 : 30000,
  connectionTimeoutMillis: 10000,
})

// 每个新连接设置时区为北京时间
pool.on('connect', (client) => {
  client.query("SET timezone = 'Asia/Shanghai'").catch(() => {})
})

pool.on('error', (err) => {
  console.error('数据库连接池异常:', err.message)
})

export default pool

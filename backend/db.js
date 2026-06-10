import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  connectionString:
    'postgresql://neondb_owner:npg_AvOmIHM5wDt8@ep-flat-hat-ao566lsu-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
})

pool.on('error', (err) => {
  console.error('数据库连接池异常:', err.message)
})

export default pool

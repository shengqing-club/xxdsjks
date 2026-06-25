/**
 * 读取 Neon PostgreSQL 数据库的所有数据
 * 用于和服务器MySQL对比，确定迁移内容
 */
const { Pool } = require('pg');

const neonPool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_rOsbR0NK1Jzl@ep-royal-rice-ao6szke9-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  const client = await neonPool.connect();
  
  try {
    console.log('=== Neon PostgreSQL 数据库内容 ===\n');

    // 获取所有表
    const tablesRes = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('所有表:', tablesRes.rows.map(r => r.table_name).join(', '));
    console.log('');

    // 逐表统计行数
    for (const row of tablesRes.rows) {
      const tableName = row.table_name;
      const countRes = await client.query(`SELECT COUNT(*) FROM "${tableName}"`);
      console.log(`${tableName}: ${countRes.rows[0].count} 条`);
    }

    console.log('\n=== 各表详细内容 ===\n');

    for (const row of tablesRes.rows) {
      const tableName = row.table_name;
      const dataRes = await client.query(`SELECT * FROM "${tableName}" LIMIT 100`);
      if (dataRes.rows.length > 0) {
        console.log(`\n--- ${tableName} (${dataRes.rows.length}条) ---`);
        console.log(JSON.stringify(dataRes.rows, null, 2));
      }
    }

  } finally {
    client.release();
    await neonPool.end();
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

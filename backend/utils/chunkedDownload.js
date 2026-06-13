import pool from '../db.js'

const CHUNK_SIZE = 4 * 1024 * 1024 // 4MB per chunk

export function createChunkedDownloadHandler({ tableName, idColumn, dataColumn, nameColumn, typeColumn }) {
  return async (req, res) => {
    try {
      const id = req.params.id || req.params.file_id || req.params.message_id
      if (!id) return res.status(400).json({ message: '缺少文件ID' })

      // 获取文件元信息
      const metaResult = await pool.query(
        `SELECT id, ${nameColumn} as file_name, ${typeColumn} as file_type,
                OCTET_LENGTH(${dataColumn}) as file_size
         FROM ${tableName} WHERE ${idColumn} = $1`,
        [id]
      )
      if (metaResult.rows.length === 0) return res.status(404).json({ message: '文件不存在' })
      const meta = metaResult.rows[0]
      if (!meta.file_size || meta.file_size === 0) return res.status(404).json({ message: '文件内容已丢失' })

      const chunkIndex = parseInt(req.query.chunk) || 0
      const chunkSize = parseInt(req.query.chunkSize) || CHUNK_SIZE
      const offset = chunkIndex * chunkSize

      if (offset >= meta.file_size) {
        return res.status(416).json({ message: '范围超出文件大小' })
      }

      // PostgreSQL SUBSTRING for BYTEA: 1-indexed
      const chunk = await pool.query(
        `SELECT SUBSTRING(${dataColumn}, $1, $2) as chunk_data FROM ${tableName} WHERE ${idColumn} = $3`,
        [offset + 1, chunkSize, id]
      )

      const chunkData = chunk.rows[0].chunk_data
      const buffer = Buffer.isBuffer(chunkData) ? chunkData : Buffer.from(chunkData)

      res.json({
        chunkIndex,
        chunkSize,
        totalSize: meta.file_size,
        totalChunks: Math.ceil(meta.file_size / chunkSize),
        fileName: meta.file_name,
        fileType: meta.file_type || 'application/octet-stream',
        base64: buffer.toString('base64')
      })
    } catch (e) {
      console.error('分片下载失败:', e)
      res.status(500).json({ message: '分片下载失败' })
    }
  }
}

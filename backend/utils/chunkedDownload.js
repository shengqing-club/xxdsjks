import pool from '../db.js'

const CHUNK_SIZE = 1024 * 1024 // 1MB per chunk（base64 后约 1.33MB）

export function createChunkedDownloadHandler({ tableName, idColumn, dataColumn, nameColumn, typeColumn }) {
  return async (req, res) => {
    try {
      const id = req.params.id || req.params.file_id || req.params.message_id
      if (!id) return res.status(400).json({ message: '缺少文件ID' })

      const chunkIndex = parseInt(req.query.chunk) || 0
      const chunkSize = parseInt(req.query.chunkSize) || CHUNK_SIZE
      const offset = chunkIndex * chunkSize

      // 单条查询同时获取元信息和分片数据，减少数据库往返次数
      const result = await pool.query(
        `SELECT ${nameColumn} as file_name, ${typeColumn} as file_type,
                OCTET_LENGTH(${dataColumn}) as file_size,
                SUBSTRING(${dataColumn}, $1, $2) as chunk_data
         FROM ${tableName} WHERE ${idColumn} = $3`,
        [offset + 1, chunkSize, id]
      )

      if (result.rows.length === 0) return res.status(404).json({ message: '文件不存在' })
      const row = result.rows[0]

      if (!row.file_size || row.file_size === 0) return res.status(404).json({ message: '文件内容已丢失' })
      if (offset >= row.file_size) return res.status(416).json({ message: '范围超出文件大小' })

      const chunkData = row.chunk_data
      if (!chunkData || chunkData.length === 0) return res.status(416).json({ message: '分片数据为空' })

      const buffer = Buffer.isBuffer(chunkData) ? chunkData : Buffer.from(chunkData)

      res.json({
        chunkIndex,
        chunkSize,
        totalSize: row.file_size,
        totalChunks: Math.ceil(row.file_size / chunkSize),
        fileName: row.file_name,
        fileType: row.file_type || 'application/octet-stream',
        base64: buffer.toString('base64')
      })
    } catch (e) {
      console.error('分片下载失败:', e)
      res.status(500).json({ message: '分片下载失败: ' + e.message })
    }
  }
}

/**
 * 创建流式下载 handler（非 Serverless 环境专用）
 * 直接以二进制流返回文件，无需 base64 编码，性能最优
 */
export function createStreamingDownloadHandler({ tableName, idColumn, dataColumn, nameColumn, typeColumn }) {
  return async (req, res) => {
    try {
      const id = req.params.id || req.params.file_id
      if (!id) return res.status(400).json({ message: '缺少文件ID' })

      // 获取元信息
      const metaResult = await pool.query(
        `SELECT ${nameColumn} as file_name, ${typeColumn} as file_type,
                OCTET_LENGTH(${dataColumn}) as file_size
         FROM ${tableName} WHERE ${idColumn} = $1`,
        [id]
      )
      if (metaResult.rows.length === 0) return res.status(404).json({ message: '文件不存在' })
      const meta = metaResult.rows[0]
      if (!meta.file_size || meta.file_size === 0) return res.status(404).json({ message: '文件内容已丢失' })

      // 获取文件二进制数据
      const result = await pool.query(
        `SELECT ${dataColumn} FROM ${tableName} WHERE ${idColumn} = $1`,
        [id]
      )
      const fileData = result.rows[0][dataColumn]
      const buffer = Buffer.isBuffer(fileData) ? fileData : Buffer.from(fileData)

      // 设置响应头并直接发送二进制流
      const fileName = meta.file_name || 'download'
      const encodedName = encodeURIComponent(fileName)
      res.setHeader('Content-Type', meta.file_type || 'application/octet-stream')
      res.setHeader('Content-Length', buffer.length)
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`)
      res.setHeader('Cache-Control', 'public, max-age=3600')

      res.end(buffer)
    } catch (e) {
      console.error('流式下载失败:', e)
      if (!res.headersSent) {
        res.status(500).json({ message: '下载失败: ' + e.message })
      }
    }
  }
}

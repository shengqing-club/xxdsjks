import serverless from 'serverless-http'
import app from '../../backend/index.js'

// 包装 serverless handler，修复二进制响应问题
const serverlessHandler = serverless(app)

export const handler = async (event, context) => {
  const result = await serverlessHandler(event, context)

  // 检查响应体是否为 Buffer（二进制数据）
  if (result && Buffer.isBuffer(result.body)) {
    result.body = result.body.toString('base64')
    result.isBase64Encoded = true
  }

  return result
}

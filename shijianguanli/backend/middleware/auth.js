import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET 环境变量未设置，请在 .env 文件中配置！')
  process.exit(1)
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' })
}

export function authMiddleware(req, res, next) {
  if (!JWT_SECRET) {
    return res.status(500).json({ message: '服务器配置错误：JWT_SECRET 未设置' })
  }
  // 支持两种方式传递 token：Authorization header 或 URL query 参数（用于 window.open 下载）
  let token = null
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1]
  } else if (req.query && req.query.token) {
    token = req.query.token
  }
  if (!token) {
    return res.status(401).json({ message: '未登录或Token已过期' })
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded
    // 如果 token 将在 1 小时内过期，在响应头中附带新 token
    const now = Math.floor(Date.now() / 1000)
    if (decoded.exp && decoded.exp - now < 3600) {
      const newToken = signToken({ id: decoded.id, username: decoded.username, studentId: decoded.studentId, name: decoded.name, role: decoded.role })
      res.setHeader('X-Refresh-Token', newToken)
    }
    next()
  } catch {
    return res.status(401).json({ message: 'Token无效' })
  }
}

export function adminMiddleware(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: '无管理员权限' })
  }
  next()
}

export { JWT_SECRET }

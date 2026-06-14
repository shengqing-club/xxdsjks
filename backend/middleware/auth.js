import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set')
  process.exit(1)
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' })
}

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: '未登录或Token已过期' })
  }
  try {
    const token = authHeader.split(' ')[1]
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

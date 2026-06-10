import axios from 'axios'
import { ElMessage } from 'element-plus'

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
})

// 请求拦截器：自动附加 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    // 确保 Authorization 正确拼写，且去掉可能的引号
    config.headers['Authorization'] = `Bearer ${token.replace(/^["']|["']$/g, '')}`
  }
  return config
})

// 响应拦截器：401 自动跳转登录，统一错误处理
api.interceptors.response.use(
  (res) => {
    // 如果响应本身是 401，也跳转
    if (res.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
      return Promise.reject(new Error('未登录或Token已过期'))
    }
    return res
  },
  (err) => {
    if (err.response?.status === 401) {
      ElMessage.error('登录已过期，请重新登录')
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    } else if (err.code === 'ECONNABORTED') {
      ElMessage.error('请求超时，请检查网络')
    } else if (!err.response) {
      ElMessage.error('无法连接服务器，请检查网络')
    }
    return Promise.reject(err)
  }
)

export default api

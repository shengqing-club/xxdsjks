import axios from 'axios'
import { ElMessage } from 'element-plus'

// 401 防抖：避免并发请求同时触发多次跳转和提示
let isRedirecting = false

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// 请求拦截器：自动附加 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers['Authorization'] = `Bearer ${token.replace(/^["']|["']$/g, '')}`
  }
  return config
})

// 响应拦截器：401 自动跳转登录，Token 自动刷新，统一错误处理
api.interceptors.response.use(
  (res) => {
    // Token 自动刷新：后端在 token 即将过期时返回新 token
    const newToken = res.headers['x-refresh-token']
    if (newToken) {
      localStorage.setItem('token', newToken)
    }
    return res
  },
  (err) => {
    if (err.response?.status === 401) {
      if (!isRedirecting) {
        isRedirecting = true
        ElMessage.error('登录已过期，请重新登录')
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }
    } else if (err.code === 'ECONNABORTED') {
      ElMessage.error('请求超时，请检查网络')
    } else if (!err.response) {
      ElMessage.error('无法连接服务器，请检查网络')
    }
    return Promise.reject(err)
  }
)

export default api

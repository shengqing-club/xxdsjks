import api from './index'

// 获取课程列表
export function getCourses() {
  return api.get('/courses')
}

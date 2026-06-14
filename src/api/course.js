import api from './index'

// 获取课程列表
export function getCourses() {
  return api.get('/courses')
}

export const addCourse = (data) => api.post('/courses', data)
export const updateCourse = (id, data) => api.put(`/courses/${id}`, data)
export const deleteCourse = (id) => api.delete(`/courses/${id}`)
export const batchDeleteCourses = (ids) => api.post('/courses/batch-delete', { ids })

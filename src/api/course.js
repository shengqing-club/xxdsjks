import api from './index'

export function getCourses() {
  return api.get('/courses')
}

export function addCourse(data) {
  return api.post('/courses', data)
}

export function updateCourse(id, data) {
  return api.put(`/courses/${id}`, data)
}

export function deleteCourse(id) {
  return api.delete(`/courses/${id}`)
}

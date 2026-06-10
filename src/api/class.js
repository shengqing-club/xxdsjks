import api from './index'

export function getClasses(params) {
  return api.get('/classes', { params })
}

export function addClass(data) {
  return api.post('/classes', data)
}

export function updateClass(id, data) {
  return api.put(`/classes/${id}`, data)
}

export function deleteClass(id) {
  return api.delete(`/classes/${id}`)
}

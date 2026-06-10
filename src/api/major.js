import api from './index'

export function getMajors() {
  return api.get('/majors')
}

export function addMajor(data) {
  return api.post('/majors', data)
}

export function updateMajor(id, data) {
  return api.put(`/majors/${id}`, data)
}

export function deleteMajor(id) {
  return api.delete(`/majors/${id}`)
}

export function getMajorStats() {
  return api.get('/majors/stats')
}

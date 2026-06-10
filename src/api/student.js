import api from './index'

export function getStudents(keyword) {
  return api.get('/students', { params: keyword ? { keyword } : {} })
}

export function addStudent(student) {
  return api.post('/students', student)
}

export function updateStudent(id, student) {
  return api.put(`/students/${id}`, student)
}

export function deleteStudent(id) {
  return api.delete(`/students/${id}`)
}

export function getStudentByStudentId(studentId) {
  return api.get(`/students/by-student-id/${studentId}`)
}

export function getMajorStats() {
  return api.get('/students/stats/major')
}

export function getGenderStats() {
  return api.get('/students/stats/gender')
}

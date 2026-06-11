import api from './index'

export function getStudents(params) {
  return api.get('/students', { params })
}

// 获取同班同学（学生端班级一览用）
export function getClassmates() {
  return api.get('/students/classmates')
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

export function getMajorsList() {
  return api.get('/majors')
}

// 密码管理
export function resetStudentPassword(id, newPassword) {
  return api.post(`/students/${id}/reset-password`, { newPassword })
}

export function batchResetPassword(ids) {
  return api.post('/students/batch-reset-password', { ids })
}

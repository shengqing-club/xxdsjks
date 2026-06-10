import api from './index'

export function getGradesByStudent(studentId) {
  return api.get(`/grades/student/${studentId}`)
}

export function getAllGrades() {
  return api.get('/grades')
}

export function addGrade(grade) {
  return api.post('/grades', grade)
}

export function updateGrade(id, grade) {
  return api.put(`/grades/${id}`, grade)
}

export function deleteGrade(id) {
  return api.delete(`/grades/${id}`)
}

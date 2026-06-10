import api from './index'

export function getGradesByStudent(studentId) {
  return api.get(`/grades/student/${studentId}`)
}

export function getAllGrades(params) {
  return api.get('/grades', { params })
}

// 学生端获取成绩排名（无需管理员权限）
export function getPublicRanking(params) {
  return api.get('/grades/ranking/public', { params })
}

export function addGrade(grade) {
  return api.post('/grades', grade)
}

export function batchImportGrades(grades) {
  return api.post('/grades/batch-import', { grades })
}

export function updateGrade(id, grade) {
  return api.put(`/grades/${id}`, grade)
}

export function deleteGrade(id) {
  return api.delete(`/grades/${id}`)
}

export function getGradeRanking(params) {
  return api.get('/grades/ranking', { params })
}

export function getGradeDistribution() {
  return api.get('/grades/stats/distribution')
}

export function getCourseTypeStats() {
  return api.get('/grades/stats/course-type')
}

export function getGradeByClass() {
  return api.get('/grades/stats/by-class')
}

import api from './index'

export const getExams = (params) => api.get('/exams', { params })
export const getUpcomingExams = (params) => api.get('/exams/upcoming', { params })
export const getClassExams = (className) => api.get(`/exams/class/${className}`)
export const addExam = (data) => api.post('/exams', data)
export const updateExam = (id, data) => api.put(`/exams/${id}`, data)
export const deleteExam = (id) => api.delete(`/exams/${id}`)
export const getExamClasses = () => api.get('/exams/classes/list')
export const batchDeleteExams = (ids) => api.post('/exams/batch-delete', { ids })

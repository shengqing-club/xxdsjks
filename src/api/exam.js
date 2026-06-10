import request from './index'

export const getExams = (params) => request.get('/exams', { params })
export const getUpcomingExams = (params) => request.get('/exams/upcoming', { params })
export const getClassExams = (className) => request.get(`/exams/class/${className}`)
export const addExam = (data) => request.post('/exams', data)
export const updateExam = (id, data) => request.put(`/exams/${id}`, data)
export const deleteExam = (id) => request.delete(`/exams/${id}`)
export const getExamClasses = () => request.get('/exams/classes/list')

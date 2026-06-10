import api from './index'

export function getFiles(category) {
  const params = category ? { category } : {}
  return api.get('/files', { params })
}

export function uploadFile(formData) {
  return api.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export function downloadFile(id) {
  return api.get(`/files/download/${id}`, { responseType: 'blob' })
}

export function deleteFile(id) {
  return api.delete(`/files/${id}`)
}

export function getStudentUploadSetting() {
  return api.get('/files/setting/student-upload')
}

export function setStudentUploadSetting(enabled) {
  return api.put('/files/setting/student-upload', { enabled })
}

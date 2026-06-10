import api from './index'

export function getFiles(category) {
  return api.get('/files', { params: category ? { category } : {} })
}

export function uploadFile(formData) {
  return api.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export function downloadFile(id) {
  return api.get(`/files/${id}/download`, { responseType: 'blob' })
}

export function deleteFile(id) {
  return api.delete(`/files/${id}`)
}

export function getStudentUploadSetting() {
  return api.get('/files/setting/student-upload')
}

export function setStudentUploadSetting(enabled) {
  return api.post('/files/setting/student-upload', { enabled })
}

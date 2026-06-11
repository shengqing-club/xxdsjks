import api from './index'

export function getFiles(category) {
  const params = {}
  if (category && typeof category === 'string' && category.trim()) {
    params.category = category.trim()
  }
  return api.get('/files', { params })
}

export function uploadFile(formData) {
  return api.post('/files/upload', formData, {
    timeout: 120000,
  })
}

export function downloadFile(id) {
  return api.get(`/files/${id}/download`, {
    responseType: 'blob',
    timeout: 120000,
  })
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

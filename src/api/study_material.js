import api from './index'

// 获取复习资料列表
export function getStudyMaterials(params) {
  return api.get('/study-materials', { params })
}

// 上传复习资料
export function uploadStudyMaterial(formData) {
  return api.post('/study-materials/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

// 删除复习资料
export function deleteStudyMaterial(id) {
  return api.delete(`/study-materials/${id}`)
}

// 下载复习资料
export function downloadStudyMaterial(id) {
  return api.get(`/study-materials/download/${id}`, {
    responseType: 'blob'
  })
}

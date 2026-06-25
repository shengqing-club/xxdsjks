import api from './index'
import { smartDownload } from './utils'
import { chunkedUpload } from './chunkedUpload'

// 获取复习资料列表
export function getStudyMaterials(params) {
  return api.get('/study-materials', { params })
}

// 分片上传复习资料（大文件自动分片，小文件直接上传）
export function uploadStudyMaterial(formData, onProgress) {
  const file = formData.get('file')
  const extraFields = {}
  for (const [key, val] of formData.entries()) {
    if (key !== 'file') extraFields[key] = val
  }
  return chunkedUpload('/study-materials', file, extraFields, onProgress)
}

// 删除复习资料
export function deleteStudyMaterial(id) {
  return api.delete(`/study-materials/${id}`)
}

// 下载复习资料（流式下载）
export function downloadStudyMaterial(id, fileName, fileSize, fileType, onProgress) {
  return smartDownload(
    `/study-materials/download/${id}`,
    null, // 不需要分片下载 URL
    { fileSize, fileType },
    fileName,
    onProgress
  )
}

// 获取版本历史
export function getMaterialVersions(id) {
  return api.get(`/study-materials/${id}/versions`)
}

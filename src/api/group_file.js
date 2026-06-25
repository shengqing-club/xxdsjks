import api from './index'
import { smartDownload } from './utils'
import { chunkedUpload } from './chunkedUpload'

// 获取分组文件列表
export function getGroupFiles(group_id) {
  return api.get(`/group-files/${group_id}`)
}

// 分片上传文件到分组（大文件自动分片，小文件直接上传）
export function uploadGroupSharedFile(group_id, formData, onProgress) {
  const file = formData.get('file')
  const extraFields = {}
  for (const [key, val] of formData.entries()) {
    if (key !== 'file') extraFields[key] = val
  }
  return chunkedUpload(`/group-files/${group_id}`, file, extraFields, onProgress)
}

export function downloadGroupFile(file_id, fileName, fileSize, fileType, onProgress) {
  return smartDownload(
    `/group-files/download/${file_id}`,
    `/group-files/download/${file_id}/chunk`,
    { fileSize, fileType },
    fileName,
    onProgress
  )
}

// 删除分组文件
export function deleteGroupFile(file_id) {
  return api.delete(`/group-files/${file_id}`)
}

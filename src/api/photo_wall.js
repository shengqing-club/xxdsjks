import api from './index'

export function getPhotoWallSetting() {
  return api.get('/photo-wall/setting')
}

export function setPhotoWallSetting(enabled) {
  return api.post('/photo-wall/setting', { enabled })
}

export function getPhotos() {
  return api.get('/photo-wall')
}

export function uploadPhoto(formData) {
  return api.post('/photo-wall/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
}

export function deletePhoto(id) {
  return api.delete(`/photo-wall/${id}`)
}

export function setPhotoPrivacy(id, isPublic) {
  return api.put(`/photo-wall/${id}/privacy`, { is_public: isPublic })
}

// 通用 base64 转 Blob
function base64ToBlob(base64, fileType) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: fileType || 'image/png' })
}

export async function downloadPhoto(id) {
  // 先尝试 JSON（serverless 环境返回 base64）
  try {
    const res = await api.get(`/photo-wall/download/${id}`)
    if (res.data && res.data.base64) {
      const blob = base64ToBlob(res.data.base64, res.data.fileType)
      return URL.createObjectURL(blob)
    }
  } catch (e) {
    // 不是 JSON 响应，继续尝试 blob
  }
  // 传统环境：直接 blob 下载
  const res = await api.get(`/photo-wall/download/${id}`, { responseType: 'blob' })
  return URL.createObjectURL(new Blob([res.data]))
}

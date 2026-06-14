import api from './index'
import { smartLoadImage } from './utils'

export function getPhotoWallSetting() {
  return api.get('/photo-wall/setting')
}

export function setPhotoWallSetting(enabled) {
  return api.post('/photo-wall/setting', { enabled })
}

export function getPhotos() {
  return api.get('/photo-wall')
}

// 上传照片（不手动设置 Content-Type，让 axios 自动添加 boundary）
export function uploadPhoto(formData) {
  return api.post('/photo-wall/upload', formData, {
    timeout: 60000,
  })
}

export function deletePhoto(id) {
  return api.delete(`/photo-wall/${id}`)
}

export function setPhotoPrivacy(id, isPublic) {
  return api.put(`/photo-wall/${id}/privacy`, { is_public: isPublic })
}

export async function downloadPhoto(id, fileSize) {
  return smartLoadImage(
    `/photo-wall/download/${id}`,
    `/photo-wall/download/${id}/chunk`,
    { fileSize }
  )
}

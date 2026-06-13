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

export async function downloadPhoto(id, fileSize) {
  return smartLoadImage(
    `/photo-wall/download/${id}`,
    `/photo-wall/download/${id}/chunk`,
    { fileSize }
  )
}

import api from './index'

export function getActiveAnnouncements() {
  return api.get('/announcements/active')
}

export function getAnnouncements() {
  return api.get('/announcements')
}

export function addAnnouncement(ann) {
  return api.post('/announcements', ann)
}

export function updateAnnouncement(id, ann) {
  return api.put(`/announcements/${id}`, ann)
}

export function deleteAnnouncement(id) {
  return api.delete(`/announcements/${id}`)
}

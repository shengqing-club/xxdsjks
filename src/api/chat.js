import api from './index'

export function getChatMessages(params) {
  return api.get('/chat', { params })
}

export function sendChatMessage(data) {
  return api.post('/chat/send', data)
}

export function getOnlineCount() {
  return api.get('/chat/online-count')
}

export function getNotifications(studentId) {
  return api.get('/chat/notifications', { params: { studentId } })
}

export function getUnreadCount(studentId) {
  return api.get('/chat/notifications/unread-count', { params: { studentId } })
}

export function markNotificationRead(id) {
  return api.put(`/chat/notifications/${id}/read`)
}

export function sendNotifications(data) {
  return api.post('/chat/notifications', data)
}

export function clearChatMessages(olderThanDays) {
  return api.delete('/chat/clear', { data: { olderThanDays } })
}

export function clearNotifications(olderThanDays) {
  return api.delete('/chat/notifications/clear', { data: { olderThanDays } })
}

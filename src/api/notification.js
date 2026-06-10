import api from './index'

// 获取当前用户的通知
export function getNotifications() {
  return api.get('/notifications')
}

// 获取未读通知数量
export function getUnreadCount() {
  return api.get('/notifications/unread-count')
}

// 标记单条通知已读
export function markAsRead(id) {
  return api.put(`/notifications/${id}/read`)
}

// 全部标记已读
export function markAllAsRead() {
  return api.put('/notifications/read-all')
}

// 删除通知
export function deleteNotification(id) {
  return api.delete(`/notifications/${id}`)
}

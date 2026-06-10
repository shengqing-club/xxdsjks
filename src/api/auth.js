import api from './index'

export function login(username, password) {
  return api.post('/auth/login', { username, password })
}

export function logout() {
  return api.post('/auth/logout')
}

export function getMe() {
  return api.get('/auth/me')
}

export function changePassword(username, oldPassword, newPassword) {
  return api.post('/auth/change-password', { username, oldPassword, newPassword })
}

export function resetPassword(username, newPassword) {
  return api.post('/auth/reset-password', { username, newPassword })
}

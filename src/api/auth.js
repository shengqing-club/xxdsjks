import api from './index'

export function login(username, password) {
  return api.post('/auth/login', { username, password })
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function getMe() {
  return api.get('/auth/me')
}

export function changePassword(data) {
  return api.put('/auth/change-password', data)
}


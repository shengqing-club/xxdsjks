import { ref, computed } from 'vue'
import { login as loginApi, logout as logoutApi } from '../api/auth'

const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))
const token = ref(localStorage.getItem('token') || '')

export function useAuth() {
  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const isStudent = computed(() => user.value?.role === 'student')
  const displayName = computed(() => user.value?.displayName || '')
  const role = computed(() => user.value?.role || '')
  const studentId = computed(() => user.value?.studentId || '')

  const doLogin = async (username, password) => {
    const res = await loginApi(username, password)
    const data = res.data
    const u = data.user
    token.value = data.token
    user.value = {
      username: u.username,
      role: u.role,
      displayName: u.displayName,
      studentId: u.studentId,
    }
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(user.value))
    return { token: data.token, user: u }
  }

  const doLogout = async () => {
    try { await logoutApi() } catch (e) { /* ignore */ }
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return {
    user, token, isLoggedIn, isAdmin, isStudent,
    displayName, role, studentId,
    doLogin, doLogout,
  }
}

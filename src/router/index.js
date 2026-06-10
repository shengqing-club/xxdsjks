import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../stores/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
  },
  {
    path: '/',
    component: () => import('../views/admin/AdminLayout.vue'),
    redirect: '/welcome',
    meta: { requiresAuth: true, role: 'admin' },
    children: [
      { path: 'welcome', name: 'Welcome', component: () => import('../views/admin/AdminWelcome.vue') },
      { path: 'all', name: 'AllStudents', component: () => import('../views/admin/AllStudents.vue') },
      { path: 'add', name: 'AddStudent', component: () => import('../views/admin/AddStudent.vue') },
      { path: 'grades', name: 'GradeManagement', component: () => import('../views/admin/GradeManagement.vue') },
      { path: 'announcements', name: 'AnnouncementManagement', component: () => import('../views/admin/AnnouncementManagement.vue') },
      { path: 'files', name: 'FileManagement', component: () => import('../views/admin/FileManagement.vue') },
      { path: 'bar', name: 'BarChart', component: () => import('../views/admin/BarChart.vue') },
      { path: 'pie', name: 'PieChart', component: () => import('../views/admin/PieChart.vue') },
    ],
  },
  {
    path: '/student',
    component: () => import('../views/student/StudentLayout.vue'),
    redirect: '/student/dashboard',
    meta: { requiresAuth: true, role: 'student' },
    children: [
      { path: 'dashboard', name: 'StudentDashboard', component: () => import('../views/student/StudentDashboard.vue') },
      { path: 'profile', name: 'StudentProfile', component: () => import('../views/student/StudentProfile.vue') },
      { path: 'grades', name: 'StudentGrades', component: () => import('../views/student/StudentGrades.vue') },
      { path: 'ranking', name: 'StudentRanking', component: () => import('../views/student/StudentRanking.vue') },
      { path: 'class', name: 'ClassOverview', component: () => import('../views/student/ClassOverview.vue') },
      { path: 'files', name: 'FileSharing', component: () => import('../views/student/FileSharing.vue') },
      { path: 'password', name: 'ChangePassword', component: () => import('../views/student/ChangePassword.vue') },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const { isLoggedIn, isAdmin, isStudent } = useAuth()
  if (to.meta.requiresAuth && !isLoggedIn.value) {
    return next('/login')
  }
  if (to.meta.role === 'admin' && !isAdmin.value) {
    return next('/login')
  }
  if (to.meta.role === 'student' && !isStudent.value) {
    return next('/login')
  }
  if (to.path === '/login' && isLoggedIn.value) {
    return next(isAdmin.value ? '/' : '/student')
  }
  next()
})

export default router

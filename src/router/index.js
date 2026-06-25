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
      { path: 'ranking', name: 'GradeRanking', component: () => import('../views/admin/GradeRanking.vue') },
      { path: 'majors', name: 'MajorManagement', component: () => import('../views/admin/MajorManagement.vue') },
      { path: 'classes', name: 'ClassManagement', component: () => import('../views/admin/ClassManagement.vue') },
      { path: 'courses', name: 'CourseManagement', component: () => import('../views/admin/CourseManagement.vue') },
      { path: 'announcements', name: 'AnnouncementManagement', component: () => import('../views/admin/AnnouncementManagement.vue') },
      { path: 'files', name: 'FileManagement', component: () => import('../views/admin/FileManagement.vue') },
      { path: 'study-materials', name: 'StudyMaterialManagement', component: () => import('../views/admin/StudyMaterialManagement.vue') },
      { path: 'groups', name: 'GroupManagement', component: () => import('../views/admin/GroupManagement.vue') },
      { path: 'exams', name: 'ExamManagement', component: () => import('../views/admin/ExamManagement.vue') },
      { path: 'site-settings', name: 'SiteSettings', component: () => import('../views/admin/SiteSettings.vue') },
      { path: 'rewards', name: 'RewardManagement', component: () => import('../views/admin/RewardManagement.vue') },
      { path: 'photo-wall', name: 'PhotoWallManagement', component: () => import('../views/admin/PhotoWallManagement.vue') },
      { path: 'forum', name: 'ForumManagement', component: () => import('../views/admin/ForumManagement.vue') },
      { path: 'bar', name: 'BarChart', component: () => import('../views/admin/BarChart.vue') },
      { path: 'pie', name: 'PieChart', component: () => import('../views/admin/PieChart.vue') },
      { path: 'game', name: 'BubbleGame', component: () => import('../views/BubbleGame.vue') },
      { path: 'game-settings', name: 'GameSettings', component: () => import('../views/admin/GameSettings.vue') },
    ],
  },
  {
    path: '/student',
    component: () => import('../views/student/StudentLayout.vue'),
    redirect: '/student/dashboard',
    meta: { requiresAuth: true, role: 'student' },
    children: [
      { path: 'dashboard', name: 'StudentDashboard', component: () => import('../views/student/StudentDashboard.vue') },
      { path: 'exams', name: 'StudentExams', component: () => import('../views/student/StudentExams.vue') },
      { path: 'profile', name: 'StudentProfile', component: () => import('../views/student/StudentProfile.vue') },
      { path: 'grades', name: 'StudentGrades', component: () => import('../views/student/StudentGrades.vue') },
      { path: 'ranking', name: 'StudentRanking', component: () => import('../views/student/StudentRanking.vue') },
      { path: 'class', name: 'ClassOverview', component: () => import('../views/student/ClassOverview.vue') },
      { path: 'files', name: 'FileSharing', component: () => import('../views/student/FileSharing.vue') },
      { path: 'study-materials', name: 'StudentStudyMaterials', component: () => import('../views/student/StudentStudyMaterials.vue') },
      { path: 'groups', name: 'StudentGroups', component: () => import('../views/student/StudentGroups.vue') },
      { path: 'photo-wall', name: 'PhotoWall', component: () => import('../views/student/PhotoWall.vue') },
      { path: 'forum', name: 'StudentForum', component: () => import('../views/student/StudentForum.vue') },
      { path: 'password', name: 'ChangePassword', component: () => import('../views/student/ChangePassword.vue') },
      { path: 'game', name: 'StudentBubbleGame', component: () => import('../views/BubbleGame.vue') },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/login' },
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

<template>
  <div :class="['admin-layout', { 'birthday-active': isBirthday }]">
    <!-- Header -->
    <header class="admin-header">
      <div class="header-left">
        <img src="../../assets/logo.png" alt="Logo" class="header-logo" />
        <h1 class="header-title">学生信息管理系统</h1>
      </div>
      <div class="header-right">
        <el-button v-if="isMobile" circle size="small" @click="toggleSidebar" class="hamburger-btn">
          <el-icon><component :is="sidebarVisible ? 'Close' : 'Menu'" /></el-icon>
        </el-button>
        <el-button circle size="small" @click="toggleDarkMode" :title="isDark ? '切换亮色' : '切换暗色'">
          <el-icon><component :is="isDark ? Sunny : Moon" /></el-icon>
        </el-button>
        <NotificationCenter />
        <el-dropdown trigger="click" @command="handleUserCommand">
          <span class="user-name dropdown-trigger">
            <el-icon><UserFilled /></el-icon>
            {{ displayName }}
            <el-icon class="dropdown-arrow"><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="changePassword">
                <el-icon><Lock /></el-icon> 修改密码
              </el-dropdown-item>
              <el-dropdown-item divided command="logout">
                <el-icon><SwitchButton /></el-icon> 退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </header>

    <!-- 公告横幅 -->
    <AnnouncementBar />

    <!-- Body -->
    <div class="admin-body">
      <!-- Sidebar (Desktop) -->
      <aside v-if="!isMobile" class="admin-sidebar">
        <el-menu
          :default-active="activeMenu"
          :default-openeds="['student-mgmt', 'data-visual']"
          router
          class="sidebar-menu"
        >
          <el-menu-item index="/welcome">
            <el-icon><School /></el-icon>
            <span>学校简介</span>
          </el-menu-item>

          <el-sub-menu index="student-mgmt">
            <template #title>
              <el-icon><UserFilled /></el-icon>
              <span>学生信息管理</span>
            </template>
            <el-menu-item index="/all">
              <el-icon><Search /></el-icon>
              <span>学生信息查询</span>
            </el-menu-item>
            <el-menu-item index="/add">
              <el-icon><Plus /></el-icon>
              <span>新增学生信息</span>
            </el-menu-item>
          </el-sub-menu>

          <el-menu-item index="/grades">
            <el-icon><EditPen /></el-icon>
            <span>成绩管理</span>
          </el-menu-item>

          <el-menu-item index="/ranking">
            <el-icon><TrophyBase /></el-icon>
            <span>成绩排名</span>
          </el-menu-item>

          <el-menu-item index="/majors">
            <el-icon><Collection /></el-icon>
            <span>专业管理</span>
          </el-menu-item>

          <el-menu-item index="/classes">
            <el-icon><OfficeBuilding /></el-icon>
            <span>班级管理</span>
          </el-menu-item>

          <el-menu-item index="/courses">
            <el-icon><Notebook /></el-icon>
            <span>课程管理</span>
          </el-menu-item>

          <el-menu-item index="/announcements">
            <el-icon><Bell /></el-icon>
            <span>公告管理</span>
          </el-menu-item>

          <el-menu-item index="/files">
            <el-icon><FolderOpened /></el-icon>
            <span>文件管理</span>
          </el-menu-item>

          <el-menu-item index="/study-materials">
            <el-icon><Reading /></el-icon>
            <span>复习资料</span>
          </el-menu-item>

          <el-menu-item index="/groups">
            <el-icon><User /></el-icon>
            <span>分组管理</span>
          </el-menu-item>

          <el-menu-item index="/exams">
            <el-icon><Clock /></el-icon>
            <span>考试管理</span>
          </el-menu-item>

          <el-menu-item index="/site-settings">
            <el-icon><Setting /></el-icon>
            <span>站点设置</span>
          </el-menu-item>

          <el-menu-item index="/rewards">
            <el-icon><Trophy /></el-icon>
            <span>奖惩管理</span>
          </el-menu-item>

          <el-menu-item index="/photo-wall">
            <el-icon><Picture /></el-icon>
            <span>照片墙管理</span>
          </el-menu-item>

          <el-menu-item index="/forum">
            <el-icon><ChatDotRound /></el-icon>
            <span>论坛管理</span>
          </el-menu-item>

          <el-menu-item index="/game">
            <el-icon><Present /></el-icon>
            <span>泡泡工坊</span>
          </el-menu-item>

          <el-menu-item index="/game-settings">
            <el-icon><Setting /></el-icon>
            <span>游戏参数</span>
          </el-menu-item>

          <el-sub-menu index="data-visual"> <!-- 桌面端 -->
            <template #title>
              <el-icon><DataAnalysis /></el-icon>
              <span>数据可视化</span>
            </template>
            <el-menu-item index="/bar">
              <el-icon><Histogram /></el-icon>
              <span>柱状图</span>
            </el-menu-item>
            <el-menu-item index="/pie">
              <el-icon><PieChart /></el-icon>
              <span>饼图</span>
            </el-menu-item>
          </el-sub-menu>
        </el-menu>
      </aside>

      <!-- Mobile Sidebar Drawer -->
      <Teleport to="body">
        <Transition name="sidebar-fade">
          <div v-if="isMobile && sidebarVisible" class="mobile-sidebar-overlay" @click="sidebarVisible = false"></div>
        </Transition>
        <Transition name="sidebar-slide">
          <div v-if="isMobile && sidebarVisible" class="mobile-sidebar">
            <el-menu
              :default-active="activeMenu"
              :default-openeds="['student-mgmt', 'data-visual']"
              router
              class="sidebar-menu"
              @select="handleMenuSelect"
            >
              <el-menu-item index="/welcome">
                <el-icon><School /></el-icon>
                <span>学校简介</span>
              </el-menu-item>

              <el-sub-menu index="student-mgmt">
                <template #title>
                  <el-icon><UserFilled /></el-icon>
                  <span>学生信息管理</span>
                </template>
                <el-menu-item index="/all">
                  <el-icon><Search /></el-icon>
                  <span>学生信息查询</span>
                </el-menu-item>
                <el-menu-item index="/add">
                  <el-icon><Plus /></el-icon>
                  <span>新增学生信息</span>
                </el-menu-item>
              </el-sub-menu>

              <el-menu-item index="/grades">
                <el-icon><EditPen /></el-icon>
                <span>成绩管理</span>
              </el-menu-item>

              <el-menu-item index="/ranking">
                <el-icon><TrophyBase /></el-icon>
                <span>成绩排名</span>
              </el-menu-item>

              <el-menu-item index="/majors">
                <el-icon><Collection /></el-icon>
                <span>专业管理</span>
              </el-menu-item>

              <el-menu-item index="/classes">
                <el-icon><OfficeBuilding /></el-icon>
                <span>班级管理</span>
              </el-menu-item>

              <el-menu-item index="/courses">
                <el-icon><Notebook /></el-icon>
                <span>课程管理</span>
              </el-menu-item>

              <el-menu-item index="/announcements">
                <el-icon><Bell /></el-icon>
                <span>公告管理</span>
              </el-menu-item>

              <el-menu-item index="/files">
                <el-icon><FolderOpened /></el-icon>
                <span>文件管理</span>
              </el-menu-item>

              <el-menu-item index="/study-materials">
                <el-icon><Reading /></el-icon>
                <span>复习资料</span>
              </el-menu-item>

              <el-menu-item index="/groups">
                <el-icon><User /></el-icon>
                <span>分组管理</span>
              </el-menu-item>

              <el-menu-item index="/exams">
                <el-icon><Clock /></el-icon>
                <span>考试管理</span>
              </el-menu-item>

              <el-menu-item index="/site-settings">
                <el-icon><Setting /></el-icon>
                <span>站点设置</span>
              </el-menu-item>

              <el-menu-item index="/rewards">
                <el-icon><Trophy /></el-icon>
                <span>奖惩管理</span>
              </el-menu-item>

              <el-menu-item index="/photo-wall">
                <el-icon><Picture /></el-icon>
                <span>照片墙管理</span>
              </el-menu-item>

              <el-menu-item index="/forum">
                <el-icon><ChatDotRound /></el-icon>
                <span>论坛管理</span>
              </el-menu-item>

              <el-menu-item index="/game">
                <el-icon><Present /></el-icon>
                <span>泡泡工坊</span>
              </el-menu-item>

              <el-menu-item index="/game-settings">
                <el-icon><Setting /></el-icon>
                <span>游戏参数</span>
              </el-menu-item>

              <el-sub-menu index="data-visual"> <!-- 移动端 -->
                <template #title>
                  <el-icon><DataAnalysis /></el-icon>
                  <span>数据可视化</span>
                </template>
                <el-menu-item index="/bar">
                  <el-icon><Histogram /></el-icon>
                  <span>柱状图</span>
                </el-menu-item>
                <el-menu-item index="/pie">
                  <el-icon><PieChart /></el-icon>
                  <span>饼图</span>
                </el-menu-item>
              </el-sub-menu>
            </el-menu>
          </div>
        </Transition>
      </Teleport>

      <!-- Content -->
      <main class="admin-content">
        <router-view />
        <!-- 公安备案 -->
        <div class="beian-footer">
          <a href="https://beian.mps.gov.cn/#/query/webSearch?code=61030202000574" rel="noreferrer" target="_blank" class="beian-link">
            <img src="/beian.png" alt="公安备案图标" class="beian-icon" />
            <span>陕公网安备61030202000574号</span>
          </a>
        </div>
      </main>
    </div>

    <!-- Chat Room -->
    <ChatRoom />

    <!-- 修改密码对话框 -->
    <el-dialog v-model="showPasswordDialog" title="修改密码" width="400px" destroy-on-close>
      <el-form :model="pwdForm" label-width="80px">
        <el-form-item label="旧密码">
          <el-input v-model="pwdForm.oldPassword" type="password" show-password placeholder="请输入旧密码" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.newPassword" type="password" show-password placeholder="请输入新密码（至少6位）" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="pwdForm.confirmPassword" type="password" show-password placeholder="请再次输入新密码" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showPasswordDialog = false">取消</el-button>
        <el-button type="primary" :loading="pwdLoading" @click="handleChangePassword">确认修改</el-button>
      </template>
    </el-dialog>

    <!-- 生日彩蛋组件 -->
    <BirthdayEgg />
    <!-- 生日蛋糕蜡烛 -->
    <BirthdayCake />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuth } from '../../stores/auth'
import { changePassword } from '../../api/auth'
import AnnouncementBar from '../../components/AnnouncementBar.vue'
import BirthdayEgg from '../../components/BirthdayEgg.vue'
import BirthdayCake from '../../components/BirthdayCake.vue'
import ChatRoom from '../../views/ChatRoom.vue'
import NotificationCenter from '../../components/NotificationCenter.vue'
import { useBirthday } from '../../composables/useBirthday'
import {
  School,
  UserFilled,
  Search,
  Plus,
  EditPen,
  Bell,
  DataAnalysis,
  Histogram,
  PieChart,
  FolderOpened,
  Clock,
  TrophyBase,
  Collection,
  OfficeBuilding,
  Notebook,
  Reading,
  User,
  Setting,
  Trophy,
  Picture,
  ChatDotRound,
  Present,
  Moon,
  Sunny,
  Menu,
  Close,
  ArrowDown,
  Lock,
  SwitchButton
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const { displayName, doLogout } = useAuth()
const { isBirthday } = useBirthday()

const activeMenu = computed(() => route.path)
const isDark = ref(false)
const isMobile = ref(false)
const sidebarVisible = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

const toggleSidebar = () => {
  sidebarVisible.value = !sidebarVisible.value
}

const handleMenuSelect = () => {
  if (isMobile.value) {
    sidebarVisible.value = false
  }
}

const toggleDarkMode = () => {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark')
  localStorage.setItem('darkMode', isDark.value)
}

const handleLogout = async () => {
  await doLogout()
  router.push('/login')
}

const handleUserCommand = (command) => {
  if (command === 'changePassword') {
    showPasswordDialog.value = true
  } else if (command === 'logout') {
    handleLogout()
  }
}

const showPasswordDialog = ref(false)
const pwdLoading = ref(false)
const pwdForm = ref({ oldPassword: '', newPassword: '', confirmPassword: '' })

async function handleChangePassword() {
  if (!pwdForm.value.oldPassword) return ElMessage.warning('请输入旧密码')
  if (!pwdForm.value.newPassword || pwdForm.value.newPassword.length < 6) return ElMessage.warning('新密码至少6位')
  if (pwdForm.value.newPassword !== pwdForm.value.confirmPassword) return ElMessage.warning('两次输入的密码不一致')
  pwdLoading.value = true
  try {
    await changePassword({ oldPassword: pwdForm.value.oldPassword, newPassword: pwdForm.value.newPassword })
    ElMessage.success('密码修改成功，请重新登录')
    showPasswordDialog.value = false
    pwdForm.value = { oldPassword: '', newPassword: '', confirmPassword: '' }
    // 退出登录
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '修改失败')
  } finally {
    pwdLoading.value = false
  }
}
</script>

<style scoped>
.admin-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
  padding: 0 24px;
  background: var(--header-bg);
  color: var(--header-text);
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-logo {
  height: 40px;
  width: auto;
  object-fit: contain;
  max-width: 200px;
}

.header-title {
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 1px;
  margin: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: var(--header-text);
}
.dropdown-trigger {
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;
}
.dropdown-trigger:hover {
  background: rgba(255, 255, 255, 0.15);
}
.dropdown-arrow {
  margin-left: 2px;
  font-size: 12px;
  transition: transform 0.2s;
}
.dropdown-trigger:hover .dropdown-arrow {
  transform: rotate(180deg);
}

.admin-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.admin-sidebar {
  width: 220px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
  flex-shrink: 0;
}

.sidebar-menu {
  border-right: none;
  height: 100%;
}

.sidebar-menu .el-menu-item.is-active {
  background-color: var(--sidebar-active-bg);
  color: var(--accent);
  border-right: 3px solid var(--accent);
  font-weight: 600;
}

.admin-content {
  flex: 1;
  background: var(--bg-primary);
  padding: 20px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .admin-header { padding: 0 12px; height: 52px; }
  .header-title { font-size: 16px; }
  .header-logo { height: 30px; max-width: 120px; }
  .admin-content { padding: 12px; }
  .user-name { display: none; }
}

@media (max-width: 480px) {
  .admin-header { padding: 0 8px; height: 48px; }
  .header-title { font-size: 14px; }
  .header-logo { height: 26px; max-width: 100px; }
  .admin-content { padding: 8px; }
}

.hamburger-btn {
  color: var(--header-text) !important;
  border-color: rgba(255,255,255,0.3) !important;
  background: rgba(255,255,255,0.1) !important;
}

.mobile-sidebar-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.mobile-sidebar {
  position: fixed;
  top: 0; left: 0;
  width: 240px;
  height: 100vh;
  background: var(--sidebar-bg);
  z-index: 1001;
  overflow-y: auto;
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.15);
  padding-top: 12px;
}

.sidebar-fade-enter-active,
.sidebar-fade-leave-active { transition: opacity 0.3s ease; }
.sidebar-fade-enter-from,
.sidebar-fade-leave-to { opacity: 0; }
.sidebar-slide-enter-active,
.sidebar-slide-leave-active { transition: transform 0.3s ease; }
.sidebar-slide-enter-from,
.sidebar-slide-leave-to { transform: translateX(-100%); }

/* Birthday atmosphere - only on 6.25 */
.birthday-active .user-avatar,
.birthday-active .avatar-img {
  box-shadow: 0 0 15px 3px rgba(255, 215, 0, 0.5), 0 0 30px 5px rgba(255, 182, 193, 0.3);
  animation: avatarGlow 2s ease-in-out infinite;
}

.birthday-active .admin-sidebar .el-avatar::after {
  content: '🎂';
  position: absolute;
  bottom: -2px;
  right: -2px;
  font-size: 14px;
}

@keyframes avatarGlow {
  0%, 100% { box-shadow: 0 0 15px 3px rgba(255, 215, 0, 0.5), 0 0 30px 5px rgba(255, 182, 193, 0.3); }
  50% { box-shadow: 0 0 25px 8px rgba(255, 215, 0, 0.7), 0 0 40px 10px rgba(255, 182, 193, 0.5); }
}

/* 公安备案 */
.beian-footer {
  width: 100%;
  padding: 16px;
  text-align: center;
}
.beian-footer .beian-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  text-decoration: none;
  color: var(--text-muted);
  font-size: 12px;
  transition: color 0.2s;
}
.beian-footer .beian-link:hover {
  color: var(--accent);
}
.beian-footer .beian-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}
</style>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuth } from '../../stores/auth'
import { DataBoard, Calendar, User, Document, Trophy, OfficeBuilding, FolderOpened, SwitchButton, ChatDotRound, Reading, Picture, Moon, Sunny, ArrowDown, Lock, Menu, Close, Present } from '@element-plus/icons-vue'
import AnnouncementBar from '../../components/AnnouncementBar.vue'
import BirthdayEgg from '../../components/BirthdayEgg.vue'
import BirthdayCake from '../../components/BirthdayCake.vue'
import ChatRoom from '../../views/ChatRoom.vue'
import NotificationCenter from '../../components/NotificationCenter.vue'
import { useBirthday } from '../../composables/useBirthday'
import { getFullscreenText } from '../../api/settings'
import { changePassword } from '../../api/auth'

const { isBirthday } = useBirthday()

const route = useRoute()
const router = useRouter()
const { displayName, doLogout } = useAuth()

const activeMenu = computed(() => route.path)
const isDark = ref(false)

const isMobile = ref(false)
const sidebarVisible = ref(false)

const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

const toggleSidebar = () => {
  sidebarVisible.value = !sidebarVisible.value
}

// 点击菜单项后关闭移动端侧边栏
const handleMenuSelect = () => {
  if (isMobile.value) {
    sidebarVisible.value = false
  }
}

onMounted(() => {
  isDark.value = document.documentElement.classList.contains('dark')
})

const toggleDarkMode = () => {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('dark')
  localStorage.setItem('darkMode', isDark.value)
}

const handleLogout = async () => {
  await doLogout()
  ElMessage.success('已退出登录')
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
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '修改失败')
  } finally {
    pwdLoading.value = false
  }
}

// ========== 全屏文字（所有学生端页面生效） ==========
const fullscreenEnabled = ref(false)
const fullscreenContent = ref('')
const fullscreenFont = ref('serif')
let fullscreenPolling = null

const fetchFullscreenText = async () => {
  try {
    const res = await getFullscreenText()
    fullscreenEnabled.value = res.data.enabled
    fullscreenContent.value = res.data.content
    fullscreenFont.value = res.data.font || 'serif'
  } catch (e) {
    // 静默失败
  }
}

onMounted(() => {
  fetchFullscreenText()
  fullscreenPolling = setInterval(fetchFullscreenText, 10000)
})

onUnmounted(() => {
  if (fullscreenPolling) clearInterval(fullscreenPolling)
})
</script>

<template>
  <div :class="['student-layout', { 'birthday-active': isBirthday }]">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <img src="../../assets/logo.png" class="header-logo" alt="logo" />
        <span class="header-title">学生个人考试终端</span>
      </div>
      <div class="header-right">
        <el-button v-if="isMobile" circle size="small" @click="toggleSidebar" class="hamburger-btn">
          <el-icon><component :is="sidebarVisible ? 'Close' : 'Menu'" /></el-icon>
        </el-button>
        <el-button v-if="isMobile" circle size="small" @click="router.push('/student/game')" class="game-mobile-btn" title="泡泡工坊">
          <el-icon><Present /></el-icon>
        </el-button>
        <el-button circle size="small" @click="toggleDarkMode" :title="isDark ? '切换亮色' : '切换暗色'">
          <el-icon><component :is="isDark ? Sunny : Moon" /></el-icon>
        </el-button>
        <NotificationCenter />
        <el-dropdown trigger="click" @command="handleUserCommand">
          <span class="display-name dropdown-trigger">
            <el-icon class="avatar-icon" :size="18"><User /></el-icon>
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
    </div>

    <!-- 公告横幅 -->
    <AnnouncementBar />

    <!-- Body: sidebar + content -->
    <div class="body">
      <!-- Sidebar -->
      <div v-if="!isMobile" class="sidebar">
        <el-menu
          :default-active="activeMenu"
          :router="true"
          :collapse="false"
          active-text-color="#1a56db"
          text-color="#475569"
          class="sidebar-menu"
        >
          <el-menu-item index="/student/dashboard">
            <el-icon><DataBoard /></el-icon>
            <span>学习概览</span>
          </el-menu-item>
          <el-menu-item index="/student/exams">
            <el-icon><Calendar /></el-icon>
            <span>考试安排</span>
          </el-menu-item>
          <el-menu-item index="/student/profile">
            <el-icon><User /></el-icon>
            <span>个人信息</span>
          </el-menu-item>
          <el-menu-item index="/student/grades">
            <el-icon><Document /></el-icon>
            <span>成绩查询</span>
          </el-menu-item>
          <el-menu-item index="/student/ranking">
            <el-icon><Trophy /></el-icon>
            <span>成绩排名</span>
          </el-menu-item>
          <el-menu-item index="/student/class">
            <el-icon><OfficeBuilding /></el-icon>
            <span>班级一览</span>
          </el-menu-item>
          <el-menu-item index="/student/files">
            <el-icon><FolderOpened /></el-icon>
            <span>文件共享</span>
          </el-menu-item>
          <el-menu-item index="/student/study-materials">
            <el-icon><Reading /></el-icon>
            <span>复习资料</span>
          </el-menu-item>
          <el-menu-item index="/student/groups">
            <el-icon><ChatDotRound /></el-icon>
            <span>我的分组</span>
          </el-menu-item>
          <el-menu-item index="/student/photo-wall">
            <el-icon><Picture /></el-icon>
            <span>照片墙</span>
          </el-menu-item>
          <el-menu-item index="/student/forum">
            <el-icon><ChatDotRound /></el-icon>
            <span>论坛</span>
          </el-menu-item>
          <el-menu-item index="/student/game">
            <el-icon><Present /></el-icon>
            <span>泡泡工坊</span>
            <span class="menu-tag">限时</span>
          </el-menu-item>
        </el-menu>
      </div>
      <!-- Mobile Sidebar Overlay -->
      <teleport to="body">
        <transition name="sidebar-fade">
          <div v-if="isMobile && sidebarVisible" class="mobile-sidebar-overlay" @click="sidebarVisible = false"></div>
        </transition>
        <transition name="sidebar-slide">
          <div v-if="isMobile && sidebarVisible" class="mobile-sidebar">
            <el-menu
              :default-active="activeMenu"
              :router="true"
              active-text-color="var(--accent)"
              text-color="var(--text-secondary)"
              class="sidebar-menu"
              @select="handleMenuSelect"
            >
              <el-menu-item index="/student/dashboard">
                <el-icon><DataBoard /></el-icon>
                <span>学习概览</span>
              </el-menu-item>
              <el-menu-item index="/student/exams">
                <el-icon><Calendar /></el-icon>
                <span>考试安排</span>
              </el-menu-item>
              <el-menu-item index="/student/profile">
                <el-icon><User /></el-icon>
                <span>个人信息</span>
              </el-menu-item>
              <el-menu-item index="/student/grades">
                <el-icon><Document /></el-icon>
                <span>成绩查询</span>
              </el-menu-item>
              <el-menu-item index="/student/ranking">
                <el-icon><Trophy /></el-icon>
                <span>成绩排名</span>
              </el-menu-item>
              <el-menu-item index="/student/class">
                <el-icon><OfficeBuilding /></el-icon>
                <span>班级一览</span>
              </el-menu-item>
              <el-menu-item index="/student/files">
                <el-icon><FolderOpened /></el-icon>
                <span>文件共享</span>
              </el-menu-item>
              <el-menu-item index="/student/study-materials">
                <el-icon><Reading /></el-icon>
                <span>复习资料</span>
              </el-menu-item>
              <el-menu-item index="/student/groups">
                <el-icon><ChatDotRound /></el-icon>
                <span>我的分组</span>
              </el-menu-item>
              <el-menu-item index="/student/photo-wall">
                <el-icon><Picture /></el-icon>
                <span>照片墙</span>
              </el-menu-item>
              <el-menu-item index="/student/forum">
                <el-icon><ChatDotRound /></el-icon>
                <span>论坛</span>
              </el-menu-item>
              <el-menu-item index="/student/game">
                <el-icon><Present /></el-icon>
                <span>泡泡工坊</span>
                <span class="menu-tag">限时</span>
              </el-menu-item>
            </el-menu>
          </div>
        </transition>
      </teleport>

      <!-- Content -->
      <div class="content">
        <router-view />
        <!-- 公安备案 -->
        <div class="beian-footer">
          <a href="https://beian.mps.gov.cn/#/query/webSearch?code=61030202000574" rel="noreferrer" target="_blank" class="beian-link">
            <img src="/beian.png" alt="公安备案图标" class="beian-icon" />
            <span>陕公网安备61030202000574号</span>
          </a>
        </div>
      </div>
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

    <!-- 全屏文字覆盖（所有学生端页面生效） -->
    <div v-if="fullscreenEnabled && fullscreenContent" class="fullscreen-overlay">
      <div class="fullscreen-inner">
        <div class="fullscreen-line"></div>
        <div class="fullscreen-text-content" :class="fullscreenFont === 'kai' ? 'font-kai' : 'font-song'">{{ fullscreenContent }}</div>
        <div class="fullscreen-line"></div>
      </div>
    </div>

    <!-- 生日彩蛋组件 -->
    <BirthdayEgg />
    <!-- 生日蛋糕蜡烛 -->
    <BirthdayCake />
  </div>
</template>

<style scoped>
.student-layout {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

/* ---- Header ---- */
.header {
  height: 60px;
  background: var(--header-bg);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(30, 64, 175, 0.25);
  position: relative;
  z-index: 10;
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
  font-size: 17px;
  font-weight: 700;
  color: var(--header-text);
  letter-spacing: 1px;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.avatar-icon {
  color: var(--header-text);
  opacity: 0.85;
}
.display-name {
  font-size: 14px;
  color: var(--header-text);
  opacity: 0.92;
  font-weight: 500;
}
.dropdown-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
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
.logout-btn {
  margin-left: 6px;
  border-color: rgba(255, 255, 255, 0.35);
  color: var(--header-text);
  background: rgba(255, 255, 255, 0.12);
}
.logout-btn:hover {
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.5);
}

/* ---- Body ---- */
.body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* ---- Sidebar ---- */
.sidebar {
  width: 200px;
  background: var(--sidebar-bg);
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
}
.sidebar-menu {
  border-right: none;
  padding-top: 12px;
}
.sidebar-menu .el-menu-item {
  height: 52px;
  line-height: 52px;
  font-size: 14px;
  margin: 4px 10px;
  border-radius: 8px;
}
.sidebar-menu .el-menu-item.is-active {
  background: var(--sidebar-active-bg);
  font-weight: 600;
}
.sidebar-menu .el-menu-item:hover {
  background: var(--sidebar-hover-bg);
}

/* ---- Content ---- */
.content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  padding: 20px;
  min-height: 0;
  background: var(--bg-primary);
}

/* Hamburger button */
.hamburger-btn {
  color: var(--header-text) !important;
  border-color: rgba(255,255,255,0.3) !important;
  background: rgba(255,255,255,0.1) !important;
}

.game-mobile-btn {
  color: #fff !important;
  border-color: rgba(255,107,107,0.4) !important;
  background: linear-gradient(135deg, rgba(255,107,107,0.6), rgba(224,85,85,0.5)) !important;
  animation: gameBtnGlow 2s ease-in-out infinite;
}

@keyframes gameBtnGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,107,107,0.4); }
  50% { box-shadow: 0 0 0 6px rgba(255,107,107,0); }
}

/* Mobile sidebar overlay */
.mobile-sidebar-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

/* Mobile sidebar drawer */
.mobile-sidebar {
  position: fixed;
  top: 0; left: 0;
  width: 220px;
  height: 100vh;
  height: 100dvh;
  background: var(--sidebar-bg);
  z-index: 1001;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.15);
  padding: 12px 0 80px 0;
}

.mobile-sidebar .el-menu {
  border-right: none;
  height: auto;
  overflow: visible;
}

.mobile-sidebar .el-menu-item {
  height: 48px;
  line-height: 48px;
  font-size: 14px;
  margin: 3px 10px;
  border-radius: 8px;
}

/* Sidebar transitions */
.sidebar-fade-enter-active,
.sidebar-fade-leave-active {
  transition: opacity 0.3s ease;
}
.sidebar-fade-enter-from,
.sidebar-fade-leave-to {
  opacity: 0;
}
.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: transform 0.3s ease;
}
.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  transform: translateX(-100%);
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .header { padding: 0 12px; height: 52px; }
  .header-title { font-size: 15px; }
  .header-logo { height: 30px; max-width: 120px; }
  .content { padding: 12px; }
  .display-name { display: none; }
  .dropdown-arrow { display: none; }
}

@media (max-width: 480px) {
  .header { padding: 0 8px; height: 48px; }
  .header-title { font-size: 13px; }
  .header-logo { height: 26px; max-width: 100px; }
  .header-right { gap: 6px; }
  .content { padding: 8px; }
}

/* 全屏文字覆盖层 */
.fullscreen-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100vw; height: 100vh;
  z-index: 9999;
  background: linear-gradient(135deg, #1a56db 0%, #1e40af 50%, #312e81 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}
.fullscreen-inner {
  text-align: center;
  padding: 80px 120px;
  max-width: 1100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 48px;
}
.fullscreen-line {
  width: 160px;
  height: 2px;
  background: rgba(255,255,255,0.35);
}
.fullscreen-text-content {
  font-size: clamp(36px, 5.5vw, 64px);
  color: #fff;
  font-weight: 600;
  line-height: 2.2;
  white-space: pre-wrap;
  letter-spacing: 12px;
  text-shadow: 0 2px 12px rgba(0,0,0,0.15);
}
.font-song {
  font-family: 'SimSun', 'STSong', '宋体', 'Noto Serif CJK SC', serif;
}
.font-kai {
  font-family: 'KaiTi', 'STKaiti', '楷体', 'Noto Serif CJK SC', serif;
}

/* Birthday atmosphere - only on 6.25 */
.birthday-active .user-avatar,
.birthday-active .avatar-img {
  box-shadow: 0 0 15px 3px rgba(255, 215, 0, 0.5), 0 0 30px 5px rgba(255, 182, 193, 0.3);
  animation: avatarGlow 2s ease-in-out infinite;
}

.birthday-active .sidebar .el-avatar::after {
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

.menu-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  font-size: 0.6rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #FF6B6B, #E05555);
  border-radius: 8px;
  vertical-align: middle;
  line-height: 1.5;
  animation: tagPulse 2s ease-in-out infinite;
}

@keyframes tagPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
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

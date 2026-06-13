<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuth } from '../../stores/auth'
import { DataBoard, Calendar, User, Document, Trophy, OfficeBuilding, FolderOpened, Lock, SwitchButton, ChatDotRound, Reading, Picture, Moon, Sunny } from '@element-plus/icons-vue'
import AnnouncementBar from '../../components/AnnouncementBar.vue'
import ChatRoom from '../../views/ChatRoom.vue'
import NotificationCenter from '../../components/NotificationCenter.vue'
import { getFullscreenText } from '../../api/settings'

const route = useRoute()
const router = useRouter()
const { displayName, doLogout } = useAuth()

const activeMenu = computed(() => route.path)
const isDark = ref(false)

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
  <div class="student-layout">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <img src="../../assets/logo.png" class="header-logo" alt="logo" />
        <span class="header-title">学生个人考试终端</span>
      </div>
      <div class="header-right">
        <el-button circle size="small" @click="toggleDarkMode" :title="isDark ? '切换亮色' : '切换暗色'">
          <el-icon><component :is="isDark ? Sunny : Moon" /></el-icon>
        </el-button>
        <NotificationCenter />
        <el-icon class="avatar-icon" :size="18"><User /></el-icon>
        <span class="display-name">{{ displayName }}</span>
        <el-button size="small" round plain type="primary" class="logout-btn" @click="handleLogout">
          <el-icon><SwitchButton /></el-icon>
          退出
        </el-button>
      </div>
    </div>

    <!-- 公告横幅 -->
    <AnnouncementBar />

    <!-- Body: sidebar + content -->
    <div class="body">
      <!-- Sidebar -->
      <div class="sidebar">
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
          <el-menu-item index="/student/password">
            <el-icon><Lock /></el-icon>
            <span>修改密码</span>
          </el-menu-item>
        </el-menu>
      </div>

      <!-- Content -->
      <div class="content">
        <router-view />
      </div>
    </div>

    <!-- Chat Room -->
    <ChatRoom />

    <!-- 全屏文字覆盖（所有学生端页面生效） -->
    <div v-if="fullscreenEnabled && fullscreenContent" class="fullscreen-overlay">
      <div class="fullscreen-inner">
        <div class="fullscreen-line"></div>
        <div class="fullscreen-text-content" :class="fullscreenFont === 'kai' ? 'font-kai' : 'font-song'">{{ fullscreenContent }}</div>
        <div class="fullscreen-line"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.student-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f0f5ff;
}

/* ---- Header ---- */
.header {
  height: 60px;
  background: linear-gradient(90deg, #1a56db 0%, #1e40af 100%);
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
  color: #fff;
  letter-spacing: 1px;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.avatar-icon {
  color: rgba(255, 255, 255, 0.85);
}
.display-name {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.92);
  font-weight: 500;
}
.logout-btn {
  margin-left: 6px;
  border-color: rgba(255, 255, 255, 0.35);
  color: #fff;
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
  background: #fff;
  flex-shrink: 0;
  border-right: 1px solid #e8ecf4;
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
  background: #eff6ff;
  font-weight: 600;
}
.sidebar-menu .el-menu-item:hover {
  background: #f1f5f9;
}

/* ---- Content ---- */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #f0f5ff;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .header { padding: 0 12px; height: 52px; }
  .header-title { font-size: 15px; }
  .header-logo { height: 30px; }
  .sidebar { width: 56px; }
  .sidebar-menu .el-menu-item span { display: none; }
  .content { padding: 12px; }
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
</style>

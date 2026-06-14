<template>
  <div class="admin-layout">
    <!-- Header -->
    <header class="admin-header">
      <div class="header-left">
        <img src="../../assets/logo.png" alt="Logo" class="header-logo" />
        <h1 class="header-title">学生信息管理系统</h1>
      </div>
      <div class="header-right">
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
      <!-- Sidebar -->
      <aside class="admin-sidebar">
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

          <el-sub-menu index="data-visual">
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

      <!-- Content -->
      <main class="admin-content">
        <router-view />
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuth } from '../../stores/auth'
import { changePassword } from '../../api/auth'
import AnnouncementBar from '../../components/AnnouncementBar.vue'
import ChatRoom from '../../views/ChatRoom.vue'
import NotificationCenter from '../../components/NotificationCenter.vue'
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
  Moon,
  Sunny,
  ArrowDown,
  Lock,
  SwitchButton
} from '@element-plus/icons-vue'

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
  overflow: hidden;
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 60px;
  padding: 0 24px;
  background: linear-gradient(135deg, #1a56db 0%, #1e40af 100%);
  color: #fff;
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
  color: rgba(255, 255, 255, 0.9);
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
  background: #fff;
  border-right: 1px solid #e5e7eb;
  overflow-y: auto;
  flex-shrink: 0;
}

.sidebar-menu {
  border-right: none;
  height: 100%;
}

.sidebar-menu .el-menu-item.is-active {
  background-color: #eff6ff;
  color: #1a56db;
  border-right: 3px solid #1a56db;
  font-weight: 600;
}

.admin-content {
  flex: 1;
  background: #f0f5ff;
  padding: 20px;
  overflow-y: auto;
}

/* Mobile Responsive */
@media (max-width: 768px) {
  .admin-header { padding: 0 12px; height: 52px; }
  .header-title { font-size: 16px; }
  .header-logo { height: 30px; }
  .admin-sidebar { width: 60px; }
  .admin-sidebar .el-menu-item span,
  .admin-sidebar .el-sub-menu__title span { display: none; }
  .admin-content { padding: 12px; }
}
</style>

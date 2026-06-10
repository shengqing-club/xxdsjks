<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuth } from '../stores/auth'

const router = useRouter()
const { doLogin } = useAuth()

const formRef = ref()
const loading = ref(false)
const visible = ref(false)
const form = reactive({ username: '', password: '' })

const rules = {
  username: [{ required: true, message: '请输入用户名 / 学号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const handleLogin = async (el) => {
  if (!el) return
  await el.validate(async (valid) => {
    if (!valid) return
    loading.value = true
    try {
      const data = await doLogin(form.username, form.password)
      ElMessage.success('登录成功')
      router.push(data.role === 'admin' ? '/' : '/student')
    } catch (err) {
      ElMessage.error(err.response?.data?.message || '登录失败')
    } finally {
      loading.value = false
    }
  })
}

onMounted(() => { setTimeout(() => { visible.value = true }, 60) })
</script>

<template>
  <div class="login-page">
    <!-- 背景装饰 -->
    <div class="bg-circle c1"></div>
    <div class="bg-circle c2"></div>

    <div class="login-card" :class="{ show: visible }">
      <div class="card-top-bar"></div>

      <!-- 头部：校名 + 图标 -->
      <div class="card-header">
        <div class="header-icon">
          <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 4L4 14v4l20 10 20-10v-4L24 4z" fill="#1a56db" opacity="0.9"/>
            <path d="M8 20v12c0 0 4 8 16 8s16-8 16-8V20L24 30 8 20z" fill="#1a56db" opacity="0.4"/>
            <circle cx="40" cy="22" r="2" fill="#1a56db" opacity="0.9"/>
            <line x1="40" y1="22" x2="40" y2="36" stroke="#1a56db" stroke-width="2" opacity="0.9"/>
          </svg>
        </div>
        <h1 class="school-name">西安信息职业大学</h1>
        <p class="system-name">实践考试传输终端</p>
      </div>

      <!-- 表单 -->
      <el-form ref="formRef" :model="form" :rules="rules" label-width="0" size="large" class="login-form">
        <el-form-item prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名 / 学号"
            prefix-icon="User"
            @keyup.enter="handleLogin(formRef)"
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            prefix-icon="Lock"
            show-password
            @keyup.enter="handleLogin(formRef)"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="loading" class="login-btn" @click="handleLogin(formRef)">
            登 录
          </el-button>
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f5ff;
  position: relative;
  overflow: hidden;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
}

/* 背景装饰圆 */
.bg-circle {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.bg-circle.c1 {
  width: 500px; height: 500px;
  background: radial-gradient(circle, rgba(26,86,219,0.07) 0%, transparent 70%);
  top: -120px; right: -80px;
}
.bg-circle.c2 {
  width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%);
  bottom: -100px; left: -60px;
}

/* 登录卡片 */
.login-card {
  width: 400px;
  background: #ffffff;
  border-radius: 12px;
  padding: 40px 40px 36px;
  box-shadow: 0 2px 20px rgba(26,86,219,0.07), 0 0 0 1px rgba(26,86,219,0.04);
  position: relative;
  overflow: hidden;
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.login-card.show {
  opacity: 1;
  transform: translateY(0);
}

.card-top-bar {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, #1a56db, #3b82f6, #60a5fa);
}

/* 头部 */
.card-header {
  text-align: center;
  margin-bottom: 32px;
}

.header-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  background: #eff6ff;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.header-icon svg {
  width: 34px;
  height: 34px;
}

.school-name {
  font-family: KaiTi, STKaiti, "楷体", serif;
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: 4px;
  margin: 0 0 6px;
}

.system-name {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
  letter-spacing: 1px;
}

/* 表单 */
.login-form :deep(.el-form-item) {
  margin-bottom: 20px;
}

.login-form :deep(.el-input__wrapper) {
  border-radius: 8px;
  box-shadow: 0 0 0 1px #dbe4f0 !important;
  transition: all 0.25s;
  padding: 2px 12px;
}
.login-form :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px #93c5fd !important;
}
.login-form :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px #1a56db !important;
}

.login-form :deep(.el-input__inner) {
  height: 42px;
  font-size: 14px;
}

.login-form :deep(.el-input__prefix .el-icon) {
  color: #94a3b8;
  font-size: 16px;
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 6px;
  text-indent: 6px;
  border-radius: 8px;
  background: linear-gradient(135deg, #1a56db, #1e40af);
  border: none;
  transition: all 0.25s;
}
.login-btn:hover {
  background: linear-gradient(135deg, #2563eb, #1a56db);
  box-shadow: 0 4px 14px rgba(26,86,219,0.3);
}

/* 响应式 */
@media (max-width: 440px) {
  .login-card {
    width: calc(100% - 32px);
    padding: 32px 24px 24px;
  }
}
</style>

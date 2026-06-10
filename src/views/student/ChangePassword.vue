<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { useAuth } from '../../stores/auth'
import { changePassword } from '../../api/auth'

const { user } = useAuth()

const formRef = ref(null)
const submitting = ref(false)

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

// Validation rules
const validateConfirm = (rule, value, callback) => {
  if (value !== form.newPassword) {
    callback(new Error('两次输入的密码不一致'))
  } else {
    callback()
  }
}

const rules = {
  oldPassword: [
    { required: true, message: '请输入当前密码', trigger: 'blur' },
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: validateConfirm, trigger: 'blur' },
  ],
}

const handleSubmit = async () => {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    await changePassword(user.value.username, form.oldPassword, form.newPassword)
    ElMessage.success('密码修改成功')
    // Reset form
    form.oldPassword = ''
    form.newPassword = ''
    form.confirmPassword = ''
    formRef.value.resetFields()
  } catch (e) {
    const msg = e?.response?.data?.message || e?.message || '密码修改失败，请检查当前密码是否正确'
    ElMessage.error(msg)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="password-page">
    <!-- Page header -->
    <div class="page-header">
      <h2>修改密码</h2>
      <p class="page-desc">定期修改密码有助于保护您的账号安全</p>
    </div>

    <!-- Password form card -->
    <el-card shadow="never" class="form-card">
      <div class="form-header">
        <div class="form-icon">
          <el-icon :size="28" color="#fff"><Lock /></el-icon>
        </div>
        <h3 class="form-title">修改登录密码</h3>
        <p class="form-desc">请输入当前密码并设置新密码</p>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="password-form"
        @submit.prevent
      >
        <el-form-item label="当前密码" prop="oldPassword">
          <el-input
            v-model="form.oldPassword"
            type="password"
            show-password
            placeholder="请输入当前密码"
            prefix-icon="Lock"
          />
        </el-form-item>

        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="form.newPassword"
            type="password"
            show-password
            placeholder="请输入新密码（至少6位）"
            prefix-icon="Key"
          />
        </el-form-item>

        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            show-password
            placeholder="请再次输入新密码"
            prefix-icon="Key"
          />
        </el-form-item>

        <el-form-item class="form-actions">
          <el-button
            type="primary"
            :loading="submitting"
            size="large"
            class="submit-btn"
            @click="handleSubmit"
          >
            确认修改
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.password-page {
  min-height: 100%;
}

/* Page header */
.page-header {
  margin-bottom: 20px;
}
.page-header h2 {
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 4px;
}
.page-desc {
  font-size: 14px;
  color: #94a3b8;
  margin: 0;
}

/* Form card */
.form-card {
  border-radius: 8px;
  border: none;
  max-width: 520px;
}
.form-card :deep(.el-card__body) {
  padding: 32px;
}

/* Form header */
.form-header {
  text-align: center;
  margin-bottom: 28px;
}
.form-icon {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: #1a56db;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
  box-shadow: 0 4px 12px rgba(26, 86, 219, 0.3);
}
.form-title {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 4px;
}
.form-desc {
  font-size: 13px;
  color: #94a3b8;
  margin: 0;
}

/* Form */
.password-form :deep(.el-form-item__label) {
  font-weight: 500;
  color: #334155;
  font-size: 14px;
}
.password-form :deep(.el-input__wrapper) {
  border-radius: 6px;
}

/* Submit button */
.form-actions {
  margin-top: 8px;
  margin-bottom: 0;
}
.submit-btn {
  width: 100%;
  font-size: 15px;
  font-weight: 600;
  border-radius: 8px;
  height: 44px;
}
</style>

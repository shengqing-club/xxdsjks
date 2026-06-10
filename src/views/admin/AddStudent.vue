<template>
  <div class="add-student-page">
    <!-- Page Header -->
    <div class="page-header">
      <h2 class="page-title">新增学生信息</h2>
      <p class="page-desc">填写以下信息以添加新的学生记录</p>
    </div>

    <!-- Form Card -->
    <el-card shadow="never" class="form-card">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="80px"
        label-position="right"
        class="student-form"
      >
        <el-form-item label="学号" prop="studentId">
          <el-input v-model="form.studentId" placeholder="请输入学号" clearable />
        </el-form-item>

        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入姓名" clearable />
        </el-form-item>

        <el-form-item label="年龄" prop="age">
          <el-input-number v-model="form.age" :min="1" :max="100" placeholder="请输入年龄" />
        </el-form-item>

        <el-form-item label="性别" prop="gender">
          <el-radio-group v-model="form.gender">
            <el-radio value="男">男</el-radio>
            <el-radio value="女">女</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="专业" prop="major">
          <el-input v-model="form.major" placeholder="请输入专业" clearable />
        </el-form-item>

        <el-form-item label="班级" prop="className">
          <el-input v-model="form.className" placeholder="请输入班级" clearable />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="submitting" @click="handleSubmit" class="submit-btn">
            提交
          </el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { addStudent } from '../../api/student'

const formRef = ref(null)
const submitting = ref(false)

const form = reactive({
  studentId: '',
  name: '',
  age: null,
  gender: '',
  major: '',
  className: ''
})

const rules = {
  studentId: [
    { required: true, message: '请输入学号', trigger: 'blur' }
  ],
  name: [
    { required: true, message: '请输入姓名', trigger: 'blur' }
  ],
  age: [
    { required: true, message: '请输入年龄', trigger: 'blur' }
  ],
  gender: [
    { required: true, message: '请选择性别', trigger: 'change' }
  ],
  major: [
    { required: true, message: '请输入专业', trigger: 'blur' }
  ],
  className: [
    { required: true, message: '请输入班级', trigger: 'blur' }
  ]
}

const handleSubmit = async () => {
  if (!formRef.value) return
  await formRef.value.validate()
  submitting.value = true
  try {
    await addStudent({
      studentId: form.studentId,
      name: form.name,
      age: form.age,
      gender: form.gender,
      major: form.major,
      className: form.className
    })
    ElMessage.success('添加成功')
    formRef.value.resetFields()
  } catch (e) {
    ElMessage.error('添加失败，请重试')
    console.error(e)
  } finally {
    submitting.value = false
  }
}

const handleReset = () => {
  if (formRef.value) {
    formRef.value.resetFields()
  }
}
</script>

<style scoped>
.add-student-page {
  max-width: 680px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  font-size: 22px;
  color: #1e293b;
  font-weight: 700;
  margin: 0 0 4px 0;
}

.page-desc {
  font-size: 14px;
  color: #94a3b8;
  margin: 0;
}

.form-card {
  border-radius: 8px;
}

.form-card :deep(.el-card__body) {
  padding: 32px 40px;
}

.student-form {
  max-width: 480px;
  margin: 0 auto;
}

.submit-btn {
  min-width: 100px;
}
</style>

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
          <el-select
            v-model="form.major"
            placeholder="请选择专业"
            clearable
            filterable
            style="width: 100%"
            @change="onMajorChange"
          >
            <el-option
              v-for="m in majorOptions"
              :key="m.id"
              :label="m.name"
              :value="m.name"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="班级" prop="className">
          <el-select
            v-model="form.className"
            placeholder="请先选择专业"
            clearable
            style="width: 100%"
            :disabled="!classOptions.length"
          >
            <el-option
              v-for="c in classOptions"
              :key="c"
              :label="c"
              :value="c"
            />
          </el-select>
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
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { addStudent } from '../../api/student'
import { getMajors } from '../../api/major'
import { getClasses } from '../../api/class'

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

const majorOptions = ref([])
const classOptions = ref([])

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
    { required: true, message: '请选择专业', trigger: 'change' }
  ],
  className: [
    { required: true, message: '请选择班级', trigger: 'change' }
  ]
}

const onMajorChange = async () => {
  form.className = ''  // 清空已选班级
  const selected = majorOptions.value.find(m => m.name === form.major)
  if (selected && selected.id) {
    try {
      const res = await getClasses({ major_id: selected.id })
      const data = res.data || res || []
      classOptions.value = data.map(c => c.name)
    } catch (e) {
      classOptions.value = []
    }
  } else {
    classOptions.value = []
  }
}

const fetchMajors = async () => {
  try {
    const res = await getMajors()
    majorOptions.value = res.data || res || []
  } catch (e) {
    ElMessage.error('获取专业列表失败')
    console.error(e)
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return
  try { await formRef.value.validate() } catch { return }
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

onMounted(() => {
  fetchMajors()
})
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

@media (max-width: 768px) {
  .add-student-page { max-width: 100%; padding: 0 8px; }
  .form-card :deep(.el-card__body) { padding: 20px 16px; }
  .student-form { max-width: 100%; }
  .student-form :deep(.el-form-item__label) { float: none; display: block; text-align: left; padding-bottom: 4px; }
  .student-form :deep(.el-form-item__content) { margin-left: 0 !important; }
  .student-form :deep(.el-input-number) { width: 100% !important; }
}
</style>

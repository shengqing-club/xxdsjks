<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../stores/auth'
import { getStudentByStudentId } from '../../api/student'
import { getGradesByStudent } from '../../api/grade'
import { getAnnouncements } from '../../api/announcement'
import { getNotifications, getUnreadCount } from '../../api/notification'
import { getStudyMaterials, uploadStudyMaterial, deleteStudyMaterial } from '../../api/study_material'
import { getUpcomingExams } from '../../api/exam'
import { normalizeDate, formatTimeRange, getExamStatus } from '../../utils/exam'
import { ElMessage, ElMessageBox } from 'element-plus'

const { displayName, studentId } = useAuth()
const loading = ref(true)
const student = ref(null)
const grades = ref([])
const announcements = ref([])
const notifications = ref([])
const exams = ref([])
const studyMaterials = ref([])
const unreadCount = ref(0)

const now = new Date()
const todayStr = now.toISOString().slice(0, 10)

// ============ 统计数据 ============
const courseCount = computed(() => grades.value.length)
const avgScore = computed(() => {
  if (!grades.value.length) return 0
  const sum = grades.value.reduce((acc, g) => acc + g.score, 0)
  return (sum / grades.value.length).toFixed(1)
})
const maxScore = computed(() => {
  if (!grades.value.length) return 0
  return Math.max(...grades.value.map(g => g.score))
})
const minScore = computed(() => {
  if (!grades.value.length) return 0
  return Math.min(...grades.value.map(g => g.score))
})

// ============ 通知类型标签映射 ============
const typeLabelMap = {
  announcement: '通知',
  notification: '通知',
  info: '通知',
  warning: '紧急',
  urgent: '紧急',
  activity: '活动',
}
const getTagLabel = (rawType) => {
  if (!rawType) return '通知'
  // 已经是中文标签直接返回
  if (['通知', '公告', '紧急', '活动'].includes(rawType)) return rawType
  return typeLabelMap[rawType] || '通知'
}

// ============ 合并通知列表（公告 + 个人通知）============
// 每条统一格式：{ id, type:'announcement'|'notification', title, content, time, is_read, raw }
const mergedNotifications = computed(() => {
  const list = []

  // 公告
  for (const ann of (announcements.value || [])) {
    list.push({
      id: 'ann-' + ann.id,
      type: 'announcement',
      title: ann.title,
      content: ann.content,
      tagType: getTagLabel(ann.type),
      time: ann.created_at,
      is_read: true,
      raw: ann
    })
  }

  // 个人通知
  for (const n of (notifications.value || [])) {
    list.push({
      id: 'notif-' + n.id,
      type: 'notification',
      title: n.title,
      content: n.content,
      tagType: getTagLabel(n.type),
      time: n.created_at,
      is_read: n.is_read,
      raw: n
    })
  }

  // 按时间降序
  list.sort((a, b) => new Date(b.time) - new Date(a.time))
  return list.slice(0, 8)
})

// ============ 考试 ============
const upcomingExams = computed(() => {
  return exams.value
    .filter(e => normalizeDate(e.exam_date) >= todayStr)
    .sort((a, b) => {
      const da = normalizeDate(a.exam_date)
      const db = normalizeDate(b.exam_date)
      if (da !== db) return da.localeCompare(db)
      return (a.exam_time || '').localeCompare(b.exam_time || '')
    })
    .slice(0, 10)
})

const ongoingExams = computed(() =>
  upcomingExams.value.filter(e => getExamStatus(e).tag === '考试中')
)

// ============ 公告类型标签 ============
const getAnnouncementTagType = (type) => {
  const map = { '通知': 'primary', '公告': 'success', '紧急': 'danger', '活动': 'warning' }
  return map[type] || 'info'
}

const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`
const weekDays = ['日', '一', '二', '三', '四', '五', '六']
const weekday = weekDays[now.getDay()]

// ============ 获取复习资料 ============
const fetchStudyMaterials = async () => {
  try {
    const res = await getStudyMaterials({ class_name: student.value?.class_name || '' })
    studyMaterials.value = res.data || []
  } catch (e) {
    console.warn('[Dashboard] 复习资料获取失败:', e.message)
    studyMaterials.value = []
  }
}

// ============ 删除复习资料 ============
const handleDeleteMaterial = async (material) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除资料「${material.title}」吗？`,
      '确认删除',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
    )
    // 注意：删除接口需要管理员或发布者权限，由后端判断
    await deleteStudyMaterial(material.id)
    ElMessage.success('删除成功')
    fetchStudyMaterials()
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('删除失败')
      console.error(e)
    }
  }
}

// ============ 下载复习资料 ============
const handleDownload = (material) => {
  window.open(`http://localhost:8081/api/study-materials/download/${material.id}`, '_blank')
}

// ============ 上传复习资料 ============
const uploadDialogVisible = ref(false)
const uploadFormRef = ref(null)
const uploadLoading = ref(false)
const uploadFile = ref(null)
const uploadForm = ref({
  title: '',
  course_name: '',
})
const uploadRules = {
  title: [{ required: true, message: '请输入资料标题', trigger: 'blur' }],
}

const handleOpenUpload = () => {
  uploadForm.value = { title: '', course_name: student.value?.class_name || '' }
  uploadFile.value = null
  uploadDialogVisible.value = true
}

const handleFileChange = (file) => {
  uploadFile.value = file
  // 如果标题为空，自动填入文件名（不含扩展名）
  if (!uploadForm.value.title) {
    const name = file.name || ''
    const dotIdx = name.lastIndexOf('.')
    uploadForm.value.title = dotIdx > 0 ? name.substring(0, dotIdx) : name
  }
  return false // 阻止自动上传
}

const handleFileRemove = () => {
  uploadFile.value = null
}

const submitUpload = async () => {
  if (!uploadFormRef.value) return
  await uploadFormRef.value.validate()
  if (!uploadFile.value) {
    ElMessage.warning('请选择要上传的文件')
    return
  }
  uploadLoading.value = true
  try {
    const formData = new FormData()
    formData.append('file', uploadFile.value.raw)
    formData.append('title', uploadForm.value.title)
    formData.append('course_name', uploadForm.value.course_name || '')
    formData.append('class_name', student.value?.class_name || '')
    await uploadStudyMaterial(formData)
    ElMessage.success('上传成功')
    uploadDialogVisible.value = false
    fetchStudyMaterials()
  } catch (e) {
    ElMessage.error('上传失败：' + (e.message || e))
    console.error(e)
  } finally {
    uploadLoading.value = false
  }
}

// ============ 主加载 ============
onMounted(async () => {
  try {
    // 1. 学生信息
    const studentRes = await getStudentByStudentId(studentId.value)
    student.value = studentRes.data

    // 2. 成绩
    try {
      const gradesRes = await getGradesByStudent(studentId.value)
      grades.value = gradesRes.data || []
    } catch (e) {
      console.warn('[Dashboard] 成绩获取失败:', e.message)
    }

    // 3. 公告
    try {
      const annRes = await getAnnouncements()
      announcements.value = annRes.data || []
    } catch (e) {
      console.warn('[Dashboard] 公告获取失败:', e.message)
    }

    // 4. 个人通知
    try {
      const notifRes = await getNotifications()
      notifications.value = notifRes.data || []
      const unreadRes = await getUnreadCount()
      unreadCount.value = unreadRes.data?.count || 0
    } catch (e) {
      console.warn('[Dashboard] 通知获取失败:', e.message)
    }

    // 5. 考试日程
    try {
      const studentClass = student.value?.class_name || ''
      const examsRes = await getUpcomingExams({ class_name: studentClass })
      const allExams = examsRes.data || []
      exams.value = studentClass
        ? allExams.filter(e => e.class_name === studentClass)
        : allExams
    } catch (e) {
      console.warn('[Dashboard] 考试获取失败:', e.message)
    }

    // 6. 复习资料
    await fetchStudyMaterials()

  } catch (e) {
    console.error('[Dashboard] 学生信息获取失败', e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div v-loading="loading" class="dashboard">
    <!-- 考试中横幅 -->
    <el-alert
      v-if="ongoingExams.length"
      type="error"
      :closable="false"
      show-icon
      style="margin-bottom: 20px; border-radius: 8px;"
    >
      <template #title>
        <span style="font-weight: 700; font-size: 15px;">正在考试中</span>
      </template>
      <template #default>
        <div class="ongoing-exam-list">
          <div v-for="exam in ongoingExams" :key="exam.id" class="ongoing-exam-item">
            <strong>{{ exam.course_name }}</strong>
            <span>{{ exam.location }}</span>
            <span>{{ formatTimeRange(exam) }}</span>
            <el-tag type="danger" size="small" effect="dark">考试中</el-tag>
          </div>
        </div>
      </template>
    </el-alert>

    <!-- 近期考试提醒 -->
    <el-alert
      v-if="!ongoingExams.length && upcomingExams.length"
      :title="`近期有 ${upcomingExams.length} 场考试`"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom: 20px; border-radius: 8px;"
    >
      <template #default>
        <div class="exam-reminder-list">
          <div v-for="exam in upcomingExams.slice(0, 3)" :key="exam.id" class="exam-reminder-item">
            <el-tag :type="getExamStatus(exam).type" size="small">{{ getExamStatus(exam).tag }}</el-tag>
            <span class="er-course">{{ exam.course_name }}</span>
            <span class="er-time">{{ formatTimeRange(exam) }}</span>
            <span class="er-location">{{ exam.location }}</span>
          </div>
        </div>
      </template>
    </el-alert>

    <!-- Greeting -->
    <div class="page-header">
      <h2>欢迎回来，{{ displayName }}</h2>
      <p class="date-info">{{ dateStr }} 星期{{ weekday }}</p>
    </div>

    <!-- Stat cards -->
    <div class="stat-grid">
      <div class="stat-card stat-courses">
        <div class="stat-icon"><el-icon :size="28"><Collection /></el-icon></div>
        <div class="stat-body"><p class="stat-label">已修课程数</p><p class="stat-value">{{ courseCount }}</p></div>
      </div>
      <div class="stat-card stat-avg">
        <div class="stat-icon"><el-icon :size="28"><TrendCharts /></el-icon></div>
        <div class="stat-body"><p class="stat-label">平均分</p><p class="stat-value">{{ avgScore }}</p></div>
      </div>
      <div class="stat-card stat-max">
        <div class="stat-icon"><el-icon :size="28"><Top /></el-icon></div>
        <div class="stat-body"><p class="stat-label">最高分</p><p class="stat-value">{{ maxScore }}</p></div>
      </div>
      <div class="stat-card stat-min">
        <div class="stat-icon"><el-icon :size="28"><Bottom /></el-icon></div>
        <div class="stat-body"><p class="stat-label">最低分</p><p class="stat-value">{{ minScore }}</p></div>
      </div>
    </div>

    <!-- 最新通知（公告 + 个人通知） -->
    <el-card shadow="never" class="announcement-card">
      <template #header>
        <div class="card-title-row">
          <el-icon :size="18" color="#f59e0b"><Bell /></el-icon>
          <span class="card-title">最新通知</span>
          <el-badge v-if="unreadCount" :value="unreadCount" :max="99" class="notif-badge" />
          <span class="notif-count">{{ mergedNotifications.length }} 条</span>
        </div>
      </template>
      <div v-if="mergedNotifications.length" class="announcement-list">
        <div
          v-for="item in mergedNotifications"
          :key="item.id"
          class="announcement-item"
          :class="{ 'notif-unread': !item.is_read }"
        >
          <div class="ann-left">
            <el-tag
              :type="getAnnouncementTagType(item.tagType)"
              size="small"
              effect="light"
              round
              class="ann-type-tag"
            >{{ item.tagType }}</el-tag>
            <span class="ann-title">{{ item.title }}</span>
            <el-tag v-if="!item.is_read" type="danger" size="small" effect="dark" class="unread-dot">未读</el-tag>
          </div>
          <span class="ann-date">{{ item.time ? item.time.slice(0, 16).replace('T', ' ') : '' }}</span>
        </div>
      </div>
      <el-empty v-else description="暂无通知" :image-size="60" />
    </el-card>

    <!-- 考试日程 -->
    <el-card shadow="never" class="exam-schedule-card">
      <template #header>
        <div class="card-title-row">
          <el-icon :size="18" color="#1a56db"><Clock /></el-icon>
          <span class="card-title">考试日程</span>
          <el-tag v-if="upcomingExams.length" size="small" type="primary" effect="plain" style="margin-left: auto;">{{ upcomingExams.length }}场</el-tag>
        </div>
      </template>
      <div v-if="upcomingExams.length" class="exam-schedule-list">
        <div
          v-for="exam in upcomingExams"
          :key="exam.id"
          class="exam-schedule-item"
          :class="'status-' + getExamStatus(exam).type"
        >
          <!-- 日期列 -->
          <div class="esi-date" :class="{ 'esi-today': normalizeDate(exam.exam_date) === todayStr }">
            <span class="esi-day">{{ normalizeDate(exam.exam_date).slice(8) || '--' }}</span>
            <span class="esi-month">{{ normalizeDate(exam.exam_date).slice(5, 7) }}月</span>
          </div>
          <!-- 信息列 -->
          <div class="esi-info">
            <div class="esi-course">{{ exam.course_name }}</div>
            <div class="esi-meta">
              <span class="esi-time">{{ formatTimeRange(exam) }}</span>
              <span class="esi-sep">|</span>
              <span class="esi-loc">{{ exam.location || '待定' }}</span>
            </div>
          </div>
          <!-- 状态标签 -->
          <div class="esi-status">
            <el-tag
              :type="getExamStatus(exam).type"
              size="small"
              :effect="getExamStatus(exam).tag === '考试中' ? 'dark' : 'light'"
            >
              {{ getExamStatus(exam).tag }}
            </el-tag>
          </div>
        </div>
      </div>
      <el-empty v-else description="近期暂无考试" :image-size="80" />
    </el-card>

    <!-- 复习资料 -->
    <el-card shadow="never" class="study-materials-card">
      <template #header>
        <div class="card-title-row">
          <el-icon :size="18" color="#10b981"><Document /></el-icon>
          <span class="card-title">复习资料</span>
          <el-tag v-if="studyMaterials.length" size="small" type="success" effect="plain" style="margin-left: auto;">{{ studyMaterials.length }}份</el-tag>
          <el-button type="primary" size="small" @click="handleOpenUpload" style="margin-left: 8px;">
            <el-icon><Upload /></el-icon>
            上传资料
          </el-button>
        </div>
      </template>
      <div v-if="studyMaterials.length" class="material-list">
        <div v-for="mat in studyMaterials" :key="mat.id" class="material-item">
          <div class="mat-left">
            <el-icon :size="20" color="#1a56db"><Document /></el-icon>
            <span class="mat-title">{{ mat.title }}</span>
            <el-tag v-if="mat.course_name" size="small" type="info" effect="plain">{{ mat.course_name }}</el-tag>
          </div>
          <div class="mat-right">
            <span class="mat-uploader">上传者: {{ mat.uploader_name || '--' }}</span>
            <span class="mat-date">{{ mat.created_at ? mat.created_at.slice(0, 10) : '' }}</span>
            <el-button type="primary" link size="small" @click="handleDownload(mat)">
              <el-icon><Download /></el-icon>下载
            </el-button>
            <el-button
              v-if="mat.uploader_role === 'admin' || mat.uploader_id === studentId"
              type="danger"
              link
              size="small"
              @click="handleDeleteMaterial(mat)"
            >
              <el-icon><Delete /></el-icon>删除
            </el-button>
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无复习资料，快来上传吧" :image-size="60" />
    </el-card>

    <!-- 上传资料对话框 -->
    <el-dialog
      v-model="uploadDialogVisible"
      title="上传复习资料"
      width="520px"
      destroy-on-close
    >
      <el-form
        ref="uploadFormRef"
        :model="uploadForm"
        :rules="uploadRules"
        label-width="80px"
        label-position="right"
      >
        <el-form-item label="资料标题" prop="title">
          <el-input v-model="uploadForm.title" placeholder="请输入资料标题" />
        </el-form-item>
        <el-form-item label="关联课程" prop="course_name">
          <el-input v-model="uploadForm.course_name" placeholder="选填，如：高等数学" />
        </el-form-item>
        <el-form-item label="选择文件">
          <el-upload
            :auto-upload="false"
            :limit="1"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.rar"
          >
            <el-button type="primary" plain>选择文件</el-button>
            <template #tip>
              <div class="el-upload__tip">
                支持 PDF/Word/PPT/Excel/TXT/ZIP/RAR，单个文件不超过 50MB
              </div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="uploadDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="uploadLoading" @click="submitUpload">
          确认上传
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.dashboard { min-height: 100%; }

/* 考试中横幅 */
.ongoing-exam-list { margin-top: 6px; display: flex; flex-direction: column; gap: 4px; }
.ongoing-exam-item { display: flex; align-items: center; gap: 12px; font-size: 14px; color: #7f1d1d; }
.ongoing-exam-item strong { font-size: 15px; }

/* Page header */
.page-header { margin-bottom: 20px; }
.page-header h2 { font-size: 22px; font-weight: 700; color: #1e293b; margin: 0 0 4px; }
.date-info { font-size: 14px; color: #94a3b8; margin: 0; }

/* Stat grid */
.stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 20px; }
.stat-card {
  background: #fff; border-radius: 8px; padding: 20px;
  display: flex; align-items: center; gap: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  border-left: 4px solid transparent;
  transition: box-shadow 0.2s;
}
.stat-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.stat-courses { border-left-color: #1a56db; }
.stat-avg { border-left-color: #10b981; }
.stat-max { border-left-color: #f59e0b; }
.stat-min { border-left-color: #ef4444; }
.stat-icon {
  width: 56px; height: 56px; border-radius: 12px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.stat-courses .stat-icon { background: #eff6ff; color: #1a56db; }
.stat-avg .stat-icon { background: #ecfdf5; color: #10b981; }
.stat-max .stat-icon { background: #fffbeb; color: #f59e0b; }
.stat-min .stat-icon { background: #fef2f2; color: #ef4444; }
.stat-label { font-size: 13px; color: #94a3b8; margin: 0 0 4px; }
.stat-value { font-size: 28px; font-weight: 700; color: #1e293b; margin: 0; line-height: 1.1; }

/* Exam reminder banner */
.exam-reminder-list { margin-top: 8px; }
.exam-reminder-item { display: flex; align-items: center; gap: 10px; padding: 4px 0; font-size: 14px; color: #334155; }
.er-course { font-weight: 600; color: #1e293b; }
.er-time { color: #64748b; font-size: 13px; }
.er-location { color: #94a3b8; font-size: 13px; }

/* 通知栏 */
.announcement-card { border-radius: 8px; border: none; margin-bottom: 20px; }
.announcement-card :deep(.el-card__header) { padding: 14px 20px; border-bottom: 1px solid #f1f5f9; }
.announcement-card :deep(.el-card__body) { padding: 0; }
.card-title-row { display: flex; align-items: center; gap: 8px; }
.card-title { font-size: 15px; font-weight: 600; color: #1e293b; }
.notif-badge { margin-left: 4px; }
.notif-count { font-size: 12px; color: #94a3b8; margin-left: 4px; }
.announcement-list { list-style: none; margin: 0; padding: 0; }
.announcement-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 20px; border-bottom: 1px solid #f8fafc;
  transition: background 0.15s;
}
.announcement-item:last-child { border-bottom: none; }
.announcement-item:hover { background: #f8fafc; }
.announcement-item.notif-unread { background: #f0f9ff; }
.ann-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.ann-type-tag { flex-shrink: 0; }
.ann-title { font-size: 14px; color: #334155; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.unread-dot { flex-shrink: 0; margin-left: 4px; }
.ann-date { font-size: 12px; color: #94a3b8; flex-shrink: 0; margin-left: 12px; }

/* Exam Schedule */
.exam-schedule-card { border-radius: 8px; border: none; margin-bottom: 20px; }
.exam-schedule-card :deep(.el-card__header) { padding: 14px 20px; border-bottom: 1px solid #f1f5f9; }
.exam-schedule-card :deep(.el-card__body) { padding: 0; }
.exam-schedule-list { }
.exam-schedule-item {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 20px; border-bottom: 1px solid #f8fafc;
  transition: background 0.15s;
}
.exam-schedule-item:last-child { border-bottom: none; }
.exam-schedule-item:hover { background: #f8fafc; }
.exam-schedule-item.status-danger { background: #fef2f2; }
.exam-schedule-item.status-danger:hover { background: #fee2e2; }

/* 日期块 */
.esi-date {
  width: 52px; height: 52px; border-radius: 10px;
  background: #eff6ff;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.esi-date.esi-today { background: #fef2f2; }
.esi-day { font-size: 20px; font-weight: 700; color: #1a56db; line-height: 1; }
.esi-date.esi-today .esi-day { color: #dc2626; }
.esi-month { font-size: 11px; color: #64748b; margin-top: 2px; }

/* 信息列 */
.esi-info { flex: 1; min-width: 0; }
.esi-course { font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 4px; }
.esi-meta { font-size: 12px; color: #94a3b8; display: flex; gap: 6px; align-items: center; }
.esi-time { font-weight: 500; color: #64748b; }
.esi-sep { color: #cbd5e1; }
.esi-loc { }

/* 状态列 */
.esi-status { flex-shrink: 0; margin-left: auto; }

/* 复习资料 */
.study-materials-card { border-radius: 8px; border: none; margin-bottom: 20px; }
.study-materials-card :deep(.el-card__header) { padding: 14px 20px; border-bottom: 1px solid #f1f5f9; }
.study-materials-card :deep(.el-card__body) { padding: 0; }
.material-list { }
.material-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px; border-bottom: 1px solid #f8fafc;
  transition: background 0.15s;
}
.material-item:last-child { border-bottom: none; }
.material-item:hover { background: #f8fafc; }
.mat-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.mat-title { font-size: 14px; color: #334155; font-weight: 500; }
.mat-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; font-size: 12px; color: #94a3b8; }
.mat-uploader { }
.mat-date { }
</style>

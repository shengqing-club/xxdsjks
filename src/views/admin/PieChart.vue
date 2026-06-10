<template>
  <div class="pie-chart-page">
    <div class="page-header">
      <h2 class="page-title">数据可视化 - 饼图</h2>
      <p class="page-desc">学生性别比例 · 课程类型分布</p>
    </div>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card shadow="never" class="chart-card" v-loading="loadingGender">
          <div ref="genderChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never" class="chart-card" v-loading="loadingCourse">
          <div ref="courseChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'
import { getGenderStats } from '../../api/student'
import { getCourseTypeStats } from '../../api/grade'

const loadingGender = ref(false)
const loadingCourse = ref(false)
const genderChartRef = ref(null)
const courseChartRef = ref(null)
let genderChart = null
let courseChart = null

const makePieOption = (title, data, colorMap) => ({
  title: { text: title, left: 'center', top: 12, textStyle: { fontSize: 16, fontWeight: 600, color: '#1e293b' } },
  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
  legend: { bottom: 10, left: 'center', itemWidth: 10, itemHeight: 10, textStyle: { color: '#64748b', fontSize: 12 } },
  series: [{
    type: 'pie', radius: ['42%', '68%'], center: ['50%', '48%'],
    itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
    label: { show: true, formatter: '{b}\n{d}%', fontSize: 12, color: '#334155' },
    emphasis: { scaleSize: 6, label: { fontSize: 14, fontWeight: 600 } },
    data: data.map(d => ({ name: (colorMap[d.name] || d).label || d.name, value: Number(d.value), itemStyle: { color: (colorMap[d.name] || d).color || '#3b82f6' } }))
  }]
})

const COLOR_MAP_GENDER = {
  '男': { label: '男生', color: '#3b82f6' },
  '女': { label: '女生', color: '#f472b6' }
}

const COLOR_MAP_COURSE = {
  '必修': { label: '必修课', color: '#1a56db' },
  '选修': { label: '选修课', color: '#10b981' },
  '实践': { label: '实践课', color: '#f59e0b' }
}

const handleResize = () => { genderChart?.resize(); courseChart?.resize() }

onMounted(async () => {
  loadingGender.value = true
  try {
    const res = await getGenderStats()
    const data = res.data || res || []
    if (data.length) {
      genderChart = echarts.init(genderChartRef.value)
      genderChart.setOption(makePieOption('学生性别比例', data, COLOR_MAP_GENDER))
    }
  } catch (e) { console.error('获取性别统计失败', e) } finally { loadingGender.value = false }

  loadingCourse.value = true
  try {
    const res = await getCourseTypeStats()
    const data = res.data || res || []
    if (data.length) {
      courseChart = echarts.init(courseChartRef.value)
      courseChart.setOption(makePieOption('课程类型分布', data, COLOR_MAP_COURSE))
    }
  } catch (e) { console.error('获取课程统计失败', e) } finally { loadingCourse.value = false }

  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  genderChart?.dispose()
  courseChart?.dispose()
})
</script>

<style scoped>
.pie-chart-page { max-width: 1200px; margin: 0 auto; }
.page-header { margin-bottom: 20px; }
.page-title { font-size: 22px; color: #1e293b; font-weight: 700; margin: 0 0 4px; }
.page-desc { font-size: 14px; color: #94a3b8; margin: 0; }
.chart-card { border-radius: 8px; }
.chart-card :deep(.el-card__body) { padding: 12px; }
.chart-container { width: 100%; height: 400px; }
</style>

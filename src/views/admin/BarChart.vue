<template>
  <div class="bar-chart-page">
    <div class="page-header">
      <h2 class="page-title">数据可视化 - 柱状图</h2>
      <p class="page-desc">各专业学生人数分布 · 成绩分段统计</p>
    </div>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card shadow="never" class="chart-card" v-loading="loadingMajor">
          <div ref="majorChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="never" class="chart-card" v-loading="loadingDist">
          <div ref="distChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'
import { getMajorStats } from '../../api/student'
import { getGradeDistribution } from '../../api/grade'

const loadingMajor = ref(false)
const loadingDist = ref(false)
const majorChartRef = ref(null)
const distChartRef = ref(null)
let majorChart = null
let distChart = null

const initMajorChart = (data) => {
  if (!majorChartRef.value) return
  majorChart = echarts.init(majorChartRef.value)
  const categories = data.map(d => d.name || d.major)
  const values = data.map(d => Number(d.value) || 0)

  majorChart.setOption({
    title: { text: '各专业学生人数', left: 'center', top: 12, textStyle: { fontSize: 16, fontWeight: 600, color: '#1e293b' } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '6%', right: '6%', bottom: '8%', top: 60, containLabel: true },
    xAxis: { type: 'category', data: categories, axisLabel: { color: '#64748b', fontSize: 11, rotate: categories.length > 5 ? 30 : 0 }, axisTick: { show: false } },
    yAxis: { type: 'value', name: '人数', minInterval: 1, axisLabel: { color: '#64748b' }, splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } } },
    series: [{
      type: 'bar', data: values, barWidth: '45%',
      itemStyle: { borderRadius: [6, 6, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#3b82f6' }, { offset: 1, color: '#1a56db' }]) }
    }]
  })
}

const initDistChart = (data) => {
  if (!distChartRef.value) return
  distChart = echarts.init(distChartRef.value)
  const labels = ['优秀 (90-100)', '良好 (80-89)', '中等 (70-79)', '及格 (60-69)', '不及格 (<60)']
  const values = data.map(d => Number(d.count || d.value || 0))

  distChart.setOption({
    title: { text: '成绩分段统计', left: 'center', top: 12, textStyle: { fontSize: 16, fontWeight: 600, color: '#1e293b' } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '6%', right: '6%', bottom: '8%', top: 60, containLabel: true },
    xAxis: { type: 'category', data: labels, axisLabel: { color: '#64748b', fontSize: 11 }, axisTick: { show: false } },
    yAxis: { type: 'value', name: '人次', minInterval: 1, axisLabel: { color: '#64748b' }, splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } } },
    series: [{
      type: 'bar', data: values, barWidth: '45%',
      itemStyle: {
        borderRadius: [6, 6, 0, 0],
        color: (p) => ['#10b981', '#3b82f6', '#f59e0b', '#f97316', '#ef4444'][p.dataIndex]
      }
    }]
  })
}

const handleResize = () => { majorChart?.resize(); distChart?.resize() }

onMounted(async () => {
  loadingMajor.value = true
  try {
    const res = await getMajorStats()
    const data = res.data || res || []
    if (data.length) initMajorChart(data)
  } catch (e) { console.error('获取专业统计失败', e) } finally { loadingMajor.value = false }

  loadingDist.value = true
  try {
    const res = await getGradeDistribution()
    const data = res.data || res || []
    if (data.length) initDistChart(data)
  } catch (e) { console.error('获取成绩分布失败', e) } finally { loadingDist.value = false }

  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  majorChart?.dispose()
  distChart?.dispose()
})
</script>

<style scoped>
.bar-chart-page { max-width: 1200px; margin: 0 auto; }
.page-header { margin-bottom: 20px; }
.page-title { font-size: 22px; color: #1e293b; font-weight: 700; margin: 0 0 4px; }
.page-desc { font-size: 14px; color: #94a3b8; margin: 0; }
.chart-card { border-radius: 8px; }
.chart-card :deep(.el-card__body) { padding: 12px; }
.chart-container { width: 100%; height: 400px; }
</style>

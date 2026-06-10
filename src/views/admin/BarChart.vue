<template>
  <div class="bar-chart-page">
    <!-- Page Header -->
    <div class="page-header">
      <h2 class="page-title">数据可视化 - 柱状图</h2>
      <p class="page-desc">各专业学生人数分布情况</p>
    </div>

    <!-- Chart Card -->
    <el-card shadow="never" class="chart-card" v-loading="loading">
      <div ref="chartRef" class="chart-container"></div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'
import { getMajorStats } from '../../api/student'

const loading = ref(false)
const chartRef = ref(null)
let chartInstance = null

const initChart = (data) => {
  if (!chartRef.value) return
  chartInstance = echarts.init(chartRef.value)

  const categories = Object.keys(data)
  const values = Object.values(data)

  const option = {
    title: {
      text: '各专业学生人数分布',
      left: 'center',
      top: 16,
      textStyle: {
        fontSize: 18,
        fontWeight: 600,
        color: '#1e293b'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#e5e7eb',
      textStyle: { color: '#334155' }
    },
    grid: {
      left: '6%',
      right: '6%',
      bottom: '8%',
      top: 80,
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        color: '#64748b',
        fontSize: 12,
        interval: 0,
        rotate: categories.length > 6 ? 30 : 0
      },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      name: '人数',
      nameTextStyle: { color: '#94a3b8', fontSize: 12 },
      axisLabel: { color: '#64748b' },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } }
    },
    series: [
      {
        name: '学生人数',
        type: 'bar',
        data: values,
        barWidth: '40%',
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#3b82f6' },
            { offset: 1, color: '#1a56db' }
          ])
        },
        emphasis: {
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#60a5fa' },
              { offset: 1, color: '#2563eb' }
            ])
          }
        }
      }
    ],
    animationDuration: 800,
    animationEasing: 'cubicInOut'
  }

  chartInstance.setOption(option)
}

const handleResize = () => {
  chartInstance?.resize()
}

onMounted(async () => {
  loading.value = true
  try {
    const res = await getMajorStats()
    const data = res.data || res || {}
    initChart(data)
    window.addEventListener('resize', handleResize)
  } catch (e) {
    console.error('获取专业统计数据失败', e)
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
})
</script>

<style scoped>
.bar-chart-page {
  max-width: 900px;
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

.chart-card {
  border-radius: 8px;
}

.chart-card :deep(.el-card__body) {
  padding: 16px;
}

.chart-container {
  width: 100%;
  height: 460px;
}
</style>

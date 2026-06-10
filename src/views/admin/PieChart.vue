<template>
  <div class="pie-chart-page">
    <!-- Page Header -->
    <div class="page-header">
      <h2 class="page-title">数据可视化 - 饼图</h2>
      <p class="page-desc">学生性别比例分布情况</p>
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
import { getGenderStats } from '../../api/student'

const loading = ref(false)
const chartRef = ref(null)
let chartInstance = null

const initChart = (data) => {
  if (!chartRef.value) return
  chartInstance = echarts.init(chartRef.value)

  const pieData = Object.keys(data).map((key) => ({
    name: key === '男' ? '男生' : '女生',
    value: data[key]
  }))

  const colorMap = {
    '男生': '#3b82f6',
    '女生': '#f472b6'
  }

  const option = {
    title: {
      text: '学生性别比例分布',
      left: 'center',
      top: 16,
      textStyle: {
        fontSize: 18,
        fontWeight: 600,
        color: '#1e293b'
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c}人 ({d}%)',
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderColor: '#e5e7eb',
      textStyle: { color: '#334155' }
    },
    legend: {
      bottom: 20,
      left: 'center',
      itemWidth: 12,
      itemHeight: 12,
      itemGap: 24,
      textStyle: { color: '#64748b', fontSize: 13 }
    },
    series: [
      {
        name: '性别分布',
        type: 'pie',
        radius: ['42%', '70%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 3,
          color: (params) => colorMap[params.name] || '#3b82f6'
        },
        label: {
          show: true,
          formatter: '{b}\n{d}%',
          fontSize: 13,
          color: '#334155',
          lineHeight: 20
        },
        labelLine: {
          show: true,
          length: 16,
          length2: 12,
          lineStyle: { color: '#cbd5e1' }
        },
        emphasis: {
          scaleSize: 8,
          label: {
            show: true,
            fontSize: 15,
            fontWeight: 600
          },
          itemStyle: {
            shadowBlur: 16,
            shadowColor: 'rgba(0,0,0,0.15)'
          }
        },
        data: pieData,
        animationType: 'scale',
        animationDuration: 800,
        animationEasing: 'cubicInOut'
      }
    ]
  }

  chartInstance.setOption(option)
}

const handleResize = () => {
  chartInstance?.resize()
}

onMounted(async () => {
  loading.value = true
  try {
    const res = await getGenderStats()
    const data = res.data || res || {}
    initChart(data)
    window.addEventListener('resize', handleResize)
  } catch (e) {
    console.error('获取性别统计数据失败', e)
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
.pie-chart-page {
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

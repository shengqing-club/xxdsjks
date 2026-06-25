<template>
  <div class="student-groups-page">
    <h2 class="page-title">
      <el-icon><ChatDotRound /></el-icon>
      我的分组
    </h2>

    <div v-if="myGroups.length === 0" class="empty-state">
      <el-empty description="您暂未加入任何分组" />
    </div>

    <el-row :gutter="20" v-else>
      <el-col :span="8" v-for="group in myGroups" :key="group.id">
        <el-card class="group-card" shadow="hover" @click="enterGroup(group)">
          <template #header>
            <div class="card-header">
              <span class="group-name">{{ group.name }}</span>
              <el-tag v-if="group.member_role === 'leader'" type="warning" size="small">
                <el-icon><StarFilled /></el-icon> 组长
              </el-tag>
            </div>
          </template>
          <div class="group-info">
            <p><el-icon><OfficeBuilding /></el-icon> {{ group.class_name }}</p>
            <p><el-icon><Document /></el-icon> {{ group.description || '暂无描述' }}</p>
          </div>
          <div class="group-actions">
            <el-button type="primary" size="small" @click.stop="enterGroup(group)">
              <el-icon><ChatDotRound /></el-icon>
              进入聊天
            </el-button>
            <el-button type="info" size="small" @click.stop="openFileLibrary(group)">
              <el-icon><FolderOpened /></el-icon>
              文件库
            </el-button>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 分组聊天弹窗 -->
    <el-dialog v-model="chatVisible" :title="currentGroup?.name + ' - 聊天频道'" width="600px" :close-on-click-modal="false">
      <GroupChatPanel v-if="chatVisible && currentGroup" :group="currentGroup" />
    </el-dialog>

    <!-- 分组文件库弹窗 -->
    <el-dialog v-model="fileLibraryVisible" :title="currentGroup?.name + ' - 文件库'" width="700px">
      <GroupFileLibrary v-if="fileLibraryVisible && currentGroup" :group="currentGroup" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ChatDotRound, StarFilled, OfficeBuilding, Document, FolderOpened
} from '@element-plus/icons-vue'
import { getStudentGroups } from '../../api/group'
import { useAuth } from '../../stores/auth'
import GroupChatPanel from '../../components/GroupChatPanel.vue'
import GroupFileLibrary from '../../components/GroupFileLibrary.vue'

const { user } = useAuth()
const myGroups = ref([])
const chatVisible = ref(false)
const fileLibraryVisible = ref(false)
const currentGroup = ref(null)

const loadMyGroups = async () => {
  try {
    const res = await getStudentGroups(user.value.studentId)
    myGroups.value = res.data || []
  } catch (err) {
    ElMessage.error('获取分组列表失败')
  }
}

const enterGroup = (group) => {
  currentGroup.value = group
  chatVisible.value = true
}

const openFileLibrary = (group) => {
  currentGroup.value = group
  fileLibraryVisible.value = true
}

onMounted(() => {
  loadMyGroups()
})
</script>

<style scoped>
.student-groups-page {
  padding: 0;
}
.page-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 20px 0;
  font-size: 20px;
  color: #1a56db;
}
.empty-state {
  padding: 60px 0;
}
.group-card {
  cursor: pointer;
  transition: transform 0.2s;
  margin-bottom: 16px;
}
.group-card:hover {
  transform: translateY(-4px);
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.group-name {
  font-size: 16px;
  font-weight: 600;
}
.group-info {
  color: #606266;
  font-size: 14px;
  margin-bottom: 12px;
}
.group-info p {
  margin: 4px 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.group-actions {
  display: flex;
  gap: 8px;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .student-groups-page :deep(.el-col) { max-width: 50% !important; flex: 0 0 50% !important; }
  .student-groups-page :deep(.el-col:nth-child(3n+1):last-child) { max-width: 100% !important; flex: 0 0 100% !important; }
  .group-actions { flex-direction: column; }
  .page-title { font-size: 18px; }
}
@media (max-width: 480px) {
  .student-groups-page :deep(.el-col) { max-width: 100% !important; flex: 0 0 100% !important; }
  .page-title { font-size: 16px; }
}
</style>

<!-- src/App.vue -->
<template>
  <div class="app-layout">
    <!-- 左侧：交互面板 -->
    <div class="left-panel">
      <div class="header">
        <h2>AI Architect Agent</h2>
        <div class="session-info">Session: {{ shortSessionId }}</div>
      </div>

      <!-- 聊天记录区域 -->
      <div class="chat-history" ref="chatBox">
        <div 
          v-for="(msg, index) in chatHistory" 
          :key="index" 
          :class="['message', msg.role]"
        >
          <div class="message-content">
            <strong>{{ msg.role === 'user' ? 'You' : 'Agent' }}:</strong>
            <p style="white-space: pre-wrap;">{{ msg.content }}</p>
          </div>
        </div>
        <div v-if="loading" class="loading-indicator">
          <el-icon class="is-loading"><Loading /></el-icon> Agent is thinking & simulating...
        </div>
      </div>

      <!-- 输入控制区域 -->
      <div class="input-area">
        <!-- 上传周边环境 (模拟) -->
        <el-upload
          class="upload-demo"
          action="#"
          :auto-upload="false"
          :on-change="handleFileChange"
          :limit="1"
        >
          <template #trigger>
            <el-button size="small" :icon="Folder">Load Context (3dm/Obj)</el-button>
          </template>
        </el-upload>

        <el-input
          v-model="userInput"
          type="textarea"
          :rows="3"
          placeholder="请输入设计需求，例如：在南京鼓楼区生成一组办公楼，容积率2.5..."
          @keyup.enter.ctrl="handleSend"
        />
        <el-button type="primary" class="send-btn" @click="handleSend" :loading="loading">
          生成 / Generate
        </el-button>
      </div>
    </div>

    <!-- 右侧：可视化面板 -->
    <div class="right-panel">
      <!-- 3D 视窗 -->
      <div class="viewer-wrapper">
        <BuildingViewer :geometryData="currentGeometry" />
      </div>

      <!-- 分析面板 (下半部分) -->
      <div class="analysis-panel" v-if="metrics || analysisImage">
        <el-tabs type="border-card">
          <el-tab-pane label="性能指标 (Metrics)">
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item v-for="(val, key) in metrics" :key="key" :label="key">
                {{ val }}
              </el-descriptions-item>
            </el-descriptions>
          </el-tab-pane>
          <el-tab-pane label="分析图 (Analysis)">
            <div class="image-gallery" v-if="analysisImage">
              <!-- 假设 analysisImage 是 Base64 数组 -->
              <el-image 
                v-for="(img, idx) in analysisImage" 
                :key="idx" 
                :src="img" 
                :preview-src-list="analysisImage"
                fit="cover" 
                class="analysis-img"
              />
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { Loading, Folder } from '@element-plus/icons-vue';
import BuildingViewer from './components/BuildingViewer.vue';
import { sendDesignRequest } from './api/design';
import type { ChatMessage, DesignDataPayload } from './types/agent';

// 状态管理
const sessionId = ref(uuidv4());
const userInput = ref('');
const loading = ref(false);
const chatHistory = ref<ChatMessage[]>([]);
const chatBox = ref<HTMLDivElement | null>(null);

// 业务数据状态
const currentGeometry = ref<string | null>(null);
const metrics = ref<Record<string, any> | null>(null);
const analysisImage = ref<string[] | null>(null);
// 模拟的文件上下文内容
const contextData = ref<string>('');

const shortSessionId = computed(() => sessionId.value.slice(0, 8));

// 处理文件上传 (这里简化为读取文件名作为Context，实际可用FileReader转Base64)
const handleFileChange = (file: any) => {
  contextData.value = `Loaded context file: ${file.name}. (Mocking geometry data extraction)`;
  chatHistory.value.push({
    role: 'user',
    content: `[System]: Uploaded context file ${file.name}`,
    time: new Date().toLocaleTimeString()
  });
};

const handleSend = async () => {
  if (!userInput.value.trim()) return;

  const query = userInput.value;
  userInput.value = '';

  // 1. 添加用户消息
  chatHistory.value.push({
    role: 'user',
    content: query,
    time: new Date().toLocaleTimeString()
  });
  scrollToBottom();

  loading.value = true;

  try {
    // 2. 发送请求给 Go Eino Agent
    const res = await sendDesignRequest({
      session_id: sessionId.value,
      query: query,
      context: contextData.value // 传递上下文
    });

    // 3. 处理 Agent 回复
    if (res.Reply) {
      chatHistory.value.push({
        role: 'agent',
        content: res.Reply,
        time: new Date().toLocaleTimeString()
      });
    }

    // 4. 更新可视化数据
    if (res.DataPayload) {
      const payload = res.DataPayload;
      if (payload.GeometryData) {
        currentGeometry.value = payload.GeometryData;
      }
      if (payload.Metrics) {
        metrics.value = payload.Metrics;
      }
      if (payload.AnalysisImage) {
        analysisImage.value = payload.AnalysisImage; // 确保后端返回的是可显示的URL或Base64
      }
    }
  } catch (error) {
    console.error(error);
    chatHistory.value.push({
      role: 'agent',
      content: "Error: Failed to contact the architect agent.",
      time: new Date().toLocaleTimeString()
    });
  } finally {
    loading.value = false;
    scrollToBottom();
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    if (chatBox.value) {
      chatBox.value.scrollTop = chatBox.value.scrollHeight;
    }
  });
};
</script>

<style>
/* 全局重置 */
html, body, #app {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;
}

.app-layout {
  display: flex;
  height: 100vh;
  width: 100vw;
}

/* 左侧面板 */
.left-panel {
  width: 400px;
  background: #fff;
  border-right: 1px solid #dcdfe6;
  display: flex;
  flex-direction: column;
}

.header {
  padding: 20px;
  border-bottom: 1px solid #eee;
  background: #f5f7fa;
}
.header h2 { margin: 0; font-size: 18px; color: #303133; }
.session-info { font-size: 12px; color: #909399; margin-top: 5px; }

.chat-history {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #fafafa;
}

.message { margin-bottom: 15px; }
.message.user { text-align: right; }
.message.user .message-content {
  background: #e1f3d8;
  display: inline-block;
  text-align: left;
  padding: 10px;
  border-radius: 8px;
}
.message.agent .message-content {
  background: #fff;
  border: 1px solid #ebeef5;
  display: inline-block;
  padding: 10px;
  border-radius: 8px;
}

.input-area {
  padding: 20px;
  border-top: 1px solid #eee;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.send-btn { width: 100%; }

/* 右侧面板 */
.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f0f2f5;
}

.viewer-wrapper {
  flex: 2;
  position: relative;
  border-bottom: 1px solid #dcdfe6;
}

.analysis-panel {
  flex: 1;
  background: #fff;
  overflow-y: auto;
}

.image-gallery {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.analysis-img {
  width: 150px;
  height: 150px;
  border-radius: 4px;
  border: 1px solid #eee;
}
</style>
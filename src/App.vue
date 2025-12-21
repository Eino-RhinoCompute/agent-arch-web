<!-- src/App.vue -->
<template>
  <div class="app-layout">
    <!-- 左侧：交互面板 -->
    <div class="left-panel">
      <div class="header">
        <h2>AI Architect Agent</h2>
        <div class="session-info">Session: {{ shortSessionId }}</div>
      </div>

      <!-- 聊天记录 -->
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
          <el-icon class="is-loading"><Loading /></el-icon> Thinking & Generating...
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="input-area">
        <!-- 核心功能：上传上下文文件 -->
        <div class="upload-section">
          <el-upload
            class="context-upload"
            action="#"
            :auto-upload="false"
            :show-file-list="false"
            :on-change="handleFileLoad"
            accept=".obj,.glb,.gltf,.3dm" 
          >
            <!-- 提示用户优先使用 OBJ，因为 .3dm 浏览器解析困难 -->
            <el-button :icon="Folder" :type="hasContext ? 'success' : 'default'">
              {{ hasContext ? 'Context Loaded' : 'Load Context Model (.obj)' }}
            </el-button>
          </el-upload>
          <span v-if="hasContext" class="file-name">{{ contextFileName }}</span>
        </div>

        <el-input
          v-model="userInput"
          type="textarea"
          :rows="3"
          placeholder="Describe your design requirement..."
          @keyup.enter.ctrl="handleSend"
        />
        
        <el-button type="primary" class="send-btn" @click="handleSend" :loading="loading">
          Generate
        </el-button>
      </div>
    </div>

    <!-- 右侧：视窗面板 -->
    <div class="right-panel">
      <!-- 将本地文件 URL 和 后端生成数据 同时传给 Viewer -->
      <BuildingViewer 
        :contextFileUrl="contextModelUrl" 
        :generatedData="generatedGeometry" 
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { Loading, Folder } from '@element-plus/icons-vue';
import BuildingViewer from './components/BuildingViewer.vue';
import { sendDesignRequest } from './api/design';
import type { ChatMessage } from './types/agent';
import type { UploadFile } from 'element-plus';

// 状态
const sessionId = ref(uuidv4());
const shortSessionId = computed(() => sessionId.value.slice(0, 8));
const userInput = ref('');
const loading = ref(false);
const chatHistory = ref<ChatMessage[]>([]);
const chatBox = ref<HTMLDivElement | null>(null);

// 模型相关状态
const contextModelUrl = ref<string | null>(null); // 本地文件的 Blob URL
const contextFileName = ref('');
const generatedGeometry = ref<string | null>(null); // 后端生成的模型数据

const hasContext = computed(() => !!contextModelUrl.value);

// 处理文件加载
const handleFileLoad = (file: UploadFile) => {
  if (!file.raw) return;
  
  contextFileName.value = file.name;
  
  // 创建本地 Blob URL，让 Three.js 可以像加载网络图片一样加载本地文件
  const url = URL.createObjectURL(file.raw);
  contextModelUrl.value = url;

  // 在聊天框添加系统提示
  chatHistory.value.push({
    role: 'user',
    content: `[System]: Context model "${file.name}" loaded into viewer.`,
    time: new Date().toLocaleTimeString()
  });
};

const handleSend = async () => {
  if (!userInput.value.trim()) return;

  const query = userInput.value;
  userInput.value = '';

  chatHistory.value.push({ role: 'user', content: query, time: new Date().toLocaleTimeString() });
  scrollToBottom();
  loading.value = true;

  try {
    // 发送请求，注意：这里我们只传了 query 和 session。
    // 如果后端需要知道环境文件的具体数据进行计算，通常需要先单独上传文件。
    // 在这个 Demo 中，我们假设后端是根据语义生成，或者环境数据已经通过其他方式同步。
    const res = await sendDesignRequest({
      session_id: sessionId.value,
      query: query,
      context: contextFileName.value // 简单传个文件名告知后端
    });

    if (res.Reply) {
      chatHistory.value.push({ role: 'agent', content: res.Reply, time: new Date().toLocaleTimeString() });
    }

    // 接收后端生成的建筑数据并显示
    if (res.DataPayload && res.DataPayload.GeometryData) {
      generatedGeometry.value = res.DataPayload.GeometryData;
      
      chatHistory.value.push({
        role: 'agent',
        content: "[System]: New massing generated and visualized.",
        time: new Date().toLocaleTimeString()
      });
    }

  } catch (error) {
    console.error(error);
    chatHistory.value.push({ role: 'agent', content: "Error: Failed to connect.", time: new Date().toLocaleTimeString() });
  } finally {
    loading.value = false;
    scrollToBottom();
  }
};

const scrollToBottom = () => {
  nextTick(() => {
    if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
  });
};
</script>

<style>
/* 保持原有布局样式 */
html, body, #app { margin: 0; padding: 0; height: 100%; font-family: sans-serif; }
.app-layout { display: flex; height: 100vh; width: 100vw; }

.left-panel { width: 400px; background: #fff; border-right: 1px solid #dcdfe6; display: flex; flex-direction: column; }
.header { padding: 20px; background: #f5f7fa; border-bottom: 1px solid #eee; }
.header h2 { 
  margin: 0; 
  font-size: 20px;       /* 稍微加大一点 */
  color: #000000;        /* 纯黑色 */
  font-weight: 800;      /* 特粗 */
  letter-spacing: 0.5px; /* 增加一点字间距 */
}
.session-info { font-size: 12px; color: #909399; }

.chat-history { flex: 1; overflow-y: auto; padding: 20px; background: #fafafa; }
.message { margin-bottom: 15px; }
.message.user { text-align: right; }
.message.user .message-content { background: #e1f3d8; display: inline-block; padding: 10px; border-radius: 8px; text-align: left;}
.message.agent .message-content { background: #fff; border: 1px solid #ebeef5; display: inline-block; padding: 10px; border-radius: 8px; }

.input-area { padding: 20px; border-top: 1px solid #eee; background: #fff; display: flex; flex-direction: column; gap: 10px; }

.upload-section { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }
.file-name { font-size: 12px; color: #606266; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px; }
.send-btn { width: 100%; }

.right-panel { flex: 1; background: #f0f2f5; position: relative; }
</style>
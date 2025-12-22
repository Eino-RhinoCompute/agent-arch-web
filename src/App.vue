<!-- src/App.vue -->
<template>
  <div class="app-layout">
    <!-- 左侧面板代码保持不变... -->
    <div class="left-panel">
      <!-- ...header, chat-history, input-area... -->
      <div class="header">
        <h2>AI Architect Agent</h2>
        <div class="session-info">Session: {{ shortSessionId }}</div>
      </div>

      <div class="chat-history" ref="chatBox">
        <div v-for="(msg, index) in chatHistory" :key="index" :class="['message', msg.role]">
          <div class="message-content">
            <div class="msg-role">{{ msg.role === 'user' ? 'User' : 'Agent' }}</div>
            <div class="msg-text">{{ msg.content }}</div>
          </div>
        </div>
        <div v-if="loading" class="loading-message">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>Thinking & Generating...</span>
        </div>
      </div>

      <div class="input-area">
        <div class="upload-section">
          <el-upload
            class="context-upload"
            action="#" :auto-upload="true" :show-file-list="false" :http-request="handleLocalPreview" accept=".obj,.glb,.gltf,.3dm" 
          >
            <el-button :icon="Folder" :type="hasContext ? 'success' : 'default'">
              {{ hasContext ? 'Context Loaded' : 'Load Context Model (.obj)' }}
            </el-button>
          </el-upload>
          <span v-if="hasContext" class="file-name">{{ contextFileName }}</span>
        </div>
        <el-input v-model="userInput" type="textarea" :rows="3" placeholder="请输入设计需求..." @keyup.enter.ctrl="handleSend" />
        <el-button type="primary" class="send-btn" @click="handleSend" :disabled="loading">发送 (Generate)</el-button>
      </div>
    </div>

    <!-- 右侧面板 -->
    <div class="right-panel">
      <!-- 🟢 传入 URL 而不是 Data -->
      <BuildingViewer 
        :contextFileUrl="contextModelUrl" 
        :generatedModelUrl="generatedModelUrl" 
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue';
import { v4 as uuidv4 } from 'uuid';
import { Loading, Folder } from '@element-plus/icons-vue';
import type { UploadRequestOptions } from 'element-plus';
import BuildingViewer from './components/BuildingViewer.vue';
import { sendDesignRequest } from './api/design';
import type { ChatMessage } from './types/agent';

// ...变量定义...
const sessionId = ref(uuidv4());
const shortSessionId = computed(() => sessionId.value.slice(0, 8));
const userInput = ref('');
const loading = ref(false);
const chatHistory = ref<ChatMessage[]>([]);
const chatBox = ref<HTMLDivElement | null>(null);

const contextModelUrl = ref<string | null>(null);
const contextFileName = ref('');
// 🟢 核心改动：存储模型 URL
const generatedModelUrl = ref<string | null>(null);
const hasContext = computed(() => !!contextModelUrl.value);

// 模拟多方案计数器
let demoCount = 0;

const handleLocalPreview = (options: UploadRequestOptions) => {
  const file = options.file;
  contextFileName.value = file.name;
  if (contextModelUrl.value) URL.revokeObjectURL(contextModelUrl.value);
  contextModelUrl.value = URL.createObjectURL(file);
  chatHistory.value.push({
    role: 'user', 
    content: `[System] 已加载环境模型: ${file.name}`,
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
    // 1. 调用后端 (仅仅为了拿文字回复和延时效果)
    const res = await sendDesignRequest({
      session_id: sessionId.value,
      query: query,
      context: contextFileName.value 
    });

    // 2. 🟢 前端直接决定加载哪个模型
    // 假设你的文件在 public/mock_models/01.obj
    // 这里做一个简单的轮询：01.obj -> 02.obj -> 01.obj
    const modelFiles = ['01.obj', '02.obj']; 
    const targetFile = modelFiles[demoCount % modelFiles.length];
    
    // 设置 URL，触发 BuildingViewer 加载
    // 注意：这里的路径是相对于 public 文件夹的 Web 路径
    generatedModelUrl.value = `/mock_models/${targetFile}`;
    
    demoCount++; // 计数器+1

    console.log(`✨ Demo: Loading local model ${targetFile}`);

    // 3. 处理文字回复
    // @ts-ignore
    const replyText = res.Reply || res.reply;
    if (replyText) {
      chatHistory.value.push({ role: 'agent', content: replyText, time: new Date().toLocaleTimeString() });
    }

  } catch (error) {
    console.error(error);
    chatHistory.value.push({ role: 'agent', content: "Error: 网络请求失败，但尝试加载演示模型...", time: new Date().toLocaleTimeString() });
    
    // 即使后端挂了，演示时也可以强制加载模型 (救场用)
    generatedModelUrl.value = `/mock_models/01.obj`;
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

<style scoped>
/* 保持所有原有样式不变... */
.app-layout { display: flex; height: 100vh; width: 100vw; overflow: hidden; }
.left-panel { width: 420px; background: #ffffff; border-right: 1px solid #e0e0e0; display: flex; flex-direction: column; box-shadow: 2px 0 8px rgba(0,0,0,0.05); z-index: 10; }
.header { padding: 15px 20px; background: #f9fafb; border-bottom: 1px solid #eee; }
.header h2 { margin: 0; font-size: 18px; color: #1f2937; font-weight: 700; }
.session-info { font-size: 12px; color: #9ca3af; margin-top: 4px; }
.chat-history { flex: 1; overflow-y: auto; padding: 20px; background: #f3f4f6; display: flex; flex-direction: column; gap: 15px; }
.message { display: flex; flex-direction: column; max-width: 85%; }
.message.user { align-self: flex-end; align-items: flex-end; }
.message.agent { align-self: flex-start; align-items: flex-start; }
.message-content { padding: 12px 16px; border-radius: 12px; position: relative; font-size: 14px; line-height: 1.6; word-wrap: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.msg-role { font-size: 11px; margin-bottom: 4px; opacity: 0.7; font-weight: bold; text-transform: uppercase; }
.message.user .message-content { background: #3b82f6; color: white; border-bottom-right-radius: 2px; }
.message.agent .message-content { background: #ffffff; color: #1f2937; border: 1px solid #e5e7eb; border-bottom-left-radius: 2px; }
.message-content:empty { display: none; }
.loading-message { align-self: center; font-size: 12px; color: #6b7280; display: flex; align-items: center; gap: 6px; margin-top: 10px; padding: 8px 16px; background: rgba(255,255,255,0.8); border-radius: 20px; }
.input-area { padding: 20px; background: #fff; border-top: 1px solid #eee; display: flex; flex-direction: column; gap: 12px; }
.upload-section { display: flex; align-items: center; gap: 10px; }
.file-name { font-size: 12px; color: #666; max-width: 150px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.send-btn { width: 100%; height: 40px; font-weight: bold; }
.right-panel { flex: 1; background: #262626; position: relative; }
</style>
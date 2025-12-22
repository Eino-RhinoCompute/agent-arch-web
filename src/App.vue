<template>
  <div class="app-layout">
    <!-- 左侧面板 -->
    <div class="left-panel">
      <!-- 标题区 -->
      <div class="header">
        <h2>AI Architect Agent</h2>
        <div class="session-info">Session: {{ shortSessionId }}</div>
      </div>

      <!-- 聊天记录区 -->
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

      <!-- 底部操作区 -->
      <div class="input-area">
        <!-- 1. 上传环境 -->
        <div class="upload-section">
          <el-upload
            class="context-upload"
            action="#" :auto-upload="true" :show-file-list="false" :http-request="handleLocalPreview" accept=".obj,.glb,.gltf,.3dm" 
          >
            <el-button :icon="Folder" :type="hasContext ? 'success' : 'default'" plain class="full-width-btn">
              {{ hasContext ? 'Context Loaded' : 'Load Context Model (.obj)' }}
            </el-button>
          </el-upload>
          <span v-if="hasContext" class="file-name">{{ contextFileName }}</span>
        </div>

        <!-- 2. 文本输入 -->
        <el-input 
          v-model="userInput" 
          type="textarea" 
          :rows="3" 
          placeholder="请输入设计需求 (例如: 生成一组办公建筑...)" 
          @keyup.enter.ctrl="handleSend" 
        />
        
        <!-- 3. 按钮组 -->
        <div class="button-group">
          <!-- 生成按钮 -->
          <el-button type="primary" class="action-btn" @click="handleSend" :disabled="loading">
            生成方案 (Generate)
          </el-button>

          <!-- 🟢 新增：下载按钮 (仅在有生成模型时显示) -->
          <el-button 
            v-if="generatedModelUrl" 
            type="warning" 
            class="action-btn" 
            :icon="Download"
            @click="handleDownload"
          >
            保存模型 (Save OBJ)
          </el-button>
        </div>
      </div>
    </div>

    <!-- 右侧面板 -->
    <div class="right-panel">
      <!-- 传递 URL 给 Viewer -->
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
import { Loading, Folder, Download } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus'; // 引入消息提示组件
import type { UploadRequestOptions } from 'element-plus';
import BuildingViewer from './components/BuildingViewer.vue';
import { sendDesignRequest } from './api/design';
import type { ChatMessage } from './types/agent';

// 状态定义
const sessionId = ref(uuidv4());
const shortSessionId = computed(() => sessionId.value.slice(0, 8));
const userInput = ref('');
const loading = ref(false);
const chatHistory = ref<ChatMessage[]>([]);
const chatBox = ref<HTMLDivElement | null>(null);

const contextModelUrl = ref<string | null>(null);
const contextFileName = ref('');
const generatedModelUrl = ref<string | null>(null);
const hasContext = computed(() => !!contextModelUrl.value);

// 模拟多方案计数器
let demoCount = 0;

// 上传 Context 逻辑
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

// 发送生成请求逻辑
const handleSend = async () => {
  if (!userInput.value.trim()) return;

  const query = userInput.value;
  userInput.value = '';

  chatHistory.value.push({ role: 'user', content: query, time: new Date().toLocaleTimeString() });
  scrollToBottom();
  loading.value = true;

  try {
    const res = await sendDesignRequest({
      session_id: sessionId.value,
      query: query,
      context: contextFileName.value 
    });

    // 轮询加载本地 Mock 模型
    const modelFiles = ['01.obj', '02.obj']; 
    const targetFile = modelFiles[demoCount % modelFiles.length];
    
    // 设置 URL
    generatedModelUrl.value = `/mock_models/${targetFile}`;
    demoCount++; 

    console.log(`✨ Demo: Loading local model ${targetFile}`);

    // 处理文字回复
    // @ts-ignore
    const replyText = res.Reply || res.reply;
    if (replyText) {
      chatHistory.value.push({ role: 'agent', content: replyText, time: new Date().toLocaleTimeString() });
    }

  } catch (error) {
    console.error(error);
    chatHistory.value.push({ role: 'agent', content: "Error: 网络请求失败，加载默认方案...", time: new Date().toLocaleTimeString() });
    generatedModelUrl.value = `/mock_models/01.obj`;
  } finally {
    loading.value = false;
    scrollToBottom();
  }
};

// 🟢 新增：下载处理逻辑
const handleDownload = () => {
  if (!generatedModelUrl.value) return;

  // 1. 创建一个临时的 <a> 标签
  const link = document.createElement('a');
  link.href = generatedModelUrl.value; // 这指向 /mock_models/01.obj
  
  // 2. 伪造下载文件名 (让它看起来很正式)
  // 例如: AI_Generated_Scheme_20231027.obj
  const timestamp = new Date().toISOString().slice(0,10).replace(/-/g, "");
  link.download = `AI_Generated_Scheme_${timestamp}_v${demoCount}.obj`;
  
  // 3. 触发点击下载
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // 4. 显示 Element Plus 成功提示
  ElMessage.success({
    message: '模型文件已成功导出并保存到本地！',
    type: 'success',
    duration: 3000
  });
};

const scrollToBottom = () => {
  nextTick(() => {
    if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
  });
};
</script>

<style>
/* 全局样式 (保持之前的修复) */
html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
#app { width: 100%; height: 100%; margin: 0; padding: 0; max-width: none !important; display: block !important; text-align: left !important; }
*, *::before, *::after { box-sizing: border-box; }
</style>

<style scoped>
.app-layout { display: flex; height: 100%; width: 100%; overflow: hidden; }

/* 左侧面板 */
.left-panel { 
  width: 420px; 
  min-width: 420px;
  background: #ffffff; 
  border-right: 1px solid #e0e0e0; 
  display: flex; 
  flex-direction: column; 
  box-shadow: 2px 0 8px rgba(0,0,0,0.05);
  z-index: 10;
}

.header { padding: 15px 20px; background: #f9fafb; border-bottom: 1px solid #eee; }
.header h2 { margin: 0; font-size: 18px; color: #1f2937; font-weight: 700; }
.session-info { font-size: 12px; color: #9ca3af; margin-top: 4px; }

/* 聊天区 */
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

/* 输入区样式优化 */
.input-area { 
  padding: 20px; 
  background: #fff; 
  border-top: 1px solid #eee; 
  display: flex; 
  flex-direction: column; 
  gap: 12px; 
}
.upload-section { display: flex; align-items: center; gap: 10px; }
.file-name { font-size: 12px; color: #666; max-width: 150px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }

/* 按钮组 */
.button-group {
  display: flex;
  flex-direction: column; /* 垂直排列 */
  gap: 10px;
}

.action-btn { 
  width: 100%; 
  height: 40px; 
  font-weight: bold; 
  margin: 0 !important; /* 覆盖 element-plus 的默认 margin */
}

.full-width-btn {
  width: 100%;
}

.right-panel { flex: 1; background: #262626; position: relative; }
</style>
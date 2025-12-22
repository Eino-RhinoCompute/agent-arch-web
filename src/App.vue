<template>
  <div class="app-layout">
    
    <!-- 🟢 模拟演示弹窗 (全屏遮罩) -->
    <div v-if="showAgentProcess" class="agent-process-overlay">
      <div class="agent-process-box">
        <div class="process-header">
          <el-icon class="is-loading" size="24"><Cpu /></el-icon>
          <h3>Multi-Agent System Working...</h3>
        </div>
        
        <!-- 模拟步骤条动画 -->
        <ul class="process-steps">
          <li :class="{ active: processStep >= 1, done: processStep > 1 }">
            <el-icon v-if="processStep > 1"><Check /></el-icon>
            <span v-else>1.</span> 
            Intent Recognition & Task Planning
          </li>
          <li :class="{ active: processStep >= 2, done: processStep > 2 }">
            <el-icon v-if="processStep > 2"><Check /></el-icon>
            <span v-else>2.</span>
            Calling Tool: <b>[{{ currentToolName }}]</b>
          </li>
          <li :class="{ active: processStep >= 3, done: processStep > 3 }">
            <el-icon v-if="processStep > 3"><Check /></el-icon>
            <span v-else>3.</span>
            Running Simulation & Calculation
          </li>
          <li :class="{ active: processStep >= 4, done: processStep > 4 }">
            <el-icon v-if="processStep > 4"><Check /></el-icon>
            <span v-else>4.</span>
            Generating Analysis Cloud Map
          </li>
        </ul>
      </div>
    </div>

    <!-- 左侧面板 -->
    <div class="left-panel">
      <div class="header">
        <h2>AI Architect Agent</h2>
        <div class="session-info">Session: {{ shortSessionId }}</div>
      </div>

      <div class="chat-history" ref="chatBox">
        <div v-for="(msg, index) in chatHistory" :key="index" :class="['message', msg.role]">
          <div class="message-content">
            <div class="msg-role">{{ msg.role === 'user' ? 'User' : 'Agent' }}</div>
            
            <!-- 🟢 图片显示逻辑 -->
            <div v-if="msg.image" class="msg-image-container">
              <el-image 
                :src="msg.image" 
                :preview-src-list="[msg.image]" 
                fit="cover" 
                class="chat-img"
              />
              <div class="img-caption">Simulation Result</div>
            </div>

            <div class="msg-text">{{ msg.content }}</div>
          </div>
        </div>
        
        <!-- 普通 Loading (仅在没有弹窗时显示) -->
        <div v-if="loading && !showAgentProcess" class="loading-message">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>Agent is thinking...</span>
        </div>
      </div>

      <div class="input-area">
        <div class="upload-section">
          <el-upload
            class="context-upload"
            action="#" :auto-upload="true" :show-file-list="false" :http-request="handleLocalPreview" accept=".obj,.glb,.gltf,.3dm" 
          >
            <el-button :icon="Folder" :type="hasContext ? 'success' : 'default'" plain class="full-width-btn">
              {{ hasContext ? 'Context Loaded' : 'Load Context Model' }}
            </el-button>
          </el-upload>
          <span v-if="hasContext" class="file-name">{{ contextFileName }}</span>
        </div>
        <el-input 
          v-model="userInput" 
          type="textarea" 
          :rows="3" 
          placeholder="输入需求 (例如: 进行风环境模拟...)" 
          @keyup.enter.ctrl="handleSend" 
        />
        
        <div class="button-group">
          <el-button type="primary" class="action-btn" @click="handleSend" :disabled="loading || showAgentProcess">
            发送 (Send)
          </el-button>
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
import { Loading, Folder, Download, Cpu, Check } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import type { UploadRequestOptions } from 'element-plus';
import BuildingViewer from './components/BuildingViewer.vue';
import { sendDesignRequest } from './api/design';

// 🟢 资源映射表 (确保 public/mock_images/ 下有 wind.png)
const MODEL_MAP: Record<string, string> = {
  'initial':   '/mock_models/01.obj',
  'optimized': '/mock_models/02.obj',
};

const IMAGE_MAP: Record<string, string> = {
  'sunlight': '/mock_images/sunlight.png',
  'wind':     '/mock_images/wind.png',
  'comfort':  '/mock_images/comfort.png',
};

interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
  image?: string;
  time: string;
}

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

// 动画状态
const showAgentProcess = ref(false);
const processStep = ref(1);
const currentToolName = ref('Simulation');

const handleLocalPreview = (options: UploadRequestOptions) => {
  const file = options.file;
  contextFileName.value = file.name;
  if (contextModelUrl.value) URL.revokeObjectURL(contextModelUrl.value);
  contextModelUrl.value = URL.createObjectURL(file);
  chatHistory.value.push({ role: 'user', content: `[System] 环境模型加载: ${file.name}`, time: new Date().toLocaleTimeString() });
};

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

    console.log("📦 Full Backend Response:", res); // 调试日志

    // 🟢 1. 极其稳健的数据读取逻辑 (兼容 snake_case 和 PascalCase)
    // @ts-ignore
    const payload = res.data_payload || res.DataPayload || {};
    
    // @ts-ignore
    const actionType = payload.action_type || payload.ActionType;
    
    // @ts-ignore
    const modelKey = payload.geometry_data || payload.GeometryData || 'initial';
    
    // @ts-ignore
    const imgArr = payload.analysis_image || payload.AnalysisImage;
    const imageKey = (imgArr && imgArr.length > 0) ? imgArr[0] : '';

    console.log(`🔍 Parsed Keys -> Model: ${modelKey}, Image: ${imageKey}, Action: ${actionType}`);

    // 2. 映射为真实 URL
    // 注意：MODEL_MAP 和 IMAGE_MAP 的 Key 必须和后端返回的字符串一致 (比如 "wind")
    const finalModelUrl = MODEL_MAP[modelKey] || MODEL_MAP['initial'] || null;
    const finalImageUrl = IMAGE_MAP[imageKey] || '';

    // 3. 触发动画逻辑
    if (finalImageUrl) {
      // 根据图片类型设置工具名称
      if (imageKey.includes('wind')) currentToolName.value = "CFD Wind Analysis Agent";
      else if (imageKey.includes('sun')) currentToolName.value = "Sunlight Analysis Agent";
      else if (imageKey.includes('comfort')) currentToolName.value = "Thermal Comfort Agent";
      else currentToolName.value = "Performance Simulation";

      showAgentProcess.value = true;
      await runSimulationDemo();
      showAgentProcess.value = false;
    }

    // 4. 更新右侧模型
    generatedModelUrl.value = finalModelUrl;

    // 5. 左侧回复上屏
    // @ts-ignore
    const replyText = res.reply || res.Reply || "";
    
    chatHistory.value.push({
      role: 'agent',
      content: replyText,
      image: finalImageUrl, // 只有这里传了值，模板里的 v-if="msg.image" 才会生效
      time: new Date().toLocaleTimeString()
    });

  } catch (error) {
    console.error("❌ Error in handleSend:", error);
    chatHistory.value.push({ role: 'agent', content: "Error: 数据解析失败。", time: new Date().toLocaleTimeString() });
  } finally {
    loading.value = false;
    scrollToBottom();
  }
};

// 模拟动画步进 (每一步 800ms)
const runSimulationDemo = async () => {
  const stepDelay = 800; 
  processStep.value = 1; await new Promise(r => setTimeout(r, stepDelay));
  processStep.value = 2; await new Promise(r => setTimeout(r, stepDelay));
  processStep.value = 3; await new Promise(r => setTimeout(r, stepDelay));
  processStep.value = 4; await new Promise(r => setTimeout(r, stepDelay));
  // 额外停顿一下展示"完成"状态
  await new Promise(r => setTimeout(r, 600));
};

const handleDownload = () => {
  if (!generatedModelUrl.value) return;
  const link = document.createElement('a');
  link.href = generatedModelUrl.value;
  const timestamp = new Date().toISOString().slice(0,10).replace(/-/g, "");
  link.download = `AI_Generated_Scheme_${timestamp}.obj`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  ElMessage.success('模型文件已下载');
};

const scrollToBottom = () => {
  nextTick(() => {
    if (chatBox.value) chatBox.value.scrollTop = chatBox.value.scrollHeight;
  });
};
</script>

<style>
/* 全局重置 */
html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
#app { width: 100%; height: 100%; margin: 0; padding: 0; max-width: none !important; display: block !important; text-align: left !important; }
*, *::before, *::after { box-sizing: border-box; }
</style>

<style scoped>
.app-layout { display: flex; height: 100%; width: 100%; overflow: hidden; position: relative; }

/* 🟢 Agent Process Overlay (弹窗样式) */
.agent-process-overlay {
  position: absolute;
  top: 0; left: 0; width: 100%; height: 100%;
  background: rgba(0, 0, 0, 0.65); /* 半透明遮罩 */
  z-index: 999;
  display: flex;
  justify-content: center;
  align-items: center;
  backdrop-filter: blur(8px); /* 模糊背景 */
}

.agent-process-box {
  background: #fff;
  padding: 30px;
  border-radius: 12px;
  width: 420px;
  box-shadow: 0 15px 40px rgba(0,0,0,0.4);
  text-align: left;
  border: 1px solid rgba(255,255,255,0.2);
}

.process-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 25px;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 15px;
}
.process-header h3 { margin: 0; color: #409eff; font-size: 18px; }

.process-steps { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 15px; }
.process-steps li {
  font-size: 14px; color: #aaa; display: flex; align-items: center; gap: 10px; transition: all 0.3s ease;
}
.process-steps li.active { color: #333; font-weight: 600; transform: translateX(6px); }
.process-steps li.done { color: #67c23a; }

/* 左侧面板 */
.left-panel { width: 420px; min-width: 420px; background: #ffffff; border-right: 1px solid #e0e0e0; display: flex; flex-direction: column; box-shadow: 2px 0 8px rgba(0,0,0,0.05); z-index: 10; }
.header { padding: 15px 20px; background: #f9fafb; border-bottom: 1px solid #eee; }
.header h2 { margin: 0; font-size: 18px; color: #1f2937; font-weight: 700; }
.session-info { font-size: 12px; color: #9ca3af; margin-top: 4px; }
.chat-history { flex: 1; overflow-y: auto; padding: 20px; background: #f3f4f6; display: flex; flex-direction: column; gap: 15px; }

/* 消息 & 图片 */
.message { display: flex; flex-direction: column; max-width: 90%; }
.message.user { align-self: flex-end; align-items: flex-end; }
.message.agent { align-self: flex-start; align-items: flex-start; }
.message-content { padding: 12px 16px; border-radius: 12px; position: relative; font-size: 14px; line-height: 1.6; word-wrap: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.msg-role { font-size: 11px; margin-bottom: 4px; opacity: 0.7; font-weight: bold; text-transform: uppercase; }
.message.user .message-content { background: #3b82f6; color: white; border-bottom-right-radius: 2px; }
.message.agent .message-content { background: #ffffff; color: #1f2937; border: 1px solid #e5e7eb; border-bottom-left-radius: 2px; }
.message-content:empty { display: none; }

.msg-image-container { margin-bottom: 10px; border-radius: 6px; overflow: hidden; border: 1px solid #eee; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.chat-img { width: 100%; height: auto; display: block; }
.img-caption { font-size: 10px; color: #999; background: #f9f9f9; padding: 4px 5px; text-align: center; border-top: 1px solid #eee; }

.loading-message { align-self: center; font-size: 12px; color: #6b7280; display: flex; align-items: center; gap: 6px; margin-top: 10px; padding: 8px 16px; background: rgba(255,255,255,0.8); border-radius: 20px; }
.input-area { padding: 20px; background: #fff; border-top: 1px solid #eee; display: flex; flex-direction: column; gap: 12px; }
.upload-section { display: flex; align-items: center; gap: 10px; }
.file-name { font-size: 12px; color: #666; max-width: 150px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.button-group { display: flex; flex-direction: column; gap: 10px; }
.action-btn { width: 100%; height: 40px; font-weight: bold; margin: 0 !important; }
.full-width-btn { width: 100%; }

.right-panel { flex: 1; background: #262626; position: relative; }
</style>
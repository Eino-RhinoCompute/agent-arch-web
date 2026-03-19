<template>
  <div 
    class="app-layout" 
    @mousemove="handleMouseMove" 
    @mouseup="handleMouseUp" 
    @mouseleave="handleMouseUp"
  >
    
    <!-- 🟢 模拟演示弹窗 (全屏遮罩) -->
    <div v-if="showAgentProcess" class="agent-process-overlay">
      <div class="agent-process-box">
        <div class="process-header">
          <el-icon class="is-loading" size="24"><Cpu /></el-icon>
          <h3>Multi-Agent System Working...</h3>
        </div>
        <ul class="process-steps">
          <li :class="{ active: processStep >= 1, done: processStep > 1 }"><el-icon v-if="processStep > 1"><Check /></el-icon><span v-else>1.</span> Intent Recognition & Task Planning</li>
          <li :class="{ active: processStep >= 2, done: processStep > 2 }"><el-icon v-if="processStep > 2"><Check /></el-icon><span v-else>2.</span> Calling Tool: <b>[{{ currentToolName }}]</b></li>
          <li :class="{ active: processStep >= 3, done: processStep > 3 }"><el-icon v-if="processStep > 3"><Check /></el-icon><span v-else>3.</span> Running Simulation & Calculation</li>
          <li :class="{ active: processStep >= 4, done: processStep > 4 }"><el-icon v-if="processStep > 4"><Check /></el-icon><span v-else>4.</span> Generating Analysis Cloud Map</li>
        </ul>
      </div>
    </div>

    <!-- 左侧面板 (动态宽度) -->
    <div class="left-panel" :style="{ width: leftPanelWidth + 'px' }">
      <div class="header">
        <h2>AI Architect Agent</h2>
        <div class="session-info">Session: {{ shortSessionId }}</div>
      </div>

      <div class="chat-history" ref="chatBox">
        <div v-for="(msg, index) in chatHistory" :key="index" :class="['message', msg.role]">
          <div class="message-content">
            <div class="msg-role">{{ msg.role === 'user' ? 'User' : 'Agent' }}</div>
            <div v-if="msg.image" class="msg-image-container">
              <el-image :src="msg.image" :preview-src-list="[msg.image]" fit="cover" class="chat-img" />
              <div class="img-caption">Simulation Result</div>
            </div>
            <div class="msg-text" style="white-space: pre-wrap;">{{ msg.content }}</div>
          </div>
        </div>
        <div v-if="loading && !showAgentProcess" class="loading-message">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>Agent is searching knowledge base & thinking...</span>
        </div>
      </div>

      <div class="input-area">
        <div class="upload-section">
          <el-upload class="context-upload" action="#" :auto-upload="true" :show-file-list="false" :http-request="handleLocalPreview" accept=".obj,.glb,.gltf,.3dm">
            <el-button :icon="Folder" :type="hasContext ? 'success' : 'default'" plain class="full-width-btn">
              {{ hasContext ? 'Context Loaded' : 'Load Context Model' }}
            </el-button>
          </el-upload>
          <span v-if="hasContext" class="file-name">{{ contextFileName }}</span>
        </div>
        <el-input v-model="userInput" type="textarea" :rows="3" placeholder="输入需求..." @keyup.enter.ctrl="handleSend" />
        <div class="button-group">
          <el-button type="primary" class="action-btn" @click="handleSend" :disabled="loading || showAgentProcess">发送 (Send)</el-button>
          <el-button v-if="generatedModelUrl" type="warning" class="action-btn" :icon="Download" @click="handleDownload">保存模型 (Save OBJ)</el-button>
        </div>
      </div>
    </div>

    <!-- 🟢 拖拽手柄 -->
    <div class="resizer" :class="{ dragging: isDragging }" @mousedown="handleMouseDown"></div>

    <!-- 右侧面板 -->
    <div class="right-panel">
      <!-- 拖拽时的隐形遮罩，防止卡顿 -->
      <div v-if="isDragging" class="drag-overlay"></div>
      
      <BuildingViewer :contextFileUrl="contextModelUrl" :generatedModelUrl="generatedModelUrl" />
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

// ==========================================
// 拖拽控制逻辑
// ==========================================
const leftPanelWidth = ref(420);
const isDragging = ref(false);

const handleMouseDown = () => {
  isDragging.value = true;
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'col-resize';
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging.value) return;
  let newWidth = e.clientX;
  if (newWidth < 350) newWidth = 350;
  if (newWidth > window.innerWidth * 0.6) newWidth = window.innerWidth * 0.6;
  leftPanelWidth.value = newWidth;
  window.dispatchEvent(new Event('resize'));
};

const handleMouseUp = () => {
  if (isDragging.value) {
    isDragging.value = false;
    document.body.style.userSelect = '';
    document.body.style.cursor = 'default';
  }
};

// ==========================================
// 核心状态与映射
// ==========================================
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

  // 1. RAG 拦截
  const RAG_TRIGGER_QUERY = "南京市设计办公建筑园区时有哪些要点需要注意？";
  if (query.trim() === RAG_TRIGGER_QUERY || query.includes("哪些要点需要注意")) {
    await new Promise(resolve => setTimeout(resolve, 1500));
const ragReply = `✅ 已调用[RAG_Search_Agent] 检索内置知识库。
基于《南京市城市规划管理技术规定》及相关建筑规范，为您总结办公建筑园区设计的关键要点：

1. **容积率与建筑密度**：根据南京市不同区位（如主城区与新城区），办公园区的容积率通常控制在 1.5 - 4.0 之间，建筑密度一般不超过 40%。
2. **日照与退界**：虽办公建筑非居住类，但需确保不对周边住宅产生违规遮挡（需满足大寒日2小时日照要求）。建筑退让道路红线和用地红线的距离需严格满足当地规划局的强制性要求。
3. **停车配建**：南京市要求机动车停车位按每 100 平方米建筑面积不少于 0.8 - 1.2 个进行配建，且需按比例配置新能源充电桩。
4. **绿色生态（海绵城市）**：响应南京市“绿色建筑”要求，园区绿地率通常需达到 20% - 30%，建议融入海绵城市设计（如透水铺装、雨水花园）。
5. **视线与高度控制**：若地块位于紫金山、明城墙等历史风貌保护区或视线走廊周边，建筑高度将受到严格的绝对限高控制。

*(注：本回答基于 RAG 检索本地规范知识库生成，后续可在此规范约束下进行体量生成。)*`;
    chatHistory.value.push({ role: 'agent', content: ragReply, time: new Date().toLocaleTimeString() });
    loading.value = false;
    scrollToBottom();
    return;
  }

  // 2. 体量生成拦截
  if (query.includes("100m * 100m") || query.includes("中心园区")) {
    await new Promise(resolve => setTimeout(resolve, 2500)); 
    generatedModelUrl.value = '/mock_models/courtyard.obj';
    const massingReply = `✅ 已完成办公园区体量生成。

基于您提供的 100m × 100m 方形场地边界，并结合“中心园区”的核心需求，系统为您生成了【围合式中心庭院】布局方案。

🏢 **方案空间特征**：
1. **向心围合布局**：四栋独立的办公塔楼分置于场地的四个角部。这种布局最大程度地释放了场地内部空间，塑造出了一个尺度连贯的大型核心园区。
2. **通透的视线通廊**：建筑组团之间保留了十字形的开口，为园区界定了清晰的步行入口，避免了封闭压抑感。
3. **功能与场所感**：中心园区可作为整个办公组团的“绿肺”与社交客厅，为景观植被覆盖和微气候调节预留了物理空间。

请在右侧视窗中查看生成的建筑体量。如果您需要验证该布局的物理环境表现（如：日照、风环境或热舒适度模拟），请随时下达指令。`;
    chatHistory.value.push({ role: 'agent', content: massingReply, time: new Date().toLocaleTimeString() });
    loading.value = false;
    scrollToBottom();
    return;
  }

  // 3. 热舒适模拟拦截
  if (query.includes("热舒适") || query.includes("热环境") || query.includes("温度模拟")) {
    currentToolName.value = "UTCI_Comfort_Agent";
    showAgentProcess.value = true;
    await runSimulationDemo(); 
    showAgentProcess.value = false;

    const simulationReply = `✅ 已调用[Simulation_Agent] 完成 UTCI 室外热舒适度模拟。

📊 **热舒适（UTCI）云图特征解析**：
基于当前【中心庭院式】体量生成的云图显示，场地整体热舒适指标介于 28.81℃ 至 30.63℃ 之间，空间分布特征如下：
1. **庭院自遮挡优势（Self-shading）**：四周环绕的建筑体量为中心广场提供了良好的物理遮挡。黄绿色区域（中心庭院）的 UTCI 值稳定在 29.5℃ 左右，热应力显著低于无遮挡区域。
2. **风廊散热效应**：建筑四角的十字形开口形成了有效的穿堂风廊道，加速了中心庭院热量的消散，局部体感温度进一步降低。
3. **边缘热暴露区**：场地四周外围（深红色区域，高达 30.6℃）由于完全暴露且缺乏建筑遮蔽，接收了较高的太阳辐射，属于高热应力区。

**Agent 综合评估**：
测试验证表明，当前匹配的【中心庭院式】模版在夏季展现出优异的热力学表现，满足办公园区的人体热舒适需求。`;

    chatHistory.value.push({ 
      role: 'agent', 
      content: simulationReply, 
      image: '/mock_images/comfort.png', 
      time: new Date().toLocaleTimeString() 
    });
    loading.value = false;
    scrollToBottom();
    return;
  }

  // 4. 正常后端调用逻辑
  try {
    const res = await sendDesignRequest({
      session_id: sessionId.value,
      query: query,
      context: contextFileName.value 
    });

    // 🟢 彻底解决 TS 报错：使用 ?. 安全提取属性
    const modelKey = res.data_payload?.geometry_data || 'initial';
    const finalModelUrl = MODEL_MAP[modelKey] || MODEL_MAP['initial'] || null;
    
    generatedModelUrl.value = finalModelUrl;

    const replyText = res.reply || "已完成操作。";
    chatHistory.value.push({ role: 'agent', content: replyText, time: new Date().toLocaleTimeString() });

  } catch (error) {
    console.error("❌ Error:", error);
    chatHistory.value.push({ role: 'agent', content: "Error: 后端无响应或数据解析失败。", time: new Date().toLocaleTimeString() });
  } finally {
    loading.value = false;
    scrollToBottom();
  }
};

const runSimulationDemo = async () => {
  const stepDelay = 800; 
  processStep.value = 1; await new Promise(r => setTimeout(r, stepDelay));
  processStep.value = 2; await new Promise(r => setTimeout(r, stepDelay));
  processStep.value = 3; await new Promise(r => setTimeout(r, stepDelay));
  processStep.value = 4; await new Promise(r => setTimeout(r, stepDelay));
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
html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; }
#app { width: 100%; height: 100%; margin: 0; padding: 0; max-width: none !important; display: block !important; text-align: left !important; }
*, *::before, *::after { box-sizing: border-box; }
</style>

<style scoped>
.app-layout { display: flex; height: 100%; width: 100%; overflow: hidden; position: relative; }

.resizer {
  width: 5px;
  background-color: #f0f2f5;
  border-left: 1px solid #e0e0e0;
  border-right: 1px solid #e0e0e0;
  cursor: col-resize;
  z-index: 50;
  transition: background-color 0.2s ease;
}
.resizer:hover, .resizer.dragging { background-color: #409eff; }

.drag-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 999;
  cursor: col-resize;
}

.agent-process-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.65); z-index: 1000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(8px); }
.agent-process-box { background: #fff; padding: 30px; border-radius: 12px; width: 420px; box-shadow: 0 15px 40px rgba(0,0,0,0.4); text-align: left; border: 1px solid rgba(255,255,255,0.2); }
.process-header { display: flex; align-items: center; gap: 12px; margin-bottom: 25px; border-bottom: 1px solid #f0f0f0; padding-bottom: 15px; }
.process-header h3 { margin: 0; color: #409eff; font-size: 18px; }
.process-steps { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 15px; }
.process-steps li { font-size: 14px; color: #aaa; display: flex; align-items: center; gap: 10px; transition: all 0.3s ease; }
.process-steps li.active { color: #333; font-weight: 600; transform: translateX(6px); }
.process-steps li.done { color: #67c23a; }

.left-panel { 
  background: #ffffff; 
  display: flex; 
  flex-direction: column; 
  box-shadow: 2px 0 8px rgba(0,0,0,0.05); 
  z-index: 10; 
  flex-shrink: 0; 
}

.header { padding: 15px 20px; background: #f9fafb; border-bottom: 1px solid #eee; }
.header h2 { margin: 0; font-size: 18px; color: #1f2937; font-weight: 700; }
.session-info { font-size: 12px; color: #9ca3af; margin-top: 4px; }
.chat-history { flex: 1; overflow-y: auto; padding: 20px; background: #f3f4f6; display: flex; flex-direction: column; gap: 15px; }

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

.right-panel { flex: 1; background: #262626; position: relative; overflow: hidden; }
</style>
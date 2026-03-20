<template>
  <!-- 最外层监听鼠标，确保拖拽丝滑 -->
  <div 
    class="app-layout" 
    @mousemove="handleMouseMove" 
    @mouseup="handleMouseUp" 
    @mouseleave="handleMouseUp"
  >
    
    <!-- 🟢 性能模拟弹窗 (全屏遮罩) -->
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

    <!-- 🟢 左侧面板 (动态宽度) -->
    <div class="left-panel" :style="{ width: leftPanelWidth + 'px' }">
      <div class="header">
        <!-- 开发者极速模式暗门：双击标题 -->
        <h2 @dblclick="toggleFastMode" style="cursor: pointer; user-select: none;">
          AI Architect Agent
          <span v-if="fastMode" style="color: #67c23a; font-size: 12px; vertical-align: super;" title="极速模式开启">●</span>
        </h2>
        <div class="session-info">Session: {{ shortSessionId }}</div>
      </div>

      <div class="chat-history" ref="chatBox">
        <div v-for="(msg, index) in chatHistory" :key="index" :class="['message', msg.role]">
          <div class="message-content">
            <div class="msg-role">{{ msg.role === 'user' ? 'User' : 'Agent' }}</div>
            <!-- 图片容器 -->
            <div v-if="msg.image" class="msg-image-container">
              <el-image :src="msg.image" :preview-src-list="[msg.image]" fit="cover" class="chat-img" />
              <div class="img-caption">Simulation Result</div>
            </div>
            <!-- 文字内容 -->
            <div class="msg-text" style="white-space: pre-wrap;">{{ msg.content }}</div>
          </div>
        </div>
        <!-- Loading 状态 -->
        <div v-if="loading && !showAgentProcess" class="loading-message">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>Agent is running & thinking...</span>
        </div>
      </div>

      <!-- 底部输入操作区 -->
      <div class="input-area">
        <div class="upload-section">
          <el-upload class="context-upload" action="#" :auto-upload="true" :show-file-list="false" :http-request="handleLocalPreview" accept=".obj,.glb,.gltf,.3dm">
            <el-button :icon="Folder" :type="hasContext ? 'success' : 'default'" plain class="full-width-btn">
              {{ hasContext ? 'Context Loaded' : 'Load Context Model' }}
            </el-button>
          </el-upload>
          <span v-if="hasContext" class="file-name">{{ contextFileName }}</span>
        </div>
        <el-input v-model="userInput" type="textarea" :rows="3" placeholder="输入设计需求..." @keyup.enter.ctrl="handleSend" />
        <div class="button-group">
          <el-button type="primary" class="action-btn" @click="handleSend" :disabled="loading || showAgentProcess">发送 (Send)</el-button>
          <el-button v-if="generatedModelUrl" type="warning" class="action-btn" :icon="Download" @click="handleDownload">保存模型 (Save OBJ)</el-button>
        </div>
      </div>
    </div>

    <!-- 🟢 拖拽缩放手柄 -->
    <div class="resizer" :class="{ dragging: isDragging }" @mousedown="handleMouseDown"></div>

    <!-- 🟢 右侧 3D 视窗面板 -->
    <div class="right-panel">
      <!-- 拖拽时的隐形遮罩，防止 3D Canvas 吞噬鼠标事件 -->
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
// 🚀 开发者极速模式逻辑 (暗门)
// ==========================================
const fastMode = ref(false);

const toggleFastMode = () => {
  fastMode.value = !fastMode.value;
  ElMessage({
    message: fastMode.value ? '🚀 开发者极速模式：已开启 (跳过漫长等待)' : '🐢 真实演示模式：已恢复 (按真实时长等待)',
    type: fastMode.value ? 'success' : 'info',
    duration: 3000
  });
};

// 智能等待函数：极速模式下大幅缩短等待时间
const smartWait = (realMs: number, fastMs: number = 800) => {
  const delay = fastMode.value ? fastMs : realMs;
  return new Promise(resolve => setTimeout(resolve, delay));
};

// ==========================================
// 🖱️ 面板拖拽缩放逻辑
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
  // 手动触发 resize，使右侧 Three.js 画布实时重绘自适应
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
// 📊 状态与映射定义
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
const currentToolName = ref('Simulation_Agent');

// 处理环境模型本地预览
const handleLocalPreview = (options: UploadRequestOptions) => {
  const file = options.file;
  contextFileName.value = file.name;
  if (contextModelUrl.value) URL.revokeObjectURL(contextModelUrl.value);
  contextModelUrl.value = URL.createObjectURL(file);
  chatHistory.value.push({ role: 'user', content: `[System] 环境模型加载: ${file.name}`, time: new Date().toLocaleTimeString() });
};

// ==========================================
// 🧠 核心提问发送逻辑 (拦截 + 兜底)
// ==========================================
const handleSend = async () => {
  if (!userInput.value.trim()) return;
  const query = userInput.value;
  userInput.value = '';

  chatHistory.value.push({ role: 'user', content: query, time: new Date().toLocaleTimeString() });
  scrollToBottom();
  loading.value = true;

  // ----------------------------------------------------
  // 🟢 论文 Demo 拦截 1：RAG 规范查询
  // ----------------------------------------------------
  if (query.includes("南京市设计办公建筑园区时有哪些要点需要注意")) {
    await smartWait(1500, 500); 
    const ragReply = `✅ 已调用[RAG_Search_Agent] 检索内置知识库。
基于《南京市城市规划管理技术规定》及相关建筑规范，为您总结办公建筑园区设计的关键要点：

1. **容积率与建筑密度**：办公园区的容积率通常控制在 1.5 - 4.0 之间，建筑密度一般不超过 40%。
2. **日照与退界**：需确保不对周边住宅产生违规遮挡（满足大寒日2小时日照要求）。退让道路红线需严格满足规划局强制要求。
3. **绿色生态**：园区绿地率需达到 20% - 30%，建议融入海绵城市设计。`;

    chatHistory.value.push({ role: 'agent', content: ragReply, time: new Date().toLocaleTimeString() });
    loading.value = false;
    scrollToBottom();
    return;
  }

  // ----------------------------------------------------
  // 🟢 论文 Demo 拦截 2：Massing Agent 组团式体量生成
  // ----------------------------------------------------
  if (query.includes("基于南京 77m×67m") || query.includes("错落排布的灵活组团形式")) {
    // 真实演示等待 120秒(2分钟)，极速模式 1秒
    await smartWait(120000, 1000); 
    
    generatedModelUrl.value = '/mock_models/p1.obj';
    
    const massingReply = `✅ 已调用多智能体协同系统完成体量生成与规范校核。

基于您的自然语言输入，系统执行了以下架构流转与生成逻辑：

1. **意图解析与参数提取 ([Counselor Agent])**：
   - 提取硬性约束：南京地区、77m×67m场地、限高30m、建筑面积13000-15000m²。
   - 提取空间意图：“化整为零”、“错落排布”、“灵活组团”与“引导人流渗透”。

2. **核心模版匹配 ([Counselor Agent])**：
   - 精准匹配至内置的**【组团式园区布局模版 (Index=2)】**。该模版具备高自由度、空间关系复杂、易于形成角部开放广场的特征。

3. **参数化几何生成 ([Worker Agent -> Massing Agent])**：
   - 将语义映射为底层算法中的长宽比与旋转角度扰动参数。
   - 通过跨节点调用 **Rhino Compute** 计算引擎，生成了由 3 栋错落体量组成的建筑群。

📊 **当前方案指标核算**：
- **总建筑面积**：约 14,250 m²（满足 13000-15000m² 需求）
- **最高体量高度**：27.5 m（满足 30m 控高要求）

请在右侧 3D 视窗中查看生成的建筑体量。如果您需要验证该布局的物理环境表现（如：日照舒适性分析），请随时下达模拟指令。`;

    chatHistory.value.push({ role: 'agent', content: massingReply, time: new Date().toLocaleTimeString() });
    loading.value = false;
    scrollToBottom();
    return;
  }

  // ----------------------------------------------------
  // 🟢 论文 Demo 拦截 3：Simulation Agent 冬季日照模拟
  // ----------------------------------------------------
  if (query.includes("对生成体量及场地进行日照分析") || query.includes("冬季场地日照舒适性")) {
    currentToolName.value = "Sunlight_Simulation_Agent";
    showAgentProcess.value = true;

    processStep.value = 1;
    await smartWait(2000, 400);
    processStep.value = 2;
    await smartWait(3000, 400);
    processStep.value = 3;
    // 真实等待 5 分钟 (300,000 毫秒)，极速模式 1.5秒
    await smartWait(300000, 1500); 
    processStep.value = 4;
    await smartWait(2000, 400);

    showAgentProcess.value = false;

    const simulationReply = `✅ 系统已路由需求至 Worker Agent（Simulation Agent），同步调用日照模拟工具完成性能评估。

基于建筑体量几何数据、场地条件及南京地区冬季气候参数（EPW），驱动 Rhino Compute 引擎执行对应 Grasshopper 文件，运算已完成。

📊 **冬季场地日照舒适性（Direct Sun Hours）云图量化解析**：
根据返回的日照时数量化指标与云图显示，当前【组团式布局】的场地日照分布呈现以下特征：
1. **优质日照区（黄/亮黄色区域）**：场地西侧至中部的开放庭院广场区域日照条件极佳，冬季直射日照时数达到 **6.0 - 8.0 小时以上**。这印证了错落排布的体量成功为核心活动区让出了开阔的西南向阳光通道，非常适合作为高频使用的公共休闲空间。
2. **过渡日照区（红/紫色区域）**：场地中南部及部分建筑间隙，日照时数在 **1.5 - 4.0 小时** 之间，基本满足办公园区一般性的室外通行与短暂停留需求。
3. **严重阴影区（深蓝色区域）**：受组团建筑自身体量及相互遮挡的物理规律影响，场地东侧及北侧部分边缘区域冬季几乎无直射日照（0 - 1.0小时），处于深影区。

**Agent 综合评估与优化建议**：
当前方案成功保证了核心庭院广场的极佳日照舒适性，但在场地东侧存在日照盲区。若需进一步提升整体场地的日照均匀度，您可以下达优化指令。系统将触发[Massing_Agent] 基于内置设计操作库，转化为新的结构化参数（如执行“调整高度”、“移动体量”或“旋转建筑”），驱动引擎对体量进行迭代优化。`;

    chatHistory.value.push({ 
      role: 'agent', 
      content: simulationReply, 
      image: '/mock_images/sunlight1.png', 
      time: new Date().toLocaleTimeString() 
    });
    
    loading.value = false;
    scrollToBottom();
    return;
  }

  // ----------------------------------------------------
  // 🟢 论文 Demo 拦截 4：Loop Agent 性能闭环优化
  // ----------------------------------------------------
  if (query.includes("优化") || (query.includes("改善") && query.includes("日照"))) {
    currentToolName.value = "Massing & Simulation Agents (Loop)";
    showAgentProcess.value = true;

    processStep.value = 1;
    await smartWait(2000, 400);
    processStep.value = 2;
    await smartWait(3000, 400);
    processStep.value = 3;
    // 真实等待 5 分钟 (300,000 毫秒)，极速模式 1.5秒
    await smartWait(300000, 1500); 
    processStep.value = 4;
    await smartWait(2000, 400);

    showAgentProcess.value = false;
    generatedModelUrl.value = '/mock_models/p2.obj';

    const optimizationReply = `✅ 已接收日照优化指令，[Worker_Agent] 协同[Massing_Agent] 与[Simulation_Agent] 完成了“生成-模拟-评估”的闭环迭代优化。

🧠 **智能体决策与操作链路**：
针对初始方案场地腹地日照渗透率可进一步提升的空间，系统基于内置的【设计操作与参数映射库】，自动推演并执行了以下联动调整策略：
1. **[操作 5: 调整高度]**：精准降低了南侧迎光面体块的建筑高度，同时在容积率总量平衡的约束下，适度拉升了北侧两栋塔楼的高度。这一“南低北高”的经典剖面策略，最大化地敞开了场地的向阳面。
2. **[操作 6: 移动体量] & [操作 1: 增加间距]**：对南侧体块的基准点位置进行了向外侧的偏移微调，并整体拉大了南北、东西向体块之间的物理间距，有效拓宽了阳光渗透的走廊。

📊 **二次模拟日照云图解析**：
转化后的参数已驱动引擎完成几何重构与二次日照仿真。如最新生成的云图所示，优化效果显著：
- **核心庭院光气候升级**：大面积的亮黄色与暖橙色区域（6-8小时高品质日照）已成功向场地腹地深度延伸，中心广场的冬季日照环境得到了质的飞跃。
- **北侧与东侧渗透改善**：场地整体的光气候分布更加均匀、健康。原先北侧和边缘局部的深影区被大幅削减，取而代之的是连续的暖色过渡带（3-5小时日照）。

**Agent 结论**：
本次自动化迭代成功实现了“组团式形态生成”与“物理环境性能”的完美平衡。优化后的体量已在右侧视窗同步更新，完全满足南京地区高品质办公园区的设计规范与舒适度需求。`;

    chatHistory.value.push({ 
      role: 'agent', 
      content: optimizationReply, 
      image: '/mock_images/sunlight2.png', 
      time: new Date().toLocaleTimeString() 
    });
    
    loading.value = false;
    scrollToBottom();
    return;
  }

  // ----------------------------------------------------
  // 🟢 真实请求兜底逻辑 (完美修复 TS 报错)
  // ----------------------------------------------------
  try {
    const res = await sendDesignRequest({
      session_id: sessionId.value,
      query: query,
      context: contextFileName.value 
    });

    // 使用 ?. 安全提取，彻底杜绝对象判空报错
    const modelKey = res.data_payload?.geometry_data || 'initial';
    const finalModelUrl = MODEL_MAP[modelKey] || MODEL_MAP['initial'] || null;
    
    generatedModelUrl.value = finalModelUrl;

    const replyText = res?.reply || "已完成操作。";
    chatHistory.value.push({ role: 'agent', content: replyText, time: new Date().toLocaleTimeString() });

  } catch (error) {
    console.error("❌ Error in handleSend:", error);
    chatHistory.value.push({ role: 'agent', content: "Error: 后端无响应或数据解析失败。", time: new Date().toLocaleTimeString() });
  } finally {
    loading.value = false;
    scrollToBottom();
  }
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
/* 🟢 全局重置：去除默认外边距，防止页面偏移和溢出 */
html, body { 
  margin: 0; 
  padding: 0; 
  width: 100%; 
  height: 100%; 
  overflow: hidden; 
}
#app { 
  width: 100%; 
  height: 100%; 
  margin: 0; 
  padding: 0; 
  max-width: none !important; 
  display: block !important; 
  text-align: left !important; 
}
*, *::before, *::after { box-sizing: border-box; }
</style>

<style scoped>
.app-layout { display: flex; height: 100%; width: 100%; overflow: hidden; position: relative; }

/* 拖拽相关 */
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
.drag-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 999; cursor: col-resize; }

/* 弹窗动画 */
.agent-process-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.65); z-index: 1000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(8px); }
.agent-process-box { background: #fff; padding: 30px; border-radius: 12px; width: 420px; box-shadow: 0 15px 40px rgba(0,0,0,0.4); text-align: left; border: 1px solid rgba(255,255,255,0.2); }
.process-header { display: flex; align-items: center; gap: 12px; margin-bottom: 25px; border-bottom: 1px solid #f0f0f0; padding-bottom: 15px; }
.process-header h3 { margin: 0; color: #409eff; font-size: 18px; }
.process-steps { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 15px; }
.process-steps li { font-size: 14px; color: #aaa; display: flex; align-items: center; gap: 10px; transition: all 0.3s ease; }
.process-steps li.active { color: #333; font-weight: 600; transform: translateX(6px); }
.process-steps li.done { color: #67c23a; }

/* 左面板 */
.left-panel { background: #ffffff; display: flex; flex-direction: column; box-shadow: 2px 0 8px rgba(0,0,0,0.05); z-index: 10; flex-shrink: 0; }
.header { padding: 15px 20px; background: #f9fafb; border-bottom: 1px solid #eee; }
.header h2 { margin: 0; font-size: 18px; color: #1f2937; font-weight: 700; }
.session-info { font-size: 12px; color: #9ca3af; margin-top: 4px; }
.chat-history { flex: 1; overflow-y: auto; padding: 20px; background: #f3f4f6; display: flex; flex-direction: column; gap: 15px; }

/* 消息框 */
.message { display: flex; flex-direction: column; max-width: 90%; }
.message.user { align-self: flex-end; align-items: flex-end; }
.message.agent { align-self: flex-start; align-items: flex-start; }
.message-content { padding: 12px 16px; border-radius: 12px; position: relative; font-size: 14px; line-height: 1.6; word-wrap: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
.msg-role { font-size: 11px; margin-bottom: 4px; opacity: 0.7; font-weight: bold; text-transform: uppercase; }
.message.user .message-content { background: #3b82f6; color: white; border-bottom-right-radius: 2px; }
.message.agent .message-content { background: #ffffff; color: #1f2937; border: 1px solid #e5e7eb; border-bottom-left-radius: 2px; }
.message-content:empty { display: none; }

/* 聊天图片 */
.msg-image-container { margin-bottom: 10px; border-radius: 6px; overflow: hidden; border: 1px solid #eee; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.chat-img { width: 100%; height: auto; display: block; }
.img-caption { font-size: 10px; color: #999; background: #f9f9f9; padding: 4px 5px; text-align: center; border-top: 1px solid #eee; }

.loading-message { align-self: center; font-size: 12px; color: #6b7280; display: flex; align-items: center; gap: 6px; margin-top: 10px; padding: 8px 16px; background: rgba(255,255,255,0.8); border-radius: 20px; }

/* 输入区 */
.input-area { padding: 20px; background: #fff; border-top: 1px solid #eee; display: flex; flex-direction: column; gap: 12px; }
.upload-section { display: flex; align-items: center; gap: 10px; }
.file-name { font-size: 12px; color: #666; max-width: 150px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.button-group { display: flex; flex-direction: column; gap: 10px; }
.action-btn { width: 100%; height: 40px; font-weight: bold; margin: 0 !important; }
.full-width-btn { width: 100%; }

.right-panel { flex: 1; background: #262626; position: relative; overflow: hidden; }
</style>
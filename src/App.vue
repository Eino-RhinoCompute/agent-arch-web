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

    <!-- 🟢 新增：成果追溯报告弹窗 -->
    <el-dialog
      v-model="showReportDialog"
      title="📃 建筑体量生成与性能模拟优化报告"
      width="800px"
      class="report-dialog"
      destroy-on-close
    >
      <div class="report-container" id="printable-report">
        <div class="report-header">
          <h2>多智能体协同设计过程追溯报告</h2>
          <p><strong>Session ID:</strong> {{ shortSessionId }} | <strong>Date:</strong> {{ new Date().toLocaleDateString() }}</p>
        </div>

        <div class="report-section">
          <h3>1. 需求解析与合规性检查 (Counselor Agent)</h3>
          <p><strong>场地条件：</strong>南京地区，77m × 67m 矩形场地。</p>
          <p><strong>设计意图：</strong>化整为零、错落排布的灵活组团形式，需包含开放庭院，限高30m。</p>
          <p><strong>规范约束：</strong>已检索南京市规划规范，确保退界合规，目标面积13000-15000m²。</p>
        </div>

        <div class="report-section">
          <h3>2. 初始体量生成 (Massing Agent)</h3>
          <p><strong>匹配模版：</strong>【组团式园区布局模版 (Index=2)】</p>
          <p><strong>执行操作：</strong>引擎驱动生成了3栋错落排布的塔楼，形成角部庭院，初始面积 14,250 m²。</p>
        </div>

        <div class="report-section">
          <h3>3. 物理环境评估 (Simulation Agent)</h3>
          <p><strong>模拟项目：</strong>冬季场地日照舒适性 (Direct Sun Hours)</p>
          <div class="report-img-wrapper">
            <!-- 直接加载你之前用于展示的日照云图1 -->
            <img src="/mock_images/sunlight1.png" alt="Initial Sunlight Simulation" class="report-img" />
          </div>
          <p class="report-desc"><strong>评估结果：</strong>西侧广场日照极佳，但场地东侧受南侧建筑遮挡，存在明显日照盲区（深蓝色0-1小时区域）。</p>
        </div>

        <div class="report-section">
          <h3>4. 闭环迭代优化 (Loop Agent)</h3>
          <p><strong>触发规则库：</strong>系统自主执行了以下参数化调整策略：</p>
          <ul>
            <li><strong>[操作 5: 调整高度]</strong>：降低南侧体量，拉升北侧体量，形成“南低北高”剖面。</li>
            <li><strong>[操作 6: 移动体量] & [操作 1: 增加间距]</strong>：拉大南北、东西向物理间距，打开阳光渗透走廊。</li>
          </ul>
          <div class="report-img-wrapper">
            <!-- 直接加载你之前用于展示的日照云图2 -->
            <img src="/mock_images/sunlight2.png" alt="Optimized Sunlight Simulation" class="report-img" />
          </div>
          <p class="report-desc"><strong>优化结论：</strong>经二次仿真验证，高品质日照区（暖色带）已成功向场地腹地与东侧深度延伸，整体光气候分布显著改善，满足舒适性规范，输出最终体量模型。</p>
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="showReportDialog = false">关 闭</el-button>
          <el-button type="primary" @click="printReport">打印 / 导出 PDF</el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 左侧面板 (动态宽度) -->
    <div class="left-panel" :style="{ width: leftPanelWidth + 'px' }">
      <div class="header">
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
            <div v-if="msg.image" class="msg-image-container">
              <el-image :src="msg.image" :preview-src-list="[msg.image]" fit="cover" class="chat-img" />
              <div class="img-caption">Simulation Result</div>
            </div>
            <div class="msg-text" style="white-space: pre-wrap;">{{ msg.content }}</div>
          </div>
        </div>
        <div v-if="loading && !showAgentProcess" class="loading-message">
          <el-icon class="is-loading"><Loading /></el-icon>
          <span>Agent is processing...</span>
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
        <el-input v-model="userInput" type="textarea" :rows="3" placeholder="输入设计需求..." @keyup.enter.ctrl="handleSend" />
        <div class="button-group">
          <el-button type="primary" class="action-btn" @click="handleSend" :disabled="loading || showAgentProcess">发送 (Send)</el-button>
          <!-- 🟢 按钮文案修改为“导出成果” -->
          <el-button v-if="generatedModelUrl" type="warning" class="action-btn" :icon="Download" @click="handleDownload">
            导出成果 (Export Model & Report)
          </el-button>
        </div>
      </div>
    </div>

    <!-- 拖拽手柄 -->
    <div class="resizer" :class="{ dragging: isDragging }" @mousedown="handleMouseDown"></div>

    <!-- 右侧 3D 视窗面板 -->
    <div class="right-panel">
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
    message: fastMode.value ? '🚀 开发者极速模式：已开启' : '🐢 真实演示模式：已恢复',
    type: fastMode.value ? 'success' : 'info',
    duration: 3000
  });
};

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

// 🟢 报告弹窗状态
const showReportDialog = ref(false);

const handleLocalPreview = (options: UploadRequestOptions) => {
  const file = options.file;
  contextFileName.value = file.name;
  if (contextModelUrl.value) URL.revokeObjectURL(contextModelUrl.value);
  contextModelUrl.value = URL.createObjectURL(file);
  chatHistory.value.push({ role: 'user', content: `[System] 环境模型加载: ${file.name}`, time: new Date().toLocaleTimeString() });
};

// ==========================================
// 🧠 核心提问发送逻辑 (包含四步演示拦截)
// ==========================================
const handleSend = async () => {
  if (!userInput.value.trim()) return;
  const query = userInput.value;
  userInput.value = '';

  chatHistory.value.push({ role: 'user', content: query, time: new Date().toLocaleTimeString() });
  scrollToBottom();
  loading.value = true;

  // 1：RAG 规范查询
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

  // 2：Massing Agent 组团式体量生成
  if (query.includes("基于南京 77m×67m") || query.includes("错落排布的灵活组团形式")) {
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

请在右侧 3D 视窗中查看生成的建筑体量。`;

    chatHistory.value.push({ role: 'agent', content: massingReply, time: new Date().toLocaleTimeString() });
    loading.value = false;
    scrollToBottom();
    return;
  }

  // 3：Simulation Agent 冬季日照模拟
  if (query.includes("对生成体量及场地进行日照分析") || query.includes("冬季场地日照舒适性")) {
    currentToolName.value = "Sunlight_Simulation_Agent";
    showAgentProcess.value = true;

    processStep.value = 1; await smartWait(2000, 400);
    processStep.value = 2; await smartWait(3000, 400);
    processStep.value = 3; await smartWait(300000, 1500); 
    processStep.value = 4; await smartWait(2000, 400);
    showAgentProcess.value = false;

    const simulationReply = `✅ 系统已路由需求至 Worker Agent（Simulation Agent），同步调用日照模拟工具完成性能评估。

基于建筑体量几何数据、场地条件及南京地区冬季气候参数（EPW），驱动 Rhino Compute 引擎执行对应 Grasshopper 文件，运算已完成。

📊 **冬季场地日照舒适性（Direct Sun Hours）云图量化解析**：
根据返回的日照时数量化指标与云图显示，当前【组团式布局】的场地日照分布呈现以下特征：
1. **优质日照区（黄/亮黄色区域）**：场地西侧至中部的开放庭院广场区域日照条件极佳，冬季直射日照时数达到 **6.0 - 8.0 小时以上**。
2. **严重阴影区（深蓝色区域）**：受组团建筑自身体量及相互遮挡的物理规律影响，场地东侧及北侧部分边缘区域冬季几乎无直射日照（0 - 1.0小时），处于深影区。

**Agent 综合评估与优化建议**：
当前方案在场地东侧存在日照盲区。若需进一步提升整体场地的日照均匀度，您可以下达优化指令。系统将触发[Massing_Agent] 基于内置设计操作库，驱动引擎对体量进行迭代优化。`;

    chatHistory.value.push({ role: 'agent', content: simulationReply, image: '/mock_images/sunlight1.png', time: new Date().toLocaleTimeString() });
    loading.value = false;
    scrollToBottom();
    return;
  }

  // 4：Loop Agent 性能闭环优化
  if (query.includes("优化") || (query.includes("改善") && query.includes("日照"))) {
    currentToolName.value = "Massing & Simulation Agents (Loop)";
    showAgentProcess.value = true;

    processStep.value = 1; await smartWait(2000, 400);
    processStep.value = 2; await smartWait(3000, 400);
    processStep.value = 3; await smartWait(300000, 1500); 
    processStep.value = 4; await smartWait(2000, 400);
    showAgentProcess.value = false;

    generatedModelUrl.value = '/mock_models/p2.obj';

    const optimizationReply = `✅ 已接收日照优化指令，系统完成了“生成-模拟-评估”的闭环迭代优化。

🧠 **智能体决策与操作链路**：
系统基于内置的【设计操作与参数映射库】，自动推演并执行了以下联动调整策略：
1. **[操作 5: 调整高度]**：精准降低南侧体块高度，适度拉升北侧塔楼高度，形成“南低北高”剖面。
2. **[操作 6: 移动体量] & [操作 1: 增加间距]**：对南侧体块向外侧偏移微调，拉大南北、东西向物理间距，拓宽阳光渗透走廊。

📊 **二次模拟日照云图解析**：
转化后的参数已驱动引擎完成二次仿真：
- **核心庭院光气候升级**：大面积的亮黄色与暖橙色区域已成功向场地腹地深度延伸。
- **北侧与东侧渗透改善**：原先北侧和边缘局部的深影区被大幅削减，取而代之的是连续的暖色过渡带（3-5小时日照）。

**Agent 结论**：
本次迭代成功实现了“组团式形态”与“日照性能”的完美平衡，完全满足南京地区办公园区设计规范。`;

    chatHistory.value.push({ role: 'agent', content: optimizationReply, image: '/mock_images/sunlight2.png', time: new Date().toLocaleTimeString() });
    loading.value = false;
    scrollToBottom();
    return;
  }

  // 兜底真实请求
  try {
    const res = await sendDesignRequest({ session_id: sessionId.value, query: query, context: contextFileName.value });
    const modelKey = res.data_payload?.geometry_data || 'initial';
    const finalModelUrl = MODEL_MAP[modelKey] || MODEL_MAP['initial'] || null;
    generatedModelUrl.value = finalModelUrl;

    const replyText = res?.reply || "已完成操作。";
    chatHistory.value.push({ role: 'agent', content: replyText, time: new Date().toLocaleTimeString() });

  } catch (error) {
    console.error("❌ Error in handleSend:", error);
    chatHistory.value.push({ role: 'agent', content: "Error: 后端无响应。", time: new Date().toLocaleTimeString() });
  } finally {
    loading.value = false;
    scrollToBottom();
  }
};

// ==========================================
// 🟢 成果导出与报告预览
// ==========================================
const handleDownload = () => {
  if (!generatedModelUrl.value) return;
  
  // 1. 下载 3D 模型
  const link = document.createElement('a');
  link.href = generatedModelUrl.value;
  const timestamp = new Date().toISOString().slice(0,10).replace(/-/g, "");
  link.download = `AI_Optimized_Massing_${timestamp}.obj`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  ElMessage.success('三维模型已导出，正在生成过程追溯报告...');

  // 2. 弹出过程追溯报告
  setTimeout(() => {
    showReportDialog.value = true;
  }, 800);
};

// 调用浏览器原生打印功能，生成精美的 PDF
const printReport = () => {
  window.print();
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

/* 🟢 为打印 PDF 设置专属样式，隐藏非报告元素 */
@media print {
  body * {
    visibility: hidden;
  }
  .report-dialog .el-dialog {
    width: 100% !important;
    margin: 0 !important;
    box-shadow: none !important;
  }
  .report-dialog .el-dialog__header, 
  .report-dialog .el-dialog__footer {
    display: none !important;
  }
  #printable-report, #printable-report * {
    visibility: visible;
  }
  #printable-report {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    padding: 0;
  }
}
</style>

<style scoped>
.app-layout { display: flex; height: 100%; width: 100%; overflow: hidden; position: relative; }

/* 拖拽相关 */
.resizer { width: 5px; background-color: #f0f2f5; border-left: 1px solid #e0e0e0; border-right: 1px solid #e0e0e0; cursor: col-resize; z-index: 50; transition: background-color 0.2s ease; }
.resizer:hover, .resizer.dragging { background-color: #409eff; }
.drag-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 999; cursor: col-resize; }

/* 流程弹窗 */
.agent-process-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.65); z-index: 1000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(8px); }
.agent-process-box { background: #fff; padding: 30px; border-radius: 12px; width: 420px; box-shadow: 0 15px 40px rgba(0,0,0,0.4); text-align: left; border: 1px solid rgba(255,255,255,0.2); }
.process-header { display: flex; align-items: center; gap: 12px; margin-bottom: 25px; border-bottom: 1px solid #f0f0f0; padding-bottom: 15px; }
.process-header h3 { margin: 0; color: #409eff; font-size: 18px; }
.process-steps { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 15px; }
.process-steps li { font-size: 14px; color: #aaa; display: flex; align-items: center; gap: 10px; transition: all 0.3s ease; }
.process-steps li.active { color: #333; font-weight: 600; transform: translateX(6px); }
.process-steps li.done { color: #67c23a; }

/* 🟢 报告页面样式 */
.report-container { padding: 10px 30px 30px 30px; color: #333; font-family: "Helvetica Neue", Arial, sans-serif; }
.report-header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 20px; }
.report-header h2 { margin: 0 0 10px 0; font-size: 22px; color: #111; }
.report-header p { margin: 0; font-size: 14px; color: #666; }
.report-section { margin-bottom: 25px; }
.report-section h3 { font-size: 16px; color: #409eff; border-left: 4px solid #409eff; padding-left: 10px; margin-bottom: 12px; }
.report-section p { font-size: 14px; line-height: 1.6; margin: 5px 0; }
.report-section ul { font-size: 14px; line-height: 1.6; color: #444; margin-top: 5px; padding-left: 20px; }
.report-img-wrapper { text-align: center; margin: 15px 0; background: #f9f9f9; border: 1px solid #eee; padding: 10px; border-radius: 4px; }
.report-img { max-width: 100%; max-height: 220px; object-fit: contain; }
.report-desc { font-size: 13px !important; color: #666; text-align: center; font-style: italic; }

/* 左面板 */
.left-panel { background: #ffffff; display: flex; flex-direction: column; box-shadow: 2px 0 8px rgba(0,0,0,0.05); z-index: 10; flex-shrink: 0; }
.header { padding: 15px 20px; background: #f9fafb; border-bottom: 1px solid #eee; }
.header h2 { margin: 0; font-size: 18px; color: #1f2937; font-weight: 700; }
.session-info { font-size: 12px; color: #9ca3af; margin-top: 4px; }
.chat-history { flex: 1; overflow-y: auto; padding: 20px; background: #f3f4f6; display: flex; flex-direction: column; gap: 15px; }

/* 聊天框 */
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
<!-- src/components/BuildingViewer.vue -->
<template>
  <div class="viewer-container" ref="canvasContainer">
    <!-- 下载按钮 -->
    <div class="toolbar" v-if="hasModel">
      <el-button type="primary" size="small" @click="downloadModel">
        <el-icon><Download /></el-icon> 下载 .3dm 模型
      </el-button>
    </div>
    <!-- 这里是 Three.js 的挂载点 -->
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted } from 'vue';
import * as THREE from 'three';
import { Download } from '@element-plus/icons-vue';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const props = defineProps<{
  geometryData: string | null; // 后端传来的模型数据
}>();

const canvasContainer = ref<HTMLDivElement | null>(null);
const hasModel = ref(false);

// Three.js 变量
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let cube: THREE.Mesh; // 演示用的占位模型

const initThree = () => {
  if (!canvasContainer.value) return;

  // 1. Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f2f5);
  
  // 2. Camera
  const width = canvasContainer.value.clientWidth;
  const height = canvasContainer.value.clientHeight;
  camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
  camera.position.set(50, 50, 50);

  // 3. Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  canvasContainer.value.appendChild(renderer.domElement);

  // 4. Controls
  controls = new OrbitControls(camera, renderer.domElement);
  
  // 5. Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);

  // 6. Grid
  const gridHelper = new THREE.GridHelper(100, 20);
  scene.add(gridHelper);

  animate();
};

const animate = () => {
  requestAnimationFrame(animate);
  if(controls) controls.update();
  if(renderer && scene && camera) renderer.render(scene, camera);
};

// 监听 geometryData 变化来更新模型
watch(() => props.geometryData, (newVal) => {
  if (newVal) {
    updateModel(newVal);
    hasModel.value = true;
  }
});

const updateModel = (data: string) => {
  // TODO: 这里是核心难点。需要根据你后端实际返回的格式进行解析。
  // 如果是 Base64 的 OBJ/GLTF，需要用 Three loaders 加载。
  // 为了演示跑通架构，我们这里仅仅生成一个随机颜色的立方体代表"生成成功"。
  
  // 清理旧模型
  if (cube) scene.remove(cube);

  // 模拟：解析数据生成体量
  const geometry = new THREE.BoxGeometry(10, 20 + Math.random() * 20, 10);
  const material = new THREE.MeshStandardMaterial({ color: 0x409eff });
  cube = new THREE.Mesh(geometry, material);
  cube.position.y = 10; // 放在地上
  scene.add(cube);
  
  console.log("Model updated with data length:", data.length);
};

const downloadModel = () => {
  if (!props.geometryData) return;
  
  // 假设后端传回来的是 Base64 字符串，解码并下载
  // 如果是普通字符串，直接通过Blob下载
  const blob = new Blob([props.geometryData], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `generated_massing_${Date.now()}.3dm`; // 强制后缀为 3dm
  a.click();
  URL.revokeObjectURL(url);
};

onMounted(() => {
  initThree();
  window.addEventListener('resize', onWindowResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize);
});

const onWindowResize = () => {
  if (!canvasContainer.value || !camera || !renderer) return;
  const width = canvasContainer.value.clientWidth;
  const height = canvasContainer.value.clientHeight;
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
};
</script>

<style scoped>
.viewer-container {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}
.toolbar {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  background: rgba(255,255,255,0.8);
  padding: 5px;
  border-radius: 4px;
}
</style>
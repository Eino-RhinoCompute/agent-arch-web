<!-- src/components/BuildingViewer.vue -->
<template>
  <div class="viewer-container" ref="canvasContainer">
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
      <div class="loading-text">Loading... {{ loadProgress }}%</div>
    </div>
    <div class="legend">
      <div class="item"><span class="color-box context"></span> Context (White)</div>
      <div class="item"><span class="color-box generated"></span> Design (Blue)</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted } from 'vue';
import * as THREE from 'three';
// @ts-ignore
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
// @ts-ignore
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const props = defineProps<{
  contextFileUrl: string | null;
  generatedModelUrl: string | null; // 🟢 改名：接收静态文件路径
}>();

const canvasContainer = ref<HTMLDivElement | null>(null);
const isLoading = ref(false);
const loadProgress = ref(0);

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let contextGroup: THREE.Group;
let generatedGroup: THREE.Group;

// 全局对齐参数 (以 Context 为基准)
const globalTransform = {
  scale: 1,
  offset: new THREE.Vector3(0, 0, 0),
  isSet: false
};

const initThree = () => {
  if (!canvasContainer.value) return;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x262626); 
  
  contextGroup = new THREE.Group();
  generatedGroup = new THREE.Group();
  scene.add(contextGroup);
  scene.add(generatedGroup);
  
  const width = canvasContainer.value.clientWidth;
  const height = canvasContainer.value.clientHeight;
  camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000000);
  camera.position.set(2000, 2000, 2000);

  renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
  renderer.setSize(width, height);
  canvasContainer.value.appendChild(renderer.domElement);
  
  controls = new OrbitControls(camera, renderer.domElement);
  
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(1000, 2000, 1000);
  scene.add(dirLight);
  const gridHelper = new THREE.GridHelper(5000, 50, 0x666666, 0x444444);
  gridHelper.position.y = -0.1;
  scene.add(gridHelper);

  animate();
};

const animate = () => {
  requestAnimationFrame(animate);
  if(controls) controls.update();
  if(renderer && scene && camera) renderer.render(scene, camera);
};

// --- 监听 URL 变化 ---
watch(() => props.contextFileUrl, (newUrl) => {
  if (newUrl) loadContextModel(newUrl);
});

// 🟢 监听生成的模型路径 (如 /mock_models/01.obj)
watch(() => props.generatedModelUrl, (newUrl) => {
  if (newUrl) loadGeneratedModel(newUrl);
});

// 1. 加载环境模型 (白色)
const loadContextModel = (url: string) => {
  isLoading.value = true;
  contextGroup.clear();
  const loader = new OBJLoader();
  loader.load(url, (object: THREE.Object3D) => {
      // 🎨 Context 材质: 白色，哑光
      const contextMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff, 
        emissive: 0x222222, 
        roughness: 0.9, 
        side: THREE.DoubleSide
      });
      object.traverse((child: any) => { if (child.isMesh) child.material = contextMaterial; });

      // 计算基准变换
      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3(); box.getSize(size);
      const center = new THREE.Vector3(); box.getCenter(center);
      const maxDim = Math.max(size.x, size.y, size.z);
      
      globalTransform.scale = maxDim > 0 ? 2500 / maxDim : 1;
      globalTransform.offset.set(-center.x, -box.min.y, -center.z);
      globalTransform.isSet = true;

      // 应用变换
      object.scale.set(globalTransform.scale, globalTransform.scale, globalTransform.scale);
      object.position.set(
        globalTransform.offset.x * globalTransform.scale,
        globalTransform.offset.y * globalTransform.scale,
        globalTransform.offset.z * globalTransform.scale
      );
      
      contextGroup.add(object);
      
      const scaledSize = size.multiplyScalar(globalTransform.scale);
      fitCameraToBox(scaledSize);
      isLoading.value = false;
    }, undefined, (e) => { console.error(e); isLoading.value = false; }
  );
};

// 2. 加载生成模型 (蓝色，从本地静态文件加载)
const loadGeneratedModel = (url: string) => {
  console.log("🚀 Loading generated model from static file:", url);
  // 清理旧的方案
  generatedGroup.clear();
  
  const loader = new OBJLoader();
  loader.load(url, (object: THREE.Object3D) => {
    // 🎨 Generated 材质: 蓝色，高亮，半透明
    const genMaterial = new THREE.MeshStandardMaterial({
      color: 0x409eff,
      emissive: 0x001133, // 自发光蓝
      roughness: 0.2,
      metalness: 0.5,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    });

    object.traverse((child: any) => {
      if (child.isMesh) {
        child.material = genMaterial;
        child.geometry.computeVertexNormals();
      }
    });

    // 🟢 坐标强制对齐逻辑
    if (globalTransform.isSet) {
      object.scale.set(globalTransform.scale, globalTransform.scale, globalTransform.scale);
      object.position.set(
        globalTransform.offset.x * globalTransform.scale,
        globalTransform.offset.y * globalTransform.scale,
        globalTransform.offset.z * globalTransform.scale
      );
    } else {
      // 兜底: 如果没加载环境，就居中显示
      const box = new THREE.Box3().setFromObject(object);
      const center = new THREE.Vector3(); box.getCenter(center);
      const size = new THREE.Vector3(); box.getSize(size);
      const scale = 2500 / Math.max(size.x, size.y, size.z);
      object.scale.set(scale, scale, scale);
      object.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
      fitCameraToBox(size.multiplyScalar(scale));
    }

    generatedGroup.add(object);
    console.log("✅ Generated model loaded and synced.");
  }, undefined, (e) => console.error("Failed to load generated model:", e));
};

const fitCameraToBox = (size: THREE.Vector3) => {
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim === 0) return;
  const fov = camera.fov * (Math.PI / 180);
  let cameraDist = (maxDim / 2) / Math.tan(fov / 2);
  cameraDist *= 2.0; 
  camera.position.set(cameraDist, cameraDist * 0.8, cameraDist);
  camera.lookAt(0, size.y / 2, 0);
  if (controls) {
    controls.target.set(0, size.y / 2, 0);
    controls.update();
  }
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
.viewer-container { width: 100%; height: 100%; position: relative; background: #262626; overflow: hidden; }
.loading-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 100; color: #fff; }
.spinner { width: 40px; height: 40px; border: 3px solid #555; border-top: 3px solid #fff; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 15px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.legend { position: absolute; bottom: 20px; right: 20px; background: rgba(0,0,0,0.6); padding: 10px 15px; border-radius: 6px; pointer-events: none; color: #fff; }
.item { display: flex; align-items: center; margin-bottom: 5px; font-size: 13px; }
.color-box { width: 14px; height: 14px; margin-right: 8px; }
.color-box.context { background: #fff; }
.color-box.generated { background: #409eff; }
</style>
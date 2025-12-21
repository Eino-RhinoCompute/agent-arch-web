<!-- src/components/BuildingViewer.vue -->
<template>
  <div class="viewer-container" ref="canvasContainer">
    <div v-if="isLoading" class="loading-overlay">
      <div class="spinner"></div>
      <div class="loading-text">Loading Model... {{ loadProgress }}%</div>
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
  generatedData: string | null;
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

// 记录当前环境模型的缩放比例，以便生成的模型与其保持一致
let currentScale = 1;

const initThree = () => {
  if (!canvasContainer.value) return;

  // 1. 场景设置
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x262626); 

  contextGroup = new THREE.Group();
  generatedGroup = new THREE.Group();
  scene.add(contextGroup);
  scene.add(generatedGroup);

  const width = canvasContainer.value.clientWidth;
  const height = canvasContainer.value.clientHeight;
  
  // 2. 相机设置
  camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000000);
  camera.position.set(2000, 2000, 2000);

  // 3. 渲染器 (开启对数深度缓冲区)
  renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    logarithmicDepthBuffer: true 
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  canvasContainer.value.appendChild(renderer.domElement);

  // 4. 控制器
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // 5. 灯光增强：建筑模型建议使用组合光照
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.8);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(1000, 2000, 1000);
  scene.add(dirLight);

  // 6. 辅助网格：5000大小，网格间距100
  const gridHelper = new THREE.GridHelper(5000, 50, 0x666666, 0x444444);
  gridHelper.position.y = -0.1; // 稍微下移，防止与模型底面闪烁
  scene.add(gridHelper);

  animate();
};

const animate = () => {
  requestAnimationFrame(animate);
  if(controls) controls.update();
  if(renderer && scene && camera) renderer.render(scene, camera);
};

// --- 加载逻辑 ---

watch(() => props.contextFileUrl, (newUrl) => {
  if (newUrl) loadContextModel(newUrl);
});

watch(() => props.generatedData, (newData) => {
  if (newData) parseGeneratedModel(newData);
});

const loadContextModel = (url: string) => {
  isLoading.value = true;
  loadProgress.value = 0;
  contextGroup.clear();

  const loader = new OBJLoader();
  loader.load(
    url,
    (object: THREE.Object3D) => {
      const contextMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x222222, // 微弱自发光，增强细节
        roughness: 0.8,
        metalness: 0.2,
        side: THREE.DoubleSide
      });

      object.traverse((child: any) => {
        if (child.isMesh) {
          child.material = contextMaterial;
          if (child.geometry) {
            child.geometry.computeVertexNormals();
          }
        }
      });

      // --- 计算包围盒逻辑 ---
      const box = new THREE.Box3().setFromObject(object);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // --- 自动缩放逻辑 ---
      // 目标是让模型最大的一边约为 2500 单位（网格的一半左右）
      const maxDim = Math.max(size.x, size.y, size.z);
      currentScale = maxDim > 0 ? 2500 / maxDim : 1;
      object.scale.set(currentScale, currentScale, currentScale);

      // --- 底部对齐逻辑 ---
      // X, Z 轴归零中心，Y 轴将其最低点对准 0
      object.position.x = -center.x * currentScale;
      object.position.y = -box.min.y * currentScale; 
      object.position.z = -center.z * currentScale;
      
      contextGroup.add(object);
      
      // 更新相机视角
      const scaledSize = size.multiplyScalar(currentScale);
      fitCameraToBox(scaledSize);
      
      isLoading.value = false;
    },
    (xhr: ProgressEvent) => {
      if (xhr.lengthComputable) {
        loadProgress.value = Math.round((xhr.loaded / xhr.total) * 100);
      }
    },
    (error: any) => {
      console.error('Error:', error);
      isLoading.value = false;
    }
  );
};

const parseGeneratedModel = (dataString: string) => {
  generatedGroup.clear();
  try {
    const loader = new OBJLoader();
    const object = loader.parse(dataString);

    const genMaterial = new THREE.MeshStandardMaterial({
      color: 0x409eff,
      emissive: 0x001122,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });

    object.traverse((child: any) => {
      if (child.isMesh) {
        child.material = genMaterial;
        child.geometry.computeVertexNormals();
      }
    });

    // 保持与环境模型一致的缩放
    object.scale.set(currentScale, currentScale, currentScale);

    // 计算生成模型的底部对齐
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    
    object.position.x = -center.x * currentScale;
    object.position.y = -box.min.y * currentScale;
    object.position.z = -center.z * currentScale;

    generatedGroup.add(object);
  } catch (e) {
    console.error("Parse error", e);
  }
};

const fitCameraToBox = (size: THREE.Vector3) => {
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim === 0) return;

  // 正确的相机距离算法
  const fov = camera.fov * (Math.PI / 180);
  let cameraDist = (maxDim / 2) / Math.tan(fov / 2);
  
  cameraDist *= 2.0; // 留出视野空白

  // 设置相机位置从 45 度角俯瞰
  camera.position.set(cameraDist, cameraDist * 0.8, cameraDist);
  
  // 旋转中心点设为模型高度的中心
  const targetY = size.y / 2;
  camera.lookAt(0, targetY, 0);
  
  if (controls) {
    controls.target.set(0, targetY, 0);
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

.loading-overlay { 
  position: absolute; top: 0; left: 0; right: 0; bottom: 0; 
  background: rgba(0,0,0,0.7); 
  display: flex; flex-direction: column; align-items: center; justify-content: center; 
  z-index: 100; color: #fff;
}
.spinner { width: 40px; height: 40px; border: 3px solid #555; border-top: 3px solid #fff; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 15px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

.legend { 
  position: absolute; bottom: 20px; right: 20px; 
  background: rgba(0,0,0,0.6); 
  padding: 10px 15px; border-radius: 6px; 
  pointer-events: none; color: #fff;
}
.item { display: flex; align-items: center; margin-bottom: 5px; font-size: 13px; }
.color-box { width: 14px; height: 14px; margin-right: 8px; }
.color-box.context { background: #fff; }
.color-box.generated { background: #409eff; }
</style>
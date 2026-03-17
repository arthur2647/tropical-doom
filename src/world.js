import * as THREE from 'three';

export const REGIONS = [
  { name: 'The Resort', center: [0, 0], radius: 30, color: '#cc8844' },
  { name: 'Sunset Beach', center: [0, -40], radius: 25, color: '#ccbb66' },
  { name: 'The Village', center: [60, 20], radius: 30, color: '#88aa44' },
  { name: 'Deep Jungle', center: [-50, 50], radius: 35, color: '#336622' },
  { name: 'The Temple Ruins', center: [-60, -60], radius: 25, color: '#666677' },
  { name: 'Fisherman\'s Cove', center: [85, -65], radius: 22, color: '#4488aa' },
  { name: 'The Cliff Path', center: [-80, 0], radius: 20, color: '#887766' },
  { name: 'Mangrove Swamp', center: [40, 70], radius: 25, color: '#445533' },
];

// --- Cached terrain height grid ---
const GRID_RES = 300; // grid cells
const GRID_SIZE = 300; // world units
const HALF_GRID = GRID_SIZE / 2;
let heightGrid = null;

export function getTerrainHeightFast(x, z) {
  if (!heightGrid) return 0;
  const gx = Math.floor((x + HALF_GRID) / GRID_SIZE * GRID_RES);
  const gz = Math.floor((z + HALF_GRID) / GRID_SIZE * GRID_RES);
  if (gx < 0 || gx >= GRID_RES || gz < 0 || gz >= GRID_RES) return 0;
  return heightGrid[gz * GRID_RES + gx];
}

// --- Noise functions ---
function noise2d(x, y) {
  const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x, y, scale) {
  const sx = x / scale, sy = y / scale;
  const ix = Math.floor(sx), iy = Math.floor(sy);
  const fx = sx - ix, fy = sy - iy;
  const a = noise2d(ix, iy), b = noise2d(ix+1, iy);
  const c = noise2d(ix, iy+1), d = noise2d(ix+1, iy+1);
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return a*(1-u)*(1-v) + b*u*(1-v) + c*(1-u)*v + d*u*v;
}

function fbm(x, y, octaves = 4) {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * smoothNoise(x * freq, y * freq, 1);
    amp *= 0.5; freq *= 2;
  }
  return val;
}

function terrainHeight(x, z) {
  let h = 0;
  h += fbm(x * 0.015, z * 0.015) * 8;
  h += fbm(x * 0.04, z * 0.04) * 3;
  const distFromCenter = Math.sqrt(x * x + z * z);
  const edgeFade = Math.max(0, 1 - distFromCenter / 140);
  h *= edgeFade;
  if (distFromCenter > 110) {
    const beachFade = Math.max(0, (distFromCenter - 110) / 30);
    h = h * (1 - beachFade) + (-0.5) * beachFade;
  }
  const resortDist = Math.sqrt(x * x + z * z);
  if (resortDist < 20) {
    const flat = 1 - resortDist / 20;
    h = h * (1 - flat * 0.7);
  }
  const templeDist = Math.sqrt((x + 60) * (x + 60) + (z + 60) * (z + 60));
  if (templeDist < 20) h += (1 - templeDist / 20) * 5;
  const jungleDist = Math.sqrt((x + 50) * (x + 50) + (z - 50) * (z - 50));
  if (jungleDist < 30) h += (1 - jungleDist / 30) * 4;
  return h;
}

// Build height cache
function buildHeightGrid() {
  heightGrid = new Float32Array(GRID_RES * GRID_RES);
  for (let gz = 0; gz < GRID_RES; gz++) {
    for (let gx = 0; gx < GRID_RES; gx++) {
      const x = (gx / GRID_RES) * GRID_SIZE - HALF_GRID;
      const z = (gz / GRID_RES) * GRID_SIZE - HALF_GRID;
      heightGrid[gz * GRID_RES + gx] = terrainHeight(x, z);
    }
  }
}

// --- Procedural texture generation ---
const TEX_CACHE = {};
function makeNoiseTex(baseR, baseG, baseB, noiseAmt = 30, size = 64) {
  const key = `${baseR}_${baseG}_${baseB}_${noiseAmt}_${size}`;
  if (TEX_CACHE[key]) return TEX_CACHE[key];
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * noiseAmt;
    img.data[i] = Math.max(0, Math.min(255, baseR + n));
    img.data[i+1] = Math.max(0, Math.min(255, baseG + n * 0.7));
    img.data[i+2] = Math.max(0, Math.min(255, baseB + n * 0.5));
    img.data[i+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  TEX_CACHE[key] = tex;
  return tex;
}

// Pre-build common textures
let TEX_WOOD, TEX_STONE, TEX_CONCRETE, TEX_BARK, TEX_THATCH;
function initTextures() {
  TEX_WOOD = makeNoiseTex(110, 80, 45, 25, 64);
  TEX_STONE = makeNoiseTex(100, 100, 95, 20, 64);
  TEX_CONCRETE = makeNoiseTex(160, 155, 145, 15, 64);
  TEX_BARK = makeNoiseTex(90, 60, 30, 35, 64);
  TEX_THATCH = makeNoiseTex(140, 120, 60, 30, 64);
}

// --- Shared materials (reuse!) ---
const MATS = {};
function getMat(color, roughness = 0.8) {
  const key = `${color}_${roughness}`;
  if (!MATS[key]) {
    MATS[key] = new THREE.MeshStandardMaterial({
      color, roughness, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
    });
  }
  return MATS[key];
}

function getTexMat(color, tex, roughness = 0.85) {
  const key = `tex_${color}_${roughness}`;
  if (!MATS[key]) {
    MATS[key] = new THREE.MeshStandardMaterial({
      color, map: tex, roughness, metalness: 0,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
    });
  }
  return MATS[key];
}

export function createWorld(game) {
  const scene = game.scene;
  initTextures();

  // Fog - exponential for natural look
  scene.fog = new THREE.FogExp2(0x88bbdd, 0.012);
  scene.background = new THREE.Color(0.45, 0.72, 1.0);

  // Lights - simplified
  game.ambientLight = new THREE.AmbientLight(0xfff5e0, 0.8);
  scene.add(game.ambientLight);

  game.sunLight = new THREE.DirectionalLight(0xfff0d0, 2.0);
  game.sunLight.position.set(50, 80, 50);
  game.sunLight.castShadow = true;
  game.sunLight.shadow.mapSize.set(1024, 1024);
  game.sunLight.shadow.camera.left = -40;
  game.sunLight.shadow.camera.right = 40;
  game.sunLight.shadow.camera.top = 40;
  game.sunLight.shadow.camera.bottom = -40;
  game.sunLight.shadow.camera.near = 10;
  game.sunLight.shadow.camera.far = 200;
  game.sunLight.shadow.bias = -0.001;
  game.sunLight.shadow.normalBias = 0.02;
  scene.add(game.sunLight);
  scene.add(game.sunLight.target);

  const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x3a5f0b, 0.5);
  scene.add(hemiLight);

  // Terrain - reduced resolution
  const terrainGeo = new THREE.PlaneGeometry(300, 300, 80, 80);
  terrainGeo.rotateX(-Math.PI / 2);
  const verts = terrainGeo.attributes.position;

  for (let i = 0; i < verts.count; i++) {
    const x = verts.getX(i), z = verts.getZ(i);
    verts.setY(i, terrainHeight(x, z));
  }
  terrainGeo.computeVertexNormals();

  // Vertex colors
  const colors = new Float32Array(verts.count * 3);
  for (let i = 0; i < verts.count; i++) {
    const x = verts.getX(i), z = verts.getZ(i), h = verts.getY(i);
    const dist = Math.sqrt(x * x + z * z);
    let r, g, b;
    if (dist > 105) { r = 0.88; g = 0.8; b = 0.58; }
    else if (h > 5) { r = 0.15; g = 0.4; b = 0.1; }
    else { r = 0.25; g = 0.55; b = 0.15; }
    const n = noise2d(x * 0.1, z * 0.1) * 0.08;
    colors[i * 3] = r + n; colors[i * 3 + 1] = g + n * 0.5; colors[i * 3 + 2] = b + n * 0.3;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.9, metalness: 0
  }));
  terrain.receiveShadow = true;
  scene.add(terrain);
  game.terrain = terrain;

  // Build height cache AFTER terrain is created
  buildHeightGrid();

  // Water - animated with vertex displacement, reflective surface
  const waterGeo = new THREE.PlaneGeometry(500, 500, 40, 40);
  const water = new THREE.Mesh(
    waterGeo,
    new THREE.MeshStandardMaterial({
      color: 0x0e6677, transparent: true, opacity: 0.65,
      metalness: 0.3, roughness: 0.2,
      envMapIntensity: 0.5
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.8;
  scene.add(water);
  game.water = water;
  game.waterGeo = waterGeo;

  // Shore foam ring
  const foamGeo = new THREE.RingGeometry(108, 115, 48);
  const foam = new THREE.Mesh(foamGeo, new THREE.MeshBasicMaterial({
    color: 0xeeffff, transparent: true, opacity: 0.25, side: THREE.DoubleSide
  }));
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = -0.3;
  scene.add(foam);
  game.foam = foam;

  // Colliders
  game.colliders = [];
  game.platforms = [];

  // Build structures
  buildResort(game);
  buildVillage(game);
  buildTemple(game);
  buildJungle(game);
  buildBeach(game);
  buildSwamp(game);
  buildCove(game);

  placeDestructibles(game);

  // Scatter nature - REDUCED counts
  scatterPalmTrees(game, 70);
  scatterJungleTrees(game, 35);
  scatterRocks(game, 35);
  scatterBushes(game, 60);

  // Fireflies (visible at dusk/night)
  const fireflyCount = 60;
  const ffGeo = new THREE.BufferGeometry();
  const ffPos = new Float32Array(fireflyCount * 3);
  const ffVel = new Float32Array(fireflyCount * 3);
  for (let i = 0; i < fireflyCount; i++) {
    ffPos[i * 3] = (Math.random() - 0.5) * 200;
    ffPos[i * 3 + 1] = 1 + Math.random() * 3;
    ffPos[i * 3 + 2] = (Math.random() - 0.5) * 200;
    ffVel[i * 3] = (Math.random() - 0.5) * 0.5;
    ffVel[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
    ffVel[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
  }
  ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  const ffMat = new THREE.PointsMaterial({
    size: 0.15, color: 0xccff44, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const fireflies = new THREE.Points(ffGeo, ffMat);
  scene.add(fireflies);
  game.fireflies = { mesh: fireflies, vel: ffVel };

  // Swamp mist
  const mistGeo = new THREE.PlaneGeometry(40, 40);
  const mist = new THREE.Mesh(mistGeo, new THREE.MeshBasicMaterial({
    color: 0x445533, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false
  }));
  mist.rotation.x = -Math.PI / 2;
  mist.position.set(40, getTerrainHeightFast(40, 70) + 0.5, 70);
  scene.add(mist);
  game.swampMist = mist;

  // --- Stars (visible at night) ---
  const starCount = 300;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random()); // upper hemisphere only
    const r = 220;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    starSizes[i] = 0.3 + Math.random() * 0.7;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    size: 0.6, color: 0xffffff, transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false
  });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);
  game.stars = stars;

  // --- Moon ---
  const moonGeo = new THREE.SphereGeometry(4, 16, 12);
  const moonMat = new THREE.MeshBasicMaterial({ color: 0xffffee, transparent: true, opacity: 0 });
  const moon = new THREE.Mesh(moonGeo, moonMat);
  scene.add(moon);
  game.moon = moon;

  // --- Clouds ---
  game.clouds = [];
  for (let i = 0; i < 8; i++) {
    const cloud = new THREE.Group();
    const numPuffs = 3 + Math.floor(Math.random() * 3);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false
    });
    for (let j = 0; j < numPuffs; j++) {
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(3 + Math.random() * 4, 5, 4), cloudMat
      );
      puff.position.set(j * 5 - numPuffs * 2.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 3);
      puff.scale.y = 0.35 + Math.random() * 0.15;
      cloud.add(puff);
    }
    cloud.position.set(
      (Math.random() - 0.5) * 300,
      45 + Math.random() * 15,
      (Math.random() - 0.5) * 300
    );
    cloud.userData.speed = 0.3 + Math.random() * 0.7;
    scene.add(cloud);
    game.clouds.push(cloud);
  }

  // --- Falling leaves (jungle area) ---
  const leafCount = 25;
  const leafGeo = new THREE.BufferGeometry();
  const leafPos = new Float32Array(leafCount * 3);
  const leafVel = new Float32Array(leafCount * 3);
  const leafColors = new Float32Array(leafCount * 3);
  for (let i = 0; i < leafCount; i++) {
    leafPos[i * 3] = -50 + (Math.random() - 0.5) * 60;
    leafPos[i * 3 + 1] = 6 + Math.random() * 10;
    leafPos[i * 3 + 2] = 50 + (Math.random() - 0.5) * 60;
    leafVel[i * 3] = (Math.random() - 0.5) * 0.6;
    leafVel[i * 3 + 1] = -(0.3 + Math.random() * 0.4);
    leafVel[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    // Vary leaf colors: green to yellow-green
    const shade = Math.random();
    leafColors[i * 3] = 0.15 + shade * 0.4;
    leafColors[i * 3 + 1] = 0.5 + shade * 0.3;
    leafColors[i * 3 + 2] = 0.05 + shade * 0.1;
  }
  leafGeo.setAttribute('position', new THREE.BufferAttribute(leafPos, 3));
  leafGeo.setAttribute('color', new THREE.BufferAttribute(leafColors, 3));
  const leafMat = new THREE.PointsMaterial({
    size: 0.3, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false
  });
  const leaves = new THREE.Points(leafGeo, leafMat);
  scene.add(leaves);
  game.fallingLeaves = { mesh: leaves, vel: leafVel };

  // --- Shore splash particles ---
  const splashCount = 40;
  const splashGeo = new THREE.BufferGeometry();
  const splashPos = new Float32Array(splashCount * 3);
  for (let i = 0; i < splashCount; i++) {
    const angle = (i / splashCount) * Math.PI * 2;
    const r = 110 + (Math.random() - 0.5) * 4;
    splashPos[i * 3] = Math.cos(angle) * r;
    splashPos[i * 3 + 1] = 0;
    splashPos[i * 3 + 2] = Math.sin(angle) * r;
  }
  splashGeo.setAttribute('position', new THREE.BufferAttribute(splashPos, 3));
  const splashMat = new THREE.PointsMaterial({
    size: 0.4, color: 0xeeffff, transparent: true, opacity: 0.4,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const splashes = new THREE.Points(splashGeo, splashMat);
  scene.add(splashes);
  game.shoreSplash = splashes;

  // Minimap setup
  buildMinimap(game);
}

// --- Minimap ---
function buildMinimap(game) {
  const size = 160;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  canvas.id = 'minimap';
  canvas.style.cssText = `position:fixed;top:12px;right:12px;z-index:10;border:2px solid rgba(255,136,0,0.4);
    border-radius:50%;opacity:0.85;pointer-events:none;width:${size}px;height:${size}px;background:#1a2a1a`;
  document.body.appendChild(canvas);
  game.minimapCanvas = canvas;
  game.minimapCtx = canvas.getContext('2d');

  // Pre-render the static map
  const mapCanvas = document.createElement('canvas');
  mapCanvas.width = size; mapCanvas.height = size;
  const mctx = mapCanvas.getContext('2d');

  // Draw terrain colors
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const wx = (x / size - 0.5) * 300;
      const wz = (y / size - 0.5) * 300;
      const dist = Math.sqrt(wx * wx + wz * wz);
      const h = getTerrainHeightFast(wx, wz);

      if (dist > 130) {
        mctx.fillStyle = '#1166aa';
      } else if (dist > 105) {
        mctx.fillStyle = '#c8b878';
      } else if (h > 5) {
        mctx.fillStyle = '#1a4a1a';
      } else {
        mctx.fillStyle = '#2a5a2a';
      }
      mctx.fillRect(x, y, 1, 1);
    }
  }

  // Draw region markers
  for (const r of REGIONS) {
    const mx = (r.center[0] / 300 + 0.5) * size;
    const my = (r.center[1] / 300 + 0.5) * size;
    mctx.fillStyle = 'rgba(255,200,100,0.4)';
    mctx.beginPath();
    mctx.arc(mx, my, 4, 0, Math.PI * 2);
    mctx.fill();
  }

  game.minimapStatic = mapCanvas;
}

let envFrameCount = 0;

export function updateEnvironment(game, dt) {
  const t = game.totalTime;
  envFrameCount++;

  // --- Animated water waves (every 2nd frame) ---
  if (game.waterGeo && (envFrameCount % 2 === 0)) {
    const verts = game.waterGeo.attributes.position;
    for (let i = 0; i < verts.count; i++) {
      const x = verts.getX(i);
      const z = verts.getZ(i);
      const y = Math.sin(x * 0.05 + t * 1.2) * 0.3 +
                Math.sin(z * 0.07 + t * 0.8) * 0.2 +
                Math.sin((x + z) * 0.03 + t * 0.5) * 0.15;
      verts.setY(i, y);
    }
    verts.needsUpdate = true;
  }

  // --- Shore foam pulse ---
  if (game.foam) {
    game.foam.material.opacity = 0.15 + Math.sin(t * 1.5) * 0.1;
    game.foam.position.y = -0.3 + Math.sin(t * 0.8) * 0.1;
  }

  // --- Campfire particles ---
  if (game.fireParticles) {
    const fp = game.fireParticles;
    const pos = fp.mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i);
      y += dt * (1.5 + Math.random() * 1.5);
      if (y > fp.gy + 2.0) {
        pos.setX(i, fp.ox + (Math.random() - 0.5) * 0.6);
        y = fp.gy + 0.4;
        pos.setZ(i, fp.oz + (Math.random() - 0.5) * 0.6);
      }
      // Slight horizontal sway
      pos.setX(i, pos.getX(i) + Math.sin(t * 3 + i) * 0.003);
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  }

  // --- Campfire light flicker ---
  if (game.fireLight) {
    game.fireLight.intensity = 1.8 + Math.sin(t * 8) * 0.4 + Math.sin(t * 13) * 0.2;
    game.fireLight.color.setHSL(0.06, 1, 0.5 + Math.sin(t * 5) * 0.05);
  }

  // --- Torch light flicker ---
  if (game.torchLights) {
    for (let i = 0; i < game.torchLights.length; i++) {
      const tl = game.torchLights[i];
      tl.intensity = 0.6 + Math.sin(t * 7 + i * 2.3) * 0.3 + Math.sin(t * 11 + i) * 0.1;
    }
  }

  // --- Fireflies (visible at dusk/night, update every 3rd frame) ---
  if (game.fireflies) {
    const ff = game.fireflies;
    const isNightish = game.isNight || (game.dayTime > 0.65 && game.dayTime < 0.85);
    ff.mesh.material.opacity = isNightish ? 0.6 + Math.sin(t * 2) * 0.2 : 0;

    if (isNightish && (envFrameCount % 3 === 0)) {
      const scaledDt = dt * 3; // compensate for skipped frames
      const pos = ff.mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i) + ff.vel[i * 3] * scaledDt;
        let y = pos.getY(i) + ff.vel[i * 3 + 1] * scaledDt + Math.sin(t * 2 + i) * 0.005;
        let z = pos.getZ(i) + ff.vel[i * 3 + 2] * scaledDt;
        if (y < 0.5) { y = 0.5; ff.vel[i * 3 + 1] = Math.abs(ff.vel[i * 3 + 1]); }
        if (y > 5) { y = 5; ff.vel[i * 3 + 1] = -Math.abs(ff.vel[i * 3 + 1]); }
        if (Math.random() < 0.015) {
          ff.vel[i * 3] = (Math.random() - 0.5) * 0.6;
          ff.vel[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
          ff.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
        }
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
    }
  }

  // --- Swamp mist drift ---
  if (game.swampMist) {
    game.swampMist.material.opacity = 0.1 + Math.sin(t * 0.5) * 0.05;
    game.swampMist.position.x = 40 + Math.sin(t * 0.3) * 2;
    game.swampMist.position.z = 70 + Math.cos(t * 0.2) * 2;
  }

  // --- Stars (fade in at night) ---
  if (game.stars) {
    const nightAmt = game.isNight ? 1 : (game.dayTime > 0.7 ? (game.dayTime - 0.7) / 0.05 : 0);
    game.stars.material.opacity = Math.min(0.9, nightAmt);
    // Twinkle
    game.stars.material.size = 0.5 + Math.sin(t * 3) * 0.1;
    // Rotate slowly with player position for parallax
    game.stars.position.copy(game.camera.position);
  }

  // --- Moon ---
  if (game.moon) {
    const moonAngle = game.dayTime * Math.PI * 2 + Math.PI / 2; // opposite of sun
    game.moon.position.set(
      game.camera.position.x + Math.cos(moonAngle) * 180,
      Math.max(10, Math.sin(moonAngle) * 150),
      game.camera.position.z - 80
    );
    const moonVisible = game.isNight || game.dayTime > 0.7 || game.dayTime < 0.15;
    game.moon.material.opacity = moonVisible ? 0.9 : 0;
  }

  // --- Clouds drift ---
  if (game.clouds) {
    // Update cloud material only when night state changes (they share material)
    if (game._lastCloudNight !== game.isNight && game.clouds.length > 0) {
      game._lastCloudNight = game.isNight;
      const mat = game.clouds[0].children[0]?.material;
      if (mat) {
        mat.opacity = game.isNight ? 0.2 : 0.5;
        mat.color.setScalar(game.isNight ? 0.15 : 1.0);
      }
    }
    for (const cloud of game.clouds) {
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > 200) cloud.position.x = -200;
    }
  }

  // --- Falling leaves (every 2nd frame) ---
  if (game.fallingLeaves && (envFrameCount % 2 === 0)) {
    const fl = game.fallingLeaves;
    const scaledDt = dt * 2;
    const pos = fl.mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i) + fl.vel[i * 3] * scaledDt;
      let y = pos.getY(i) + fl.vel[i * 3 + 1] * scaledDt;
      let z = pos.getZ(i) + fl.vel[i * 3 + 2] * scaledDt;
      x += Math.sin(t * 1.5 + i * 0.7) * 0.015;
      z += Math.cos(t * 1.2 + i * 1.1) * 0.015;
      const gy = getTerrainHeightFast(x, z);
      if (y < gy + 0.2) {
        x = -50 + (Math.random() - 0.5) * 60;
        y = 8 + Math.random() * 10;
        z = 50 + (Math.random() - 0.5) * 60;
      }
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  }

  // --- Palm tree sway ---
  if (game.palmTrees) {
    const windT = t * 0.6;
    const playerPos = game.camera.position;
    // Wind intensifies during rain
    const windMult = game.weather && game.weather.rainActive ? 2.5 : 1.0;
    for (const palm of game.palmTrees) {
      const dx = palm.userData.baseX - playerPos.x;
      const dz = palm.userData.baseZ - playerPos.z;
      if (dx * dx + dz * dz > 6400) continue; // 80 unit radius
      const sway = Math.sin(windT + palm.userData.swayOffset) * 0.015 * windMult;
      const sway2 = Math.cos(windT * 0.7 + palm.userData.swayOffset * 1.3) * 0.01 * windMult;
      palm.rotation.z = sway;
      palm.rotation.x = sway2;
    }
  }

  // --- Bush sway ---
  if (game.bushes) {
    const windT = t * 0.8;
    const playerPos = game.camera.position;
    const bushWindMult = game.weather && game.weather.rainActive ? 2.0 : 1.0;
    for (const bush of game.bushes) {
      const dx = bush.userData.baseX - playerPos.x;
      const dz = bush.userData.baseZ - playerPos.z;
      if (dx * dx + dz * dz > 3600) continue;
      const sway = Math.sin(windT + bush.userData.swayOffset) * bush.userData.swayAmt * bushWindMult;
      bush.position.x = bush.userData.baseX + sway;
      bush.rotation.z = sway * 0.5;
    }
  }

  // --- Shore splash (every 3rd frame) ---
  if (game.shoreSplash && (envFrameCount % 3 === 0)) {
    const pos = game.shoreSplash.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const baseAngle = (i / pos.count) * Math.PI * 2;
      const wave = Math.sin(t * 1.2 + baseAngle * 3) * 0.3;
      pos.setY(i, wave + Math.abs(Math.sin(t * 2 + i * 0.8)) * 0.2);
    }
    pos.needsUpdate = true;
    game.shoreSplash.material.opacity = 0.25 + Math.sin(t * 1.5) * 0.15;
  }
}

export function updateMinimap(game) {
  if (!game.minimapCanvas) return;
  const ctx = game.minimapCtx;
  const size = game.minimapCanvas.width;
  const pos = game.camera.position;

  // Draw static map
  ctx.drawImage(game.minimapStatic, 0, 0);

  // Player dot
  const px = (pos.x / 300 + 0.5) * size;
  const py = (pos.z / 300 + 0.5) * size;

  // Player direction (reuse cached vector)
  if (!game._minimapDir) game._minimapDir = new THREE.Vector3();
  const dir = game._minimapDir;
  game.camera.getWorldDirection(dir);
  const angle = Math.atan2(dir.x, dir.z);

  ctx.fillStyle = '#ff8833';
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fill();

  // Direction indicator
  ctx.strokeStyle = '#ffcc44';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.sin(angle) * 10, py + Math.cos(angle) * 10);
  ctx.stroke();

  // Enemy dots
  ctx.fillStyle = '#ff3333';
  for (const e of game.enemyManager.enemies) {
    if (e.state === 'dead') continue;
    const ex = (e.model.position.x / 300 + 0.5) * size;
    const ey = (e.model.position.z / 300 + 0.5) * size;
    const dist = Math.sqrt((ex - px) ** 2 + (ey - py) ** 2);
    if (dist < 30) {
      ctx.beginPath();
      ctx.arc(ex, ey, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // NPC dots
  ctx.fillStyle = '#44ff44';
  for (const npc of Object.values(game.npcManager.npcs)) {
    const nx = (npc.model.position.x / 300 + 0.5) * size;
    const ny = (npc.model.position.z / 300 + 0.5) * size;
    ctx.beginPath();
    ctx.arc(nx, ny, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Circular mask
  ctx.globalCompositeOperation = 'destination-in';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

// --- Helper functions ---
function addBox(game, x, y, z, w, h, d, color, opts = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  // Auto-pick textured material for buildings based on color
  let mat;
  const c = color;
  if (c === 0xAA9977 || c === 0x998866 || c === 0xBBAA88 || c === 0x887766) {
    mat = getTexMat(c, TEX_WOOD);       // wooden walls
  } else if (c === 0x777777 || c === 0x666666 || c === 0x888888 || c === 0x555555) {
    mat = getTexMat(c, TEX_STONE);      // stone/concrete
  } else if (c === 0xBB9966 || c === 0xAA8855 || c === 0xCC9955) {
    mat = getTexMat(c, TEX_THATCH);     // thatch/bamboo
  } else {
    mat = getMat(c);
  }
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  if (opts.rotY) mesh.rotation.y = opts.rotY;
  if (opts.invisible) {
    mesh.visible = false;
  } else {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  game.scene.add(mesh);

  if (opts.collider !== false) {
    const box = new THREE.Box3().setFromObject(mesh);
    game.colliders.push(box);
  }

  if (opts.interactable) {
    mesh.userData = { interactable: true, ...opts.interactData };
    game.interactables.push(mesh);
  }
  return mesh;
}

function addCylinder(game, x, y, z, rTop, rBot, h, color, opts = {}) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, opts.segments || 6);
  const mat = getMat(color);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  game.scene.add(mesh);
  if (opts.collider !== false) {
    const box = new THREE.Box3().setFromObject(mesh);
    game.colliders.push(box);
  }
  return mesh;
}

function createPalmTree(game, x, z, height = 8) {
  const group = new THREE.Group();
  const groundY = getTerrainHeightFast(x, z);
  const lean = (Math.random() - 0.5) * 1.5;
  const leanDir = Math.random() * Math.PI * 2;

  // --- Curved trunk with bark rings ---
  const segments = 5;
  const trunkMat = getTexMat(0x7B5B3A, TEX_BARK, 0.95);
  const darkBark = getMat(0x4A2F16);
  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const nextT = (i + 1) / segments;
    const segH = height / segments;
    const rBot = 0.18 * (1 - t * 0.55);
    const rTop = 0.18 * (1 - nextT * 0.55);
    const curveAmt = lean * t * t;
    const cx = Math.cos(leanDir) * curveAmt;
    const cz = Math.sin(leanDir) * curveAmt;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, segH, 7), trunkMat);
    seg.position.set(cx, groundY + segH * i + segH / 2, cz);
    seg.rotation.z = Math.cos(leanDir) * lean * 0.025 * (i + 1);
    seg.rotation.x = Math.sin(leanDir) * lean * 0.025 * (i + 1);
    group.add(seg);
    // Bark ring between segments
    if (i > 0) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rBot + 0.01, 0.012, 4, 8), darkBark);
      ring.position.set(cx, groundY + segH * i, cz);
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    }
  }

  // Crown position
  const topCurve = lean;
  const topX = Math.cos(leanDir) * topCurve;
  const topZ = Math.sin(leanDir) * topCurve;
  const topY = groundY + height;

  // --- Tapered fronds with natural droop ---
  const frondColors = [0x1E8C1E, 0x228B22, 0x2A9A2A, 0x1F7F1F, 0x267326];
  const frondCount = 7;
  for (let i = 0; i < frondCount; i++) {
    const angle = (i / frondCount) * Math.PI * 2 + Math.random() * 0.4;
    const frondLen = 3 + Math.random() * 2;
    const droop = 0.3 + Math.random() * 0.5;
    // Tapered frond with vertex-modified droop
    const frondGeo = new THREE.PlaneGeometry(0.7, frondLen, 1, 4);
    const fv = frondGeo.attributes.position;
    for (let j = 0; j < fv.count; j++) {
      const fy = fv.getY(j);
      const norm = (fy + frondLen / 2) / frondLen; // 0 at base, 1 at tip
      // Taper width toward tip
      fv.setX(j, fv.getX(j) * (1 - norm * 0.75));
      // Droop curve
      fv.setZ(j, fv.getZ(j) - norm * norm * droop * frondLen);
    }
    frondGeo.computeVertexNormals();
    const frondMat = new THREE.MeshLambertMaterial({
      color: frondColors[i % frondColors.length], side: THREE.DoubleSide
    });
    const frond = new THREE.Mesh(frondGeo, frondMat);
    frond.position.set(topX, topY + 0.1, topZ);
    frond.rotation.y = angle;
    frond.rotation.z = 0.15 + Math.random() * 0.15;
    group.add(frond);
  }

  // --- Coconut cluster ---
  const coconutMat = getMat(0x5C4033);
  const coconutCount = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < coconutCount; i++) {
    const ca = (i / coconutCount) * Math.PI * 2 + Math.random() * 0.5;
    const coconut = new THREE.Mesh(new THREE.SphereGeometry(0.1, 5, 4), coconutMat);
    coconut.position.set(topX + Math.cos(ca) * 0.2, topY - 0.35, topZ + Math.sin(ca) * 0.2);
    coconut.scale.y = 1.3;
    group.add(coconut);
  }

  // --- Crown tuft (where fronds meet trunk) ---
  const tuft = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 5, 4),
    new THREE.MeshLambertMaterial({ color: 0x2D6B1A })
  );
  tuft.position.set(topX, topY + 0.05, topZ);
  tuft.scale.y = 0.5;
  group.add(tuft);

  group.position.set(x, 0, z);
  group.userData.baseX = x;
  group.userData.baseZ = z;
  group.userData.swayOffset = Math.random() * Math.PI * 2;
  group.userData.height = height;
  game.scene.add(group);

  const trunkBox = new THREE.Box3(
    new THREE.Vector3(x - 0.3, groundY, z - 0.3),
    new THREE.Vector3(x + 0.3, groundY + height, z + 0.3)
  );
  game.colliders.push(trunkBox);
}

// --- RESORT ---
function buildResort(game) {
  const gY = 0.5;

  // Main building
  addBox(game, -8, gY + 2, -5, 16, 4, 10, 0xD4C5A9);
  addBox(game, -15, gY + 2, 5.1, 2, 4, 12, 0xCCBB99);
  addBox(game, -1, gY + 2, 5.1, 2, 4, 12, 0xCCBB99);
  addBox(game, -8, gY + 4.2, 0, 16, 0.4, 14, 0x8B7355);
  // Columns
  addCylinder(game, -12, gY + 1.5, 5, 0.3, 0.4, 3, 0xCCCCBB);
  addCylinder(game, -4, gY + 1.5, 5, 0.3, 0.4, 3, 0xCCCCBB);
  // Desk
  addBox(game, -8, gY + 0.5, -2, 5, 1, 1.5, 0x6B4226);

  // Pool
  const pool = new THREE.Mesh(
    new THREE.BoxGeometry(8, 0.1, 6),
    new THREE.MeshLambertMaterial({ color: 0x4488AA })
  );
  pool.position.set(8, gY - 0.5, 5);
  game.scene.add(pool);
  addBox(game, 4, gY, 5, 0.3, 1, 6, 0xCCCCBB);
  addBox(game, 12, gY, 5, 0.3, 1, 6, 0xCCCCBB);
  addBox(game, 8, gY, 2, 8, 1, 0.3, 0xCCCCBB);
  addBox(game, 8, gY, 8, 8, 1, 0.3, 0xCCCCBB);

  // Tiki bar
  addBox(game, 15, gY + 1.5, -5, 4, 3, 3, 0x6B4226);
  addBox(game, 15, gY + 3.2, -5, 5, 0.3, 4, 0x8B7355);
  addBox(game, 15, gY + 0.5, -3.8, 3, 1, 0.3, 0x8B6914);

  // Workbench
  addBox(game, 12, gY + 0.5, -8, 2, 1, 1.2, 0x664422, {
    interactable: true,
    interactData: { type: 'workbench', promptText: 'Press E - Workbench' }
  });

  // Lore note
  addBox(game, -8, gY + 1.2, -1.5, 0.4, 0.4, 0.05, 0xFFF8DC, {
    interactable: true,
    interactData: {
      type: 'lore', promptText: 'Press E - Read note',
      text: '"If you\'re reading this, get to the village. There are survivors. Stay away from the jungle at night. -Marco"',
      questTrigger: 'found_note'
    }
  });

  // Sign pointing to village
  const signPost = addCylinder(game, 20, gY + 1, 10, 0.05, 0.06, 2, 0x6B4226);
  const signBoard = addBox(game, 20, gY + 2, 10, 1.5, 0.4, 0.08, 0xD4A556, { collider: false });

  // Beach lounge chair for sleeping (near pool)
  const loungeY = gY;
  // Chair frame
  addBox(game, 5, loungeY + 0.3, 10, 0.7, 0.08, 2.0, 0x6B4226, { collider: false });
  // Raised back rest
  addBox(game, 5, loungeY + 0.55, 10.8, 0.65, 0.4, 0.08, 0x6B4226, { collider: false });
  // Cushion
  const loungeCushion = addBox(game, 5, loungeY + 0.38, 10, 0.6, 0.06, 1.8, 0x7799AA, { collider: false });
  // Small pillow
  addBox(game, 5, loungeY + 0.45, 10.6, 0.4, 0.08, 0.3, 0xCCBBAA, { collider: false });
  loungeCushion.userData = {
    interactable: true,
    type: 'bed',
    promptText: 'Press E - Rest until morning'
  };
  game.interactables.push(loungeCushion);
}

// --- VILLAGE ---
function buildVillage(game) {
  const ox = 60, oz = 20;

  // Init torch lights array before building huts so torches register for flicker
  game.torchLights = [];

  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const r = 12 + Math.random() * 5;
    const hx = ox + Math.cos(angle) * r;
    const hz = oz + Math.sin(angle) * r;
    const gy = getTerrainHeightFast(hx, hz);
    buildNipaHut(game, hx, gy, hz, true); // all huts have beds
  }
  // Fire pit with particle flames
  const gy = getTerrainHeightFast(ox, oz);
  addCylinder(game, ox, gy + 0.15, oz, 1.5, 1.5, 0.3, 0x444444, { segments: 8 });

  // Fire logs
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const log = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 1.2, 5),
      getMat(0x3D2B1F)
    );
    log.position.set(ox + Math.cos(a) * 0.5, gy + 0.35, oz + Math.sin(a) * 0.5);
    log.rotation.z = Math.PI / 2;
    log.rotation.y = a;
    game.scene.add(log);
  }

  // Campfire flame particles
  const fireCount = 30;
  const fireGeo = new THREE.BufferGeometry();
  const firePos = new Float32Array(fireCount * 3);
  const fireColors = new Float32Array(fireCount * 3);
  for (let i = 0; i < fireCount; i++) {
    firePos[i * 3] = ox + (Math.random() - 0.5) * 0.8;
    firePos[i * 3 + 1] = gy + 0.4 + Math.random() * 1.2;
    firePos[i * 3 + 2] = oz + (Math.random() - 0.5) * 0.8;
    const t = Math.random();
    fireColors[i * 3] = 1;
    fireColors[i * 3 + 1] = 0.3 + t * 0.5;
    fireColors[i * 3 + 2] = t * 0.1;
  }
  fireGeo.setAttribute('position', new THREE.BufferAttribute(firePos, 3));
  fireGeo.setAttribute('color', new THREE.BufferAttribute(fireColors, 3));
  const fireMat = new THREE.PointsMaterial({
    size: 0.25, vertexColors: true, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false
  });
  const fireParticles = new THREE.Points(fireGeo, fireMat);
  game.scene.add(fireParticles);
  game.fireParticles = { mesh: fireParticles, ox, oz, gy };

  const fireLight = new THREE.PointLight(0xff6622, 2, 15);
  fireLight.position.set(ox, gy + 1.5, oz);
  game.scene.add(fireLight);
  game.fireLight = fireLight;

  // Workbench
  addBox(game, ox - 5, getTerrainHeightFast(ox - 5, oz + 10) + 0.5, oz + 10, 2, 1, 1.2, 0x664422, {
    interactable: true,
    interactData: { type: 'workbench', promptText: 'Press E - Village Workbench' }
  });
}

function buildNipaHut(game, x, y, z, hasBed = false) {
  const stiltH = 1.5;
  for (const [dx, dz] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) {
    addCylinder(game, x + dx, y + stiltH / 2, z + dz, 0.08, 0.1, stiltH, 0x5C4033);
  }
  // Floor (visual only)
  addBox(game, x, y + stiltH, z, 3.5, 0.15, 3.5, 0x8B7355, { collider: false });

  // Walls — visual meshes are non-collider so player can walk inside
  // Back wall
  addBox(game, x, y + stiltH + 1.2, z - 1.7, 3.2, 2.2, 0.15, 0x9B8B60, { collider: false });
  // Left wall
  addBox(game, x - 1.7, y + stiltH + 1.2, z, 0.15, 2.2, 3.5, 0x9B8B60, { collider: false });
  // Right wall
  addBox(game, x + 1.7, y + stiltH + 1.2, z, 0.15, 2.2, 3.5, 0x9B8B60, { collider: false });

  // Direct Box3 colliders to prevent walking through the hut (no mesh needed)
  // Back wall
  game.colliders.push(new THREE.Box3(
    new THREE.Vector3(x - 1.75, y, z - 1.85),
    new THREE.Vector3(x + 1.75, y + stiltH + 2.5, z - 1.55)
  ));
  // Left wall
  game.colliders.push(new THREE.Box3(
    new THREE.Vector3(x - 1.85, y, z - 1.75),
    new THREE.Vector3(x - 1.55, y + stiltH + 2.5, z + 1.75)
  ));
  // Right wall
  game.colliders.push(new THREE.Box3(
    new THREE.Vector3(x + 1.55, y, z - 1.75),
    new THREE.Vector3(x + 1.85, y + stiltH + 2.5, z + 1.75)
  ));

  const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2, 2, 4), getMat(0x8B7B45));
  roof.position.set(x, y + stiltH + 3.3, z);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  game.scene.add(roof);

  // Torch by entrance
  const torchX = x + 2, torchZ = z + 1.8;
  addCylinder(game, torchX, y + stiltH + 0.5, torchZ, 0.03, 0.04, 1.2, 0x5C4033, { collider: false });
  const torch = new THREE.PointLight(0xff8833, 0.8, 8);
  torch.position.set(torchX, y + stiltH + 1.3, torchZ);
  game.scene.add(torch);
  if (game.torchLights) game.torchLights.push(torch);

  // Small flame mesh
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.06, 0.15, 4),
    new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.8 })
  );
  flame.position.copy(torch.position);
  game.scene.add(flame);

  // Register hut floor as walkable platform
  const floorTop = y + stiltH + 0.075; // top surface of floor
  game.platforms.push({
    minX: x - 1.75, maxX: x + 1.75,
    minZ: z - 1.75, maxZ: z + 1.75,
    top: floorTop
  });

  // Wooden stairs at front of hut (lowest step farthest, climbing toward hut)
  const stairWidth = 1.2;
  const stairZ = z + 1.75;
  const numSteps = 4;
  const stairDepth = 1.8; // total depth of staircase
  for (let s = 0; s < numSteps; s++) {
    const stepH = y + (stiltH / numSteps) * (s + 1);
    const stepZ = stairZ + stairDepth - s * (stairDepth / numSteps); // bottom step farthest
    // Visual step
    addBox(game, x, stepH - 0.08, stepZ, stairWidth, 0.15, 0.5, 0x7B5B3A, { collider: false });
    // Walkable platform for this step
    game.platforms.push({
      minX: x - stairWidth / 2, maxX: x + stairWidth / 2,
      minZ: stepZ - 0.25, maxZ: stepZ + 0.25,
      top: stepH
    });
  }
  // Stair railings
  for (const side of [-stairWidth / 2 - 0.05, stairWidth / 2 + 0.05]) {
    addCylinder(game, x + side, y + stiltH / 2 + 0.3, stairZ + stairDepth / 2, 0.03, 0.03, stairDepth, 0x5C4033, { collider: false });
  }

  // Bed inside hut
  if (hasBed) {
    // Bed frame
    addBox(game, x, y + stiltH + 0.25, z - 0.5, 1.2, 0.15, 2.2, 0x5C4033, { collider: false });
    // Mattress (interactable)
    const mattress = addBox(game, x, y + stiltH + 0.38, z - 0.5, 1.1, 0.12, 2.0, 0x7799AA, { collider: false });
    // Pillow
    addBox(game, x, y + stiltH + 0.48, z - 1.3, 0.6, 0.1, 0.35, 0xCCBBAA, { collider: false });
    // Blanket (slightly draped)
    addBox(game, x, y + stiltH + 0.45, z + 0.1, 1.0, 0.06, 1.2, 0x886644, { collider: false });

    mattress.userData = {
      interactable: true,
      type: 'bed',
      promptText: 'Press E - Sleep until morning'
    };
    game.interactables.push(mattress);
  }
}

// --- TEMPLE ---
function buildTemple(game) {
  const ox = -60, oz = -60;
  const gy = getTerrainHeightFast(ox, oz);

  addBox(game, ox, gy + 0.5, oz, 20, 1, 20, 0x555555);
  for (let i = 0; i < 4; i++) {
    addBox(game, ox, gy + 0.3 * i, oz + 11 + i, 8 - i, 0.3, 1, 0x666666);
  }
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const px = ox + Math.cos(angle) * 8;
    const pz = oz + Math.sin(angle) * 8;
    const ph = Math.random() > 0.5 ? 2 + Math.random() * 2 : 5;
    addCylinder(game, px, gy + 1 + ph / 2, pz, 0.4, 0.5, ph, 0x777766);
  }
  addBox(game, ox, gy + 1.8, oz, 2, 1.5, 2, 0x444433);
  const altarLight = new THREE.PointLight(0x8800ff, 1.5, 10);
  altarLight.position.set(ox, gy + 4, oz);
  game.scene.add(altarLight);

  addBox(game, ox, gy + 2.8, oz, 0.6, 0.6, 0.1, 0x332244, {
    interactable: true,
    interactData: {
      type: 'lore', promptText: 'Press E - Read inscription',
      text: '"When the blood moon rises and the seal breaks, the Diwata\'s rage shall consume all. Only the brave who gather the three sacred relics can restore the balance."',
      questTrigger: 'read_inscription'
    }
  });

  for (let i = 0; i < 3; i++) {
    const wx = ox - 8 + i * 8;
    addBox(game, wx, gy + 2.5, oz - 9, 3, 4, 0.8, 0x555544);
  }
}

// --- JUNGLE ---
function buildJungle(game) {
  const ox = -50, oz = 50;
  for (let i = 0; i < 8; i++) {
    const jx = ox + (Math.random() - 0.5) * 50;
    const jz = oz + (Math.random() - 0.5) * 50;
    const gy = getTerrainHeightFast(jx, jz);
    if (Math.random() > 0.5) {
      addBox(game, jx, gy + 0.3, jz, 4, 0.6, 0.5, 0x3D2B1F, { rotY: Math.random() * Math.PI });
    }
  }

  addBox(game, ox - 10, getTerrainHeightFast(ox - 10, oz + 15) + 1.5, oz + 15, 4, 3, 1, 0x444444, {
    interactable: true,
    interactData: {
      type: 'lore', promptText: 'Press E - Enter cave',
      text: 'A dark cave stretches into the hillside. The walls are covered in ancient carvings. You find a Sacred Amulet fragment!',
      questTrigger: 'found_amulet'
    }
  });
}

// --- BEACH ---
function buildBeach(game) {
  const bx = 20, bz = -45;
  const by = getTerrainHeightFast(bx, bz);
  addBox(game, bx, by + 0.8, bz, 6, 1.5, 2.5, 0x6B4226, { rotY: 0.3 });
  addBox(game, bx - 2, by + 1.5, bz, 1.5, 2, 0.2, 0x6B4226, { rotY: 0.3 });
  addCylinder(game, bx, by + 3, bz, 0.08, 0.1, 4, 0x8B7355);

  for (let i = 0; i < 4; i++) {
    const cx = -10 + i * 6, cz = -38;
    addBox(game, cx, getTerrainHeightFast(cx, cz) + 0.2, cz, 0.8, 0.1, 2,
      [0xCC3333, 0x3333CC, 0xCCCC33, 0x33CC33][i], { collider: false });
  }
}

// --- SWAMP ---
function buildSwamp(game) {
  const ox = 40, oz = 70;
  for (let i = 0; i < 5; i++) {
    const rx = ox + (Math.random() - 0.5) * 30;
    const rz = oz + (Math.random() - 0.5) * 30;
    const gy = getTerrainHeightFast(rx, rz);
    for (let j = 0; j < 2; j++) {
      const a = Math.random() * Math.PI * 2;
      addCylinder(game, rx + Math.cos(a) * 1.5, gy + 1, rz + Math.sin(a) * 1.5,
        0.06, 0.08, 2.5, 0x4A3728, { segments: 5 });
    }
    addBox(game, rx, gy + 2.5, rz, 3, 0.5, 3, 0x1A4A1A, { collider: false });
  }
}

// --- COVE ---
function buildCove(game) {
  const ox = 85, oz = -65;
  const gy = getTerrainHeightFast(ox, oz);
  addBox(game, ox, gy + 0.4, oz - 5, 2, 0.2, 8, 0x6B4226);
  for (let i = 0; i < 4; i++) {
    addCylinder(game, ox - 0.8, gy + 0.5, oz - 2 - i * 2, 0.08, 0.1, 1.5, 0x5C4033);
    addCylinder(game, ox + 0.8, gy + 0.5, oz - 2 - i * 2, 0.08, 0.1, 1.5, 0x5C4033);
  }
}

// --- DESTRUCTIBLES ---
function placeDestructibles(game) {
  function addDestructible(x, y, z, w, h, d, color, name, hp, drops, opts = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = getMat(color);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    if (opts.rotY) mesh.rotation.y = opts.rotY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    game.scene.add(mesh);

    let colliderIdx;
    if (opts.collider !== false) {
      const box = new THREE.Box3().setFromObject(mesh);
      colliderIdx = game.colliders.length;
      game.colliders.push(box);
    }

    game.destructibles.push({ mesh, hp, name, color, drops, colliderIdx, destroyed: false });
    return mesh;
  }

  function addBarrel(x, z, color, drops) {
    const gy = getTerrainHeightFast(x, z);
    const geo = new THREE.CylinderGeometry(0.35, 0.4, 1.0, 8);
    const mat = getMat(color);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, gy + 0.5, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    game.scene.add(mesh);
    const box = new THREE.Box3().setFromObject(mesh);
    const colliderIdx = game.colliders.length;
    game.colliders.push(box);
    game.destructibles.push({ mesh, hp: 15, name: 'Barrel', color, drops, colliderIdx, destroyed: false });
  }

  const gY = 0.5; // resort ground

  // Resort area - crates near tiki bar
  addDestructible(17, gY + 0.4, -7, 0.8, 0.8, 0.8, 0x8B6914, 'Wooden Crate', 20, [
    { id: 'scrap_metal', chance: 0.6 }, { id: 'bandage', chance: 0.4 }
  ]);
  addDestructible(18, gY + 0.4, -6, 0.7, 0.7, 0.7, 0x7B5B3A, 'Wooden Crate', 18, [
    { id: 'cloth_rag', chance: 0.5 }, { id: 'energy_drink', chance: 0.3 }
  ]);
  // Stacked crate
  addDestructible(17, gY + 1.1, -7, 0.6, 0.6, 0.6, 0x6B4226, 'Wooden Crate', 15, [
    { id: 'wire', chance: 0.5 }, { id: 'duct_tape', chance: 0.4 }
  ]);

  // Barrels near resort pool
  addBarrel(13, 8, 0x884422, [
    { id: 'coconut', chance: 0.6 }, { id: 'buko_juice', chance: 0.4 }
  ]);
  addBarrel(13, 6, 0x666655, [
    { id: 'scrap_metal', chance: 0.5 }, { id: 'battery', chance: 0.3 }
  ]);

  // Resort lobby - breakable table
  addDestructible(-12, gY + 0.35, -3, 1.2, 0.7, 0.8, 0x6B4226, 'Table', 12, [
    { id: 'ancient_wood', chance: 0.3 }, { id: 'cloth_rag', chance: 0.5 }
  ]);

  // Village area - crates and barrels scattered around
  const vox = 60, voz = 20;
  addDestructible(vox + 3, getTerrainHeightFast(vox + 3, voz - 2) + 0.4, voz - 2,
    0.8, 0.8, 0.8, 0xAA8855, 'Supply Crate', 25, [
    { id: 'herbs', chance: 0.6 }, { id: 'bandage', chance: 0.5 }, { id: 'coconut', chance: 0.4 }
  ]);
  addDestructible(vox - 4, getTerrainHeightFast(vox - 4, voz + 5) + 0.4, voz + 5,
    0.7, 0.7, 0.7, 0x7B5B3A, 'Wooden Crate', 18, [
    { id: 'cloth_rag', chance: 0.5 }, { id: 'sharp_bone', chance: 0.3 }
  ]);
  addBarrel(vox + 6, voz + 3, 0x6B4226, [
    { id: 'herbs', chance: 0.5 }, { id: 'antidote', chance: 0.3 }
  ]);
  addBarrel(vox - 2, voz - 6, 0x554433, [
    { id: 'buko_juice', chance: 0.5 }, { id: 'coconut', chance: 0.4 }
  ]);

  // Wooden fence segments near village (multiple pieces to blow apart)
  for (let i = 0; i < 4; i++) {
    addDestructible(vox + 15 + i * 1.2, getTerrainHeightFast(vox + 15, voz - 10) + 0.5, voz - 10,
      1.0, 1.0, 0.15, 0x8B7355, 'Wooden Fence', 10, [
      { id: 'ancient_wood', chance: 0.3 }
    ]);
  }

  // Jungle area - old crates and debris
  const jx = -40, jz = 55;
  addDestructible(jx + 5, getTerrainHeightFast(jx + 5, jz) + 0.4, jz,
    0.9, 0.9, 0.9, 0x5C4033, 'Rotting Crate', 12, [
    { id: 'herbs', chance: 0.7 }, { id: 'antidote', chance: 0.4 }
  ]);
  addDestructible(jx - 8, getTerrainHeightFast(jx - 8, jz + 10) + 0.4, jz + 10,
    0.8, 0.8, 0.8, 0x4A3728, 'Old Crate', 14, [
    { id: 'ancient_wood', chance: 0.5 }, { id: 'dark_essence', chance: 0.2 }
  ]);
  addBarrel(jx + 2, jz - 8, 0x3D2B1F, [
    { id: 'herbs', chance: 0.6 }, { id: 'thick_hide', chance: 0.3 }
  ]);

  // Temple area - ancient containers
  const tx = -55, tz = -55;
  addDestructible(tx + 3, getTerrainHeightFast(tx + 3, tz + 2) + 0.5, tz + 2,
    1.0, 1.0, 1.0, 0x777777, 'Stone Urn', 35, [
    { id: 'sacred_crystal', chance: 0.3 }, { id: 'dark_essence', chance: 0.5 }
  ]);
  addDestructible(tx - 3, getTerrainHeightFast(tx - 3, tz + 2) + 0.5, tz + 2,
    1.0, 1.0, 1.0, 0x777777, 'Stone Urn', 35, [
    { id: 'sacred_crystal', chance: 0.3 }, { id: 'ancient_wood', chance: 0.4 }
  ]);
  addDestructible(tx, getTerrainHeightFast(tx, tz - 8) + 0.35, tz - 8,
    0.7, 0.7, 0.7, 0x555555, 'Ancient Pot', 25, [
    { id: 'dark_essence', chance: 0.6 }, { id: 'herbs', chance: 0.4 }
  ]);

  // Swamp area
  const sx = 40, sz = 70;
  addBarrel(sx + 5, sz + 3, 0x445533, [
    { id: 'antidote', chance: 0.5 }, { id: 'herbs', chance: 0.6 }
  ]);
  addDestructible(sx - 3, getTerrainHeightFast(sx - 3, sz - 2) + 0.4, sz - 2,
    0.8, 0.8, 0.8, 0x4A3728, 'Mossy Crate', 16, [
    { id: 'thick_hide', chance: 0.4 }, { id: 'sharp_bone', chance: 0.3 }
  ]);

  // Cove area - pirate-style barrels and crates
  const cox = 85, coz = -65;
  addBarrel(cox + 3, coz - 3, 0x6B4226, [
    { id: 'scrap_metal', chance: 0.6 }, { id: 'wire', chance: 0.4 }
  ]);
  addBarrel(cox + 3, coz - 5, 0x554433, [
    { id: 'battery', chance: 0.4 }, { id: 'duct_tape', chance: 0.5 }
  ]);
  addDestructible(cox - 2, getTerrainHeightFast(cox - 2, coz - 7) + 0.4, coz - 7,
    0.9, 0.9, 0.9, 0x8B6914, 'Cargo Crate', 22, [
    { id: 'scrap_metal', chance: 0.5 }, { id: 'energy_drink', chance: 0.3 }, { id: 'bandage', chance: 0.4 }
  ]);
}

// --- SCATTER ---
function scatterPalmTrees(game, count) {
  game.palmTrees = [];
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 260;
    const z = (Math.random() - 0.5) * 260;
    const dist = Math.sqrt(x * x + z * z);
    if (dist > 130) continue;
    if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
    createPalmTree(game, x, z, 6 + Math.random() * 5);
    // Store last added group for sway
    const lastChild = game.scene.children[game.scene.children.length - 1];
    if (lastChild && lastChild.userData.baseX !== undefined) {
      game.palmTrees.push(lastChild);
    }
  }
}

function scatterJungleTrees(game, count) {
  for (let i = 0; i < count; i++) {
    const x = -50 + (Math.random() - 0.5) * 70;
    const z = 50 + (Math.random() - 0.5) * 70;
    const gy = getTerrainHeightFast(x, z);
    const h = 8 + Math.random() * 6;
    // Gnarled trunk with slight taper
    addCylinder(game, x, gy + h / 2, z, 0.15, 0.35, h, 0x3D2B1F);
    // Root buttresses
    for (let r = 0; r < 3; r++) {
      const ra = (r / 3) * Math.PI * 2 + Math.random() * 0.5;
      const root = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 1.2, 0.5),
        getMat(0x3D2B1F)
      );
      root.position.set(x + Math.cos(ra) * 0.3, gy + 0.5, z + Math.sin(ra) * 0.3);
      root.rotation.y = ra;
      root.rotation.z = 0.2;
      game.scene.add(root);
    }
    // Multi-layered canopy
    const canopyColors = [0x1A5A1A, 0x1F6B1F, 0x174E17, 0x226622];
    for (let c = 0; c < 3; c++) {
      const cr = 1.8 + Math.random() * 2;
      const canopy = new THREE.Mesh(
        new THREE.SphereGeometry(cr, 6, 4),
        getMat(canopyColors[c % canopyColors.length])
      );
      canopy.position.set(
        x + (Math.random() - 0.5) * 1.5,
        gy + h - 0.5 + c * 0.8,
        z + (Math.random() - 0.5) * 1.5
      );
      canopy.scale.y = 0.45 + Math.random() * 0.15;
      game.scene.add(canopy);
    }
    // Hanging vines (a few thin cylinders)
    if (Math.random() > 0.5) {
      for (let v = 0; v < 2; v++) {
        const va = Math.random() * Math.PI * 2;
        const vine = new THREE.Mesh(
          new THREE.CylinderGeometry(0.01, 0.01, 3 + Math.random() * 2, 3),
          getMat(0x2D5A1A)
        );
        vine.position.set(
          x + Math.cos(va) * 1.5,
          gy + h - 2,
          z + Math.sin(va) * 1.5
        );
        game.scene.add(vine);
      }
    }
  }
}

function scatterRocks(game, count) {
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 240;
    const z = (Math.random() - 0.5) * 240;
    if (Math.sqrt(x * x + z * z) > 125) continue;
    const gy = getTerrainHeightFast(x, z);
    const s = 0.4 + Math.random() * 1.2;
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), getMat(0x777766));
    rock.position.set(x, gy + s * 0.3, z);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    game.scene.add(rock);
    if (s > 0.8) game.colliders.push(new THREE.Box3().setFromObject(rock));
  }
}

function scatterBushes(game, count) {
  game.bushes = [];
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 240;
    const z = (Math.random() - 0.5) * 240;
    if (Math.sqrt(x * x + z * z) > 120) continue;
    const gy = getTerrainHeightFast(x, z);
    const s = 0.5 + Math.random() * 1.0;
    const bush = new THREE.Mesh(new THREE.SphereGeometry(s, 4, 3), getMat(0x2D5A27));
    bush.position.set(x, gy + s * 0.4, z);
    bush.scale.y = 0.6;
    bush.userData.baseX = x;
    bush.userData.baseZ = z;
    bush.userData.swayOffset = Math.random() * Math.PI * 2;
    bush.userData.swayAmt = 0.03 + Math.random() * 0.04;
    game.scene.add(bush);
    game.bushes.push(bush);
  }
}

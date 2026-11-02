// 알티노 3D 주행 화면 (three.js). app.js 가 getState() 로 "지금 상태"를 건네 주면 그대로 그려요.
//  getState() -> { pose:{x,y,h}, path:[{x,y}], tx:[22바이트], wallOn, wallCm, ir:[...], real:boolean }
//  단위는 cm. 가상 세계에서 x = 오른쪽, y = 앞쪽, h = 보는 방향(도, 90 = 앞쪽).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const FOV = 45;
const WHEEL_R = 3.5;
const TRAIL_CAP = 12000;
const CM_PER_SEC_AT_1000 = 60;   // AltinoLite.py 의 FAKE_CM_PER_SEC_AT_1000 와 같은 짐작값

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888888';

function wheelValue(hi, lo) { const v = hi * 256 + lo; return v > 1000 ? -(v ^ 0xffff) : v; }
function steerValue(b) { return b > 127 ? -(b ^ 0xff) : b; }

export function createView3D(container, getState) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });   // WebGL 이 안 되면 여기서 오류 -> app.js 가 간단히 보기로 바꿔요
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 6000);
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));
  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(80, 200, 60);
  scene.add(sun);

  /* ---- 바닥 ---- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshBasicMaterial());
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.2;
  scene.add(floor);
  const grid = new THREE.GridHelper(8000, 160, 0x888888, 0x888888);   // 한 칸 50cm
  grid.material.transparent = true; grid.material.opacity = 0.55;
  scene.add(grid);
  const startRing = new THREE.Mesh(new THREE.RingGeometry(7, 9, 40), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  startRing.rotation.x = -Math.PI / 2; startRing.position.y = 0.1;
  scene.add(startRing);

  /* ---- 가상 벽 (빗금) ---- */
  const stripe = document.createElement('canvas'); stripe.width = stripe.height = 64;
  const wallTex = new THREE.CanvasTexture(stripe);
  wallTex.wrapS = THREE.RepeatWrapping; wallTex.repeat.set(60, 1);
  const wall = new THREE.Mesh(new THREE.BoxGeometry(800, 30, 4), new THREE.MeshLambertMaterial({ map: wallTex }));
  wall.position.y = 15; wall.visible = false;
  scene.add(wall);

  /* ---- 자동차 ---- */
  const car = new THREE.Group();                // 앞쪽 = -Z
  scene.add(car);
  const bodyMat = new THREE.MeshLambertMaterial();
  const noseMat = new THREE.MeshLambertMaterial();
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const hubMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
  const body = new THREE.Mesh(new THREE.BoxGeometry(13, 4, 22), bodyMat); body.position.y = 5.5; car.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 10), bodyMat); cab.position.set(0, 9, 2); car.add(cab);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(13, 4.2, 4), noseMat); nose.position.set(0, 5.5, -9.5); car.add(nose);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0x555555 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0x553333 });
  for (const sx of [-4.5, 4.5]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), lampMat); l.position.set(sx, 5.8, -11.5); car.add(l);
    const t = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.6, 0.6), tailMat); t.position.set(sx, 5.8, 11.2); car.add(t);
  }
  const wheels = [];   // { spin, steer, left }
  for (const [wx, wz, front] of [[-8, -7, true], [8, -7, true], [-8, 7, false], [8, 7, false]]) {
    const steer = new THREE.Group(); steer.position.set(wx, WHEEL_R, wz);
    const spin = new THREE.Group();
    const geo = new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 3, 20); geo.rotateZ(Math.PI / 2);
    spin.add(new THREE.Mesh(geo, wheelMat));
    spin.add(new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, WHEEL_R * 1.7), hubMat));   // 굴러가는 게 보이는 흰 막대
    steer.add(spin); car.add(steer);
    wheels.push({ spin, steer, left: wx < 0, front });
  }
  const beamMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(9, 3, 30), beamMat);   // 앞 센서가 보는 범위 (약 30cm)
  beam.position.set(0, 5.5, -11 - 15); car.add(beam);

  /* ---- 지나온 길 (바닥에 붙는 띠) ---- */
  const trailGeo = new THREE.BufferGeometry();
  const tPos = new Float32Array(TRAIL_CAP * 2 * 3);
  trailGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  const tIdx = new Uint32Array((TRAIL_CAP - 1) * 6);
  for (let i = 0; i < TRAIL_CAP - 1; i++) tIdx.set([2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2], i * 6);
  trailGeo.setIndex(new THREE.BufferAttribute(tIdx, 1));
  trailGeo.setDrawRange(0, 0);
  const trailMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const trail = new THREE.Mesh(trailGeo, trailMat);
  trail.frustumCulled = false; trail.position.y = 0.15;
  scene.add(trail);
  let trailN = 0;
  function setTrailPoint(i, x, z, dx, dz) {
    const len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * 1.6, nz = (dx / len) * 1.6;
    tPos.set([x + nx, 0, z + nz, x - nx, 0, z - nz], i * 6);
  }
  function updateTrail(path) {
    if (path.length < trailN) trailN = 0;
    const n = Math.min(path.length, TRAIL_CAP);
    for (let i = Math.max(trailN, 1); i < n; i++) {
      const a = path[i - 1], b = path[i];
      setTrailPoint(i, b.x, -b.y, b.x - a.x, -(b.y - a.y));
      if (i === 1) setTrailPoint(0, a.x, -a.y, b.x - a.x, -(b.y - a.y));
    }
    if (n !== trailN) {
      trailN = n;
      trailGeo.setDrawRange(0, Math.max(0, n - 1) * 6);
      trailGeo.attributes.position.needsUpdate = true;
    }
  }

  /* ---- 색: 화면 테마(밝게/어둡게)를 따라가요 ---- */
  function applyTheme() {
    const bg = new THREE.Color(css('--bg')), paper = new THREE.Color(css('--paper'));
    scene.background = bg;
    scene.fog = new THREE.Fog(bg, 350, 1400);
    floor.material.color.copy(paper);
    grid.material.color.set(css('--line'));
    startRing.material.color.set(css('--sub'));
    trailMat.color.set(css('--accent'));
    bodyMat.color.set(css('--ink'));
    noseMat.color.set(css('--accent'));
    const c = stripe.getContext('2d');
    c.fillStyle = css('--paper'); c.fillRect(0, 0, 64, 64);
    c.strokeStyle = css('--accent'); c.lineWidth = 14;
    for (let k = -64; k < 128; k += 32) { c.beginPath(); c.moveTo(k, 64); c.lineTo(k + 64, 0); c.stroke(); }
    wallTex.needsUpdate = true;
  }
  applyTheme();
  const mq = matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', applyTheme);

  /* ---- 카메라 ---- */
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.enabled = false; controls.maxPolarAngle = Math.PI / 2 - 0.02;
  let mode = 'chase';
  const carPos = new THREE.Vector3(), fwd = new THREE.Vector3(0, 0, -1);
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), look = new THREE.Vector3();
  let snap = true;

  function setView(name) {
    mode = name; snap = true;
    controls.enabled = name === 'orbit';
    camera.up.set(0, name === 'top' ? 0 : 1, name === 'top' ? -1 : 0);
    if (name === 'orbit') {
      camera.position.copy(carPos).add(tmpA.set(70, 55, 70));
      controls.target.copy(carPos);
    }
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize); ro.observe(container); resize();

  /* ---- 한 프레임 ---- */
  let last = performance.now();
  let tracked = false;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    const s = getState();
    if (!s || !container.clientWidth) return;

    // 자동차 위치 (부드럽게 따라가요)
    const tx = s.tx;
    const target = tmpA.set(s.pose.x, 0, -s.pose.y);
    const headingY = THREE.MathUtils.degToRad(s.pose.h - 90);
    const jump = carPos.distanceTo(target) > 60;
    if (!tracked || jump) { carPos.copy(target); car.rotation.y = headingY; }
    else {
      const k = 1 - Math.exp(-dt * 22);
      carPos.lerp(target, k);
      let d = headingY - car.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
      car.rotation.y += d * k;
    }
    car.position.copy(carPos);
    fwd.set(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), car.rotation.y);

    // 바퀴: 굴러가고, 앞바퀴는 핸들만큼 꺾여요
    const left = wheelValue(tx[8], tx[9]), right = wheelValue(tx[6], tx[7]);
    const steerRad = -THREE.MathUtils.degToRad(steerValue(tx[5]) / 127 * 25);
    for (const w of wheels) {
      const v = (w.left ? left : right) / 1000 * CM_PER_SEC_AT_1000;
      w.spin.rotation.x -= (v / WHEEL_R) * dt;
      if (w.front) w.steer.rotation.y = steerRad;
    }
    const avg = (left + right) / 2;
    lampMat.color.set(tx[20] ? 0xfff2a0 : 0x555555);
    tailMat.color.set(avg < 0 ? 0xff3030 : 0x553333);

    // 앞 센서 범위: 가짜 알티노에서는 벽이 가까우면 빨갛게
    beam.visible = !s.real;
    beamMat.color.set(s.ir && s.ir[1] > 0 ? 0xe02020 : 0x4a90d9);
    beamMat.opacity = s.ir && s.ir[1] > 0 ? 0.5 : 0.18;

    wall.visible = !!s.wallOn; wall.position.z = -s.wallCm;
    updateTrail(s.path);
    tracked = true;

    // 카메라
    const lerpK = snap ? 1 : 1 - Math.exp(-dt * 6);
    if (mode === 'chase') {
      tmpA.copy(carPos).addScaledVector(fwd, -48).add(look.set(0, 28, 0));
      camera.position.lerp(tmpA, lerpK);
      tmpB.copy(carPos).addScaledVector(fwd, 20).add(look.set(0, 3, 0));
      camera.lookAt(tmpB);
    } else if (mode === 'cockpit') {
      camera.position.copy(carPos).addScaledVector(fwd, 1).add(look.set(0, 13, 0));
      camera.lookAt(tmpB.copy(carPos).addScaledVector(fwd, 90).add(look.set(0, 5, 0)));
    } else if (mode === 'top') {
      let minX = -60, maxX = 60, minZ = -60, maxZ = 60;
      const grow = (x, z) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); };
      grow(carPos.x, carPos.z);
      for (let i = 0; i < s.path.length; i += Math.max(1, s.path.length >> 9)) grow(s.path[i].x, -s.path[i].y);
      if (s.wallOn) grow(0, -s.wallCm - 15);
      const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      const half = Math.max((maxZ - minZ) / 2, (maxX - minX) / 2 / camera.aspect) * 1.25 + 20;
      const hgt = half / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      camera.position.lerp(tmpA.set(cx, hgt, cz + 0.01), lerpK);
      camera.lookAt(camera.position.x, 0, camera.position.z - 0.01);
    } else {   // orbit
      controls.target.lerp(carPos, 1 - Math.exp(-dt * 8));
      controls.update();
    }
    snap = false;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  return { setView };
}

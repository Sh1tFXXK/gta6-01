// Three.js stage for Solmar Nights 3D: renderer, sunset sky, sun/moon,
// fog, rain streaks, helicopter spotlight and the chase camera.

import * as THREE from 'three';
import { S, W } from './state.js';
import { PALETTE } from './config.js';
import { clamp, lerp } from './random.js';

let skyMesh = null;
let rainPoints = null;
let rainVel = null;

export function initRender() {
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;
  W.renderer = renderer;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(PALETTE.fog, 220, 900);
  W.scene = scene;

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2500);
  W.camera = camera;

  // Sunset sky dome: vertical gradient shader, sun disc baked in.
  const skyGeo = new THREE.SphereGeometry(1200, 24, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      top: { value: new THREE.Color(PALETTE.skyTop) },
      mid: { value: new THREE.Color(PALETTE.skyMid) },
      low: { value: new THREE.Color(PALETTE.skyLow) },
      sunDir: { value: new THREE.Vector3(-0.55, 0.22, -0.8).normalize() },
      nightF: { value: 0 },
    },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      varying vec3 vP;
      uniform vec3 top; uniform vec3 mid; uniform vec3 low;
      uniform vec3 sunDir; uniform float nightF;
      void main(){
        vec3 d = normalize(vP);
        float h = clamp(d.y, -0.1, 1.0);
        vec3 col = mix(low, mid, smoothstep(0.0, 0.22, h));
        col = mix(col, top, smoothstep(0.18, 0.65, h));
        float s = max(dot(d, sunDir), 0.0);
        col += vec3(1.0, 0.75, 0.45) * pow(s, 90.0) * 1.4;
        col += vec3(1.0, 0.55, 0.25) * pow(s, 8.0) * 0.35;
        col = mix(col, col * vec3(0.16, 0.2, 0.38), nightF);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  skyMesh = new THREE.Mesh(skyGeo, skyMat);
  scene.add(skyMesh);

  W.sun = new THREE.DirectionalLight(0xffc27a, 2.2);
  W.sun.position.set(-220, 120, -320);
  scene.add(W.sun);
  W.hemi = new THREE.HemisphereLight(0xffb37a, 0x3a4a6a, 0.9);
  scene.add(W.hemi);
  W.moon = new THREE.DirectionalLight(0x8aa2ff, 0);
  W.moon.position.set(200, 180, 200);
  scene.add(W.moon);

  // Rain streaks (points, recycled).
  const N = 900;
  const pos = new Float32Array(N * 3);
  rainVel = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 300;
    pos[i * 3 + 1] = Math.random() * 90;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 300;
    rainVel[i] = 55 + Math.random() * 30;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  rainPoints = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: 0xbfd4e6, size: 0.7, transparent: true, opacity: 0.5 }));
  rainPoints.visible = false;
  W.rainGroup = rainPoints;
  scene.add(rainPoints);

  W.markerGroup = new THREE.Group();
  scene.add(W.markerGroup);

  // Waypoint beacon: tall light pillar + bouncing ring.
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 2.2, 90, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
  );
  pillar.position.y = 45;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(4.5, 0.45, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23a })
  );
  ring.rotation.x = Math.PI / 2;
  const wp = new THREE.Group();
  wp.add(pillar); wp.add(ring);
  wp.visible = false;
  W.waypointMesh = wp;
  scene.add(wp);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// Fraction of night from the clock: 20:00–06:00.
export function nightFactor() {
  const h = (S.clockMin / 60) % 24;
  if (h >= 20 || h < 5) return 1;
  if (h >= 18) return (h - 18) / 2;
  if (h >= 5 && h < 7) return 1 - (h - 5) / 2;
  return 0;
}

export function updateSky(dt) {
  const nf = nightFactor();
  skyMesh.material.uniforms.nightF.value = lerp(skyMesh.material.uniforms.nightF.value, nf, dt * 0.5);
  W.sun.intensity = lerp(2.2, 0.12, nf);
  W.moon.intensity = lerp(0, 0.7, nf);
  W.hemi.intensity = lerp(0.9, 0.35, nf);
  const rain = S.weather.rain;
  if (rainPoints) {
    rainPoints.visible = rain > 0.05;
    if (rainPoints.visible) {
      const p = W.player;
      const pos = rainPoints.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - rainVel[i] * dt;
        if (y < 0) {
          y = 80 + Math.random() * 10;
          pos.setX(i, p.x + (Math.random() - 0.5) * 220);
          pos.setZ(i, p.z + (Math.random() - 0.5) * 220);
        }
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
      rainPoints.material.opacity = 0.25 + rain * 0.45;
    }
  }
  // Helicopter spotlight cone follows the player.
  if (W.heli && W.heliLight) {
    W.heliLight.position.set(W.heli.position.x, W.heli.position.y - 1, W.heli.position.z);
    W.heliLight.target.position.set(S.player.x, 0, S.player.z);
    W.heliLight.target.updateMatrixWorld();
    if (W.heliCone) {
      W.heliCone.position.set(
        (W.heli.position.x + S.player.x) / 2,
        W.heli.position.y / 2,
        (W.heli.position.z + S.player.z) / 2
      );
      W.heliCone.lookAt(S.player.x, 0, S.player.z);
      W.heliCone.rotateX(-Math.PI / 2);
    }
  }
}

export function updateCamera(dt) {
  const cam = W.camera;
  const p = S.player;
  // Mouse drag orbits the camera.
  S.camYaw -= (window.__dragDx || 0) * 0.004;
  S.camPitch = clamp(S.camPitch + (window.__dragDy || 0) * 0.003, 0.08, 0.9);
  window.__dragDx = 0; window.__dragDy = 0;

  let tx, tz, ty;
  if (p.car) {
    // Chase cam behind the car, lerping yaw toward the car's heading.
    const targetYaw = p.car.heading + Math.PI;
    let d = targetYaw - S.camYaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    S.camYaw += d * Math.min(1, dt * 2.2);
    tx = p.car.x; tz = p.car.z; ty = 2.2;
  } else {
    tx = p.x; tz = p.z; ty = 1.6;
    // On foot, camera follows behind the player's facing.
    const targetYaw = p.heading + Math.PI;
    let d = targetYaw - S.camYaw;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    S.camYaw += d * Math.min(1, dt * 3);
  }
  const dist = S.camDist + (p.car ? Math.min(6, Math.abs(p.car.speed) * 0.06) : 0);
  const cx = tx + Math.sin(S.camYaw) * Math.cos(S.camPitch) * dist;
  const cz = tz + Math.cos(S.camYaw) * Math.cos(S.camPitch) * dist;
  const cy = ty + Math.sin(S.camPitch) * dist;
  cam.position.lerp(new THREE.Vector3(cx, cy, cz), Math.min(1, dt * 8));
  cam.lookAt(tx, ty, tz);
  // Keep the camera out of the ground.
  if (cam.position.y < 1.2) cam.position.y = 1.2;
}

export function setWaypoint(x, z, visible) {
  if (!W.waypointMesh) return;
  window.__waypoint = visible ? { x, z } : null;
  W.waypointMesh.visible = visible;
  if (visible) {
    W.waypointMesh.position.set(x, 0, z);
    const t = performance.now() / 1000;
    W.waypointMesh.children[1].position.y = 1 + Math.sin(t * 3) * 0.5;
    W.waypointMesh.children[1].scale.setScalar(1 + Math.sin(t * 3) * 0.08);
  }
}

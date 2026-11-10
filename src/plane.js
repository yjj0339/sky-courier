/**
 * 浮空岛快递 · 飞行器
 * 本地模型包加载 + 街机飞行物理 + 追尾镜头 + 推进尾迹
 */
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';

const MODEL_URL = new URL('../assets/models/coral-plane.glb', import.meta.url).href;

export const FLIGHT = {
  baseSpeed: 34,
  boostSpeed: 30,
  burstSpeed: 20,
  yawRate: 1.75,
  pitchRate: 1.25,
  maxPitch: 0.86,
  rollMax: 0.62,
  boostDrain: 0.44,
  boostRegen: 0.085,
  boostRingGain: 0.34,
  burstDecay: 9,
  minSpeed: 12,
};

export class Plane {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.scene.add(this.root);

    this.position = new THREE.Vector3(0, 20, 40);
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.speed = FLIGHT.baseSpeed;
    this.burst = 0;
    this.boost = 1;
    this.boosting = false;
    this.propeller = null;
    this.cargo = null;
    this.model = null;
    this.propSpin = 0;
    this.shake = 0;
    this._quat = new THREE.Quaternion();
    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._forward = new THREE.Vector3(0, 0, -1);
    this._tmp = new THREE.Vector3();
  }

  /** 加载本地模型包 */
  load() {
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        MODEL_URL,
        (gltf) => {
          this.model = gltf.scene;
          this.propeller = gltf.scene.getObjectByName('Propeller');
          this.cargo = gltf.scene.getObjectByName('Cargo');
          // 归一化尺寸：让机体长约 7.4 世界单位
          const box = new THREE.Box3().setFromObject(this.model);
          const size = box.getSize(new THREE.Vector3());
          const scale = 7.4 / Math.max(size.z, size.x * 0.62, 0.001);
          this.model.scale.setScalar(scale);
          this.model.position.set(0, 0, 0);
          this.root.add(this.model);
          resolve(gltf);
        },
        undefined,
        (err) => reject(err),
      );
    });
  }

  /** 设置是否携带快递包裹 */
  setCargoVisible(v) {
    if (this.cargo) this.cargo.visible = v;
  }

  reset(pos, yaw = 0) {
    this.position.copy(pos);
    this.yaw = yaw;
    this.pitch = 0;
    this.roll = 0;
    this.speed = FLIGHT.baseSpeed;
    this.burst = 0;
    this.boost = 1;
    this.shake = 0;
    this.root.position.copy(this.position);
    this._applyRotation();
  }

  _applyRotation() {
    this._euler.set(this.pitch, this.yaw, this.roll, 'YXZ');
    this.root.quaternion.setFromEuler(this._euler);
  }

  get forward() {
    return this._forward.set(0, 0, -1).applyQuaternion(this.root.quaternion);
  }

  get speedRatio() {
    return THREE.MathUtils.clamp(
      (this.speed - FLIGHT.baseSpeed * 0.4) / (FLIGHT.baseSpeed + FLIGHT.boostSpeed),
      0, 1,
    );
  }

  /**
   * @param {number} dt
   * @param {{pitch:number, yaw:number, boost:boolean}} input
   * @param {World} world
   * @returns {{crashed:boolean, crashIsland:object|null}}
   */
  update(dt, input, world) {
    const F = FLIGHT;
    const speedRatio = this.speedRatio;

    // ── 转向 ──
    const yawScale = 0.5 + 0.6 * speedRatio;
    this.yaw += input.yaw * F.yawRate * yawScale * dt;

    // ── 升降 ──
    this.pitch += input.pitch * F.pitchRate * dt;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -F.maxPitch, F.maxPitch);

    // ── 侧倾（视觉） ──
    const rollTarget = -input.yaw * F.rollMax * (0.45 + 0.55 * speedRatio);
    this.roll += (rollTarget - this.roll) * Math.min(1, dt * 6.5);

    // ── 推进能量 ──
    const wantsBoost = !!input.boost && this.boost > 0.02;
    this.boosting = wantsBoost;
    if (wantsBoost) {
      this.boost = Math.max(0, this.boost - F.boostDrain * dt);
    } else {
      this.boost = Math.min(1, this.boost + F.boostRegen * dt);
    }

    // ── 速度 ──
    this.burst = Math.max(0, this.burst - F.burstDecay * dt);
    let target = F.baseSpeed;
    if (wantsBoost) target += F.boostSpeed;
    target += this.burst;
    const accel = target > this.speed ? 2.6 : 1.9;
    this.speed += (target - this.speed) * Math.min(1, dt * accel);
    this.speed = Math.max(F.minSpeed, this.speed);

    this._applyRotation();

    // ── 位移 ──
    const fwd = this.forward.clone();
    this.position.addScaledVector(fwd, this.speed * dt);

    // ── 岛屿碰撞 ──
    let crashed = false;
    let crashIsland = null;
    if (world) {
      const hit = world.checkIslandCollision(this.position);
      if (hit) {
        crashed = true;
        crashIsland = hit;
        const dx = this.position.x - hit.center.x;
        const dz = this.position.z - hit.center.z;
        const d = Math.hypot(dx, dz) || 1;
        const push = hit.radius + 3.2;
        this.position.x = hit.center.x + (dx / d) * push;
        this.position.z = hit.center.z + (dz / d) * push;
        if (this.position.y < hit.topY + 3.5) this.position.y = hit.topY + 3.5;
        this.speed = Math.max(F.minSpeed, this.speed * 0.34);
        this.burst = 0;
        this.pitch *= 0.3;
        this.roll *= 0.3;
        this.shake = 1;
        this._applyRotation();
      }
    }

    // ── 高度边界 ──
    if (this.position.y < -55) { this.position.y = -55; this.pitch = Math.max(this.pitch, 0.12); }
    if (this.position.y > 320) { this.position.y = 320; this.pitch = Math.min(this.pitch, -0.12); }

    this.root.position.copy(this.position);

    // ── 螺旋桨 ──
    if (this.propeller) {
      this.propSpin += dt * (18 + this.speed * 1.1) * (wantsBoost ? 1.7 : 1);
      this.propeller.rotation.z = this.propSpin;
    }

    this.shake = Math.max(0, this.shake - dt * 2.4);

    return { crashed, crashIsland };
  }

  /** 穿过风环 */
  onRingPassed() {
    this.boost = Math.min(1, this.boost + FLIGHT.boostRingGain);
    this.burst = Math.min(FLIGHT.burstSpeed, this.burst + 12);
  }

  /** 送出快递后重新装载 */
  reloadCargo() {
    this.setCargoVisible(true);
  }

  /** 送达：包裹消失 */
  deliverCargo() {
    this.setCargoVisible(false);
  }
}

/**
 * 追尾镜头
 */
export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.offset = new THREE.Vector3(0, 4.7, 14.2);
    this.look = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._smoothed = new THREE.Vector3();
    this._init = false;
  }

  update(dt, plane, boostAmount = 0) {
    const yawQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, plane.yaw, 0, 'YXZ'));
    this._desired.copy(this.offset).applyQuaternion(yawQuat).add(plane.position);

    if (!this._init) {
      this._smoothed.copy(this._desired);
      this._init = true;
    } else {
      const k = 1 - Math.exp(-dt * 5.2);
      this._smoothed.lerp(this._desired, k);
    }

    this.camera.position.copy(this._smoothed);

    // 撞击抖动
    if (plane.shake > 0.001) {
      const s = plane.shake * plane.shake * 1.5;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
    }

    this.look.copy(plane.position).addScaledVector(plane.forward, 12).add(new THREE.Vector3(0, 1.6, 0));
    this.camera.lookAt(this.look);

    const targetFov = 62 + boostAmount * 11;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 4);
    this.camera.updateProjectionMatrix();
  }
}

/**
 * 推进尾迹（粒子点）
 */
export class BoostTrail {
  constructor(scene, count = 60) {
    this.count = count;
    this.points = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.points, 3));
    this.geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(count), 1));

    this.mat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 3.2,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.mesh = new THREE.Points(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.cursor = 0;
    this.timer = 0;
  }

  update(dt, plane, active) {
    this.timer += dt;
    if (active && this.timer > 0.028) {
      this.timer = 0;
      const i = this.cursor % this.count;
      this.cursor++;
      const p = plane.position.clone().addScaledVector(plane.forward, -2.6);
      this.points[i * 3] = p.x + (Math.random() - 0.5) * 0.9;
      this.points[i * 3 + 1] = p.y + (Math.random() - 0.5) * 0.9;
      this.points[i * 3 + 2] = p.z + (Math.random() - 0.5) * 0.9;
      this.life[i] = 1;
    }
    let alive = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] > 0) {
        this.life[i] -= dt * 1.9;
        alive++;
      }
    }
    this.mat.opacity = Math.min(0.5, 0.16 + alive / this.count);
    this.mat.size = 2.4 + (active ? 1.6 : 0);
    this.geo.attributes.position.needsUpdate = true;
  }
}

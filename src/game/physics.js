/**
 * 泡泡工坊 - 物理引擎封装 (Matter.js)
 * 管理物理世界、泡泡刚体创建、碰撞检测
 */
import Matter from 'matter-js'
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, PHYSICS,
  BUBBLE_LEVELS, BUBBLE_COLORS, DANGER_LINE_Y
} from './config.js'

const { Engine, Bodies, Body, Composite, Events, Vector } = Matter

class PhysicsWorld {
  constructor(customSettings = {}) {
    const gravity = customSettings.gravity || PHYSICS.gravity
    this.restitution = customSettings.restitution || PHYSICS.restitution
    this.friction = customSettings.friction || PHYSICS.friction
    this.frictionAir = customSettings.frictionAir || PHYSICS.frictionAir
    this.launchSpeed = customSettings.launchSpeed || 12

    this.engine = Engine.create({
      gravity: { x: 0, y: gravity },
    })
    this.world = this.engine.world
    this.bubbles = new Map() // id -> { body, colorIndex, level, isStatic }
    this.walls = []
    this.collisionQueue = [] // 待处理的碰撞事件
    this._setupWalls()
    this._setupCollision()
  }

  /** 创建边界墙壁 */
  _setupWalls() {
    const wallOptions = {
      isStatic: true,
      restitution: 0.3,
      friction: 0.1,
      render: { visible: false },
      label: 'wall',
    }
    const thickness = 40
    // 底部
    this.walls.push(Bodies.rectangle(
      CANVAS_WIDTH / 2, CANVAS_HEIGHT + thickness / 2,
      CANVAS_WIDTH + thickness * 2, thickness, wallOptions
    ))
    // 左侧
    this.walls.push(Bodies.rectangle(
      -thickness / 2, CANVAS_HEIGHT / 2,
      thickness, CANVAS_HEIGHT * 2, wallOptions
    ))
    // 右侧
    this.walls.push(Bodies.rectangle(
      CANVAS_WIDTH + thickness / 2, CANVAS_HEIGHT / 2,
      thickness, CANVAS_HEIGHT * 2, wallOptions
    ))
    Composite.add(this.world, this.walls)
  }

  /** 设置碰撞事件监听 */
  _setupCollision() {
    Events.on(this.engine, 'collisionStart', (event) => {
      for (const pair of event.pairs) {
        const { bodyA, bodyB } = pair
        const dataA = this.bubbles.get(bodyA.id)
        const dataB = this.bubbles.get(bodyB.id)
        if (dataA && dataB) {
          this.collisionQueue.push({
            bodyA, bodyB,
            dataA, dataB
          })
        }
      }
    })
  }

  /** 创建一个泡泡刚体 */
  createBubble(x, y, colorIndex, level = 1) {
    const radius = BUBBLE_LEVELS[level - 1].radius
    const body = Bodies.circle(x, y, radius, {
      restitution: this.restitution,
      friction: this.friction,
      frictionAir: this.frictionAir,
      density: PHYSICS.density * level * level,
      slop: PHYSICS.slop,
      label: 'bubble',
    })
    const data = { body, colorIndex, level }
    this.bubbles.set(body.id, data)
    Composite.add(this.world, body)
    return data
  }

  /** 发射泡泡（施加速度，大球更慢更重） */
  launchBubble(data, angle, overrideSpeed) {
    const speed = (overrideSpeed || this.launchSpeed) / Math.sqrt(data.level || 1)
    Body.setVelocity(data.body, {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
    })
  }

  /** 移除泡泡 */
  removeBubble(bodyId) {
    const data = this.bubbles.get(bodyId)
    if (data) {
      Composite.remove(this.world, data.body)
      this.bubbles.delete(bodyId)
    }
    return data
  }

  /** 移除所有泡泡 */
  clearBubbles() {
    for (const [id] of this.bubbles) {
      const data = this.bubbles.get(id)
      Composite.remove(this.world, data.body)
    }
    this.bubbles.clear()
  }

  /** 获取并清空碰撞队列 */
  drainCollisions() {
    const queue = this.collisionQueue.splice(0)
    this.collisionQueue = []
    return queue
  }

  /** 检查是否有泡泡超过警戒线 */
  checkDangerLine() {
    for (const [, data] of this.bubbles) {
      const { position } = data.body
      const radius = BUBBLE_LEVELS[data.level - 1].radius
      if (position.y - radius < DANGER_LINE_Y) {
        return data
      }
    }
    return null
  }

  /** 检查泡泡是否静止（速度很低） */
  isBubbleSettled(bodyId) {
    const data = this.bubbles.get(bodyId)
    if (!data) return false
    const speed = Vector.magnitude(data.body.velocity)
    return speed < 0.5
  }

  /** 获取泡泡数量 */
  get bubbleCount() {
    return this.bubbles.size
  }

  /** 获取所有泡泡数据 */
  getAllBubbles() {
    return [...this.bubbles.values()]
  }

  /** 更新物理世界 */
  update(dt) {
    Engine.update(this.engine, dt * 1000)
  }

  /** 重力反转（道具效果） */
  setGravityFlipped(flipped) {
    this.engine.gravity.y = flipped ? -PHYSICS.gravity : PHYSICS.gravity
  }

  /** 销毁 */
  destroy() {
    Events.off(this.engine, 'collisionStart')
    Engine.clear(this.engine)
  }
}

export default PhysicsWorld
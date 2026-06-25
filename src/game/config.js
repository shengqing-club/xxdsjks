/**
 * 泡泡工坊 - 游戏配置
 * V3: 删除限时模式，新增双彩虹融合、即时反馈系统
 */

// 泡泡颜色定义
export const BUBBLE_COLORS = [
  { name: 'red',    base: '#FF6B6B', light: '#FF8E8E', dark: '#E05555', glow: 'rgba(255,107,107,0.3)' },
  { name: 'blue',   base: '#4ECDC4', light: '#7EDDD7', dark: '#3AB5AD', glow: 'rgba(78,205,196,0.3)' },
  { name: 'yellow', base: '#FFE66D', light: '#FFF0A0', dark: '#E6CF55', glow: 'rgba(255,230,109,0.3)' },
  { name: 'green',  base: '#95E1A0', light: '#B5F0BE', dark: '#7ACC85', glow: 'rgba(149,225,160,0.3)' },
  { name: 'purple', base: '#C9B1FF', light: '#DDD0FF', dark: '#A88FEE', glow: 'rgba(201,177,255,0.3)' },
]

// 泡泡等级定义
export const BUBBLE_LEVELS = [
  { level: 1, name: '小泡泡',   radius: 18, score: 10 },
  { level: 2, name: '中泡泡',   radius: 27, score: 30 },
  { level: 3, name: '大泡泡',   radius: 36, score: 80 },
  { level: 4, name: '巨型泡泡', radius: 50, score: 200 },
  { level: 5, name: '彩虹泡泡', radius: 63, score: 500 },
]

// 彩虹泡泡 HSL 色相循环速度（度/秒）
export const RAINBOW_HUE_SPEED = 180

// 游戏画布尺寸
export const CANVAS_WIDTH = 400
export const CANVAS_HEIGHT = 700

// 警戒线 Y 坐标
export const DANGER_LINE_Y = 80

// 发射器位置
export const LAUNCHER_X = CANVAS_WIDTH / 2
export const LAUNCHER_Y = 50

// 发射速度
export const LAUNCH_SPEED = 12

// 物理参数
export const PHYSICS = {
  gravity: 1.2,
  restitution: 0.4,
  friction: 0.05,
  frictionAir: 0.01,
  density: 0.002,
  slop: 0.01,
}

// 道具类型
export const ITEM_TYPES = {
  RAINBOW_PIN: 'rainbow_pin',
  GRAVITY_FLIP: 'gravity_flip',
  PRECISE_AIM: 'precise_aim',
  COLOR_BOMB: 'color_bomb',
  COLOR_SWAP: 'color_swap',
  AREA_CLEAR: 'area_clear',
  FREEZE_BUBBLE: 'freeze_bubble',
  LIGHTNING_CHAIN: 'lightning_chain',
  TIME_STOP: 'time_stop',
  RAINBOW_BOMB: 'rainbow_bomb',
  SCREEN_CLEAR: 'screen_clear',
}

// ===== V3 道具商店定义 =====
export const ITEM_SHOP = [
  // 普通
  { id: 'color_swap',     name: '颜色转换',   tier: 'common',    price: 100,  desc: '将当前发射泡泡变为指定颜色', icon: '🎨' },
  { id: 'precise_aim',    name: '精准瞄准',   tier: 'common',    price: 200,  desc: '延长瞄准线至300px，持续10秒', icon: '🎯' },
  { id: 'rainbow_pin',    name: '彩虹针',     tier: 'common',    price: 300,  desc: '消除所有同色泡泡', icon: '📌' },
  // 稀有
  { id: 'gravity_flip',   name: '重力反转',   tier: 'rare',      price: 500,  desc: '所有泡泡向上漂浮5秒', icon: '🔄' },
  { id: 'color_bomb',     name: '颜色炸弹',   tier: 'rare',      price: 800,  desc: '随机消除3种颜色所有泡泡', icon: '💣' },
  { id: 'area_clear',     name: '区域清除',   tier: 'rare',      price: 1000, desc: '清除点击位置120px半径区域', icon: '💥' },
  // 史诗
  { id: 'freeze_bubble',  name: '冰冻泡泡',   tier: 'epic',      price: 1500, desc: '下一发射泡泡冻结周围80px，3秒', icon: '❄️' },
  { id: 'lightning_chain',name: '闪电链',     tier: 'epic',      price: 2000, desc: '消除一个泡泡后连锁清除相邻同色', icon: '⚡' },
  { id: 'time_stop',      name: '时间停止',   tier: 'epic',      price: 3000, desc: '暂停警戒线和倒计时8秒', icon: '⏸️' },
  // 传说
  { id: 'rainbow_bomb',   name: '彩虹炸弹',   tier: 'legendary', price: 5000, desc: '所有L4泡泡升级为彩虹泡泡并触发融合', icon: '🌈' },
  { id: 'screen_clear',   name: '全屏清除',   tier: 'legendary', price: 10000,desc: '消除场上所有泡泡，分数照常计算', icon: '✨' },
]

// 道具稀有度颜色
export const TIER_COLORS = {
  common: '#A0A0A0',
  rare: '#4ECDC4',
  epic: '#C9B1FF',
  legendary: '#FFB800',
}

// ===== V3 怪物定义 =====
export const MONSTER_TYPES = {
  slime:   { name: '史莱姆',   icon: '🟢', hp: 500,   speed: 0.3, goldMin: 50,  goldMax: 100,  color: '#7BC67E' },
  goblin:  { name: '哥布林',   icon: '🟣', hp: 1500,  speed: 0.5, goldMin: 150, goldMax: 300,  color: '#C9B1FF' },
  wyrm:    { name: '幼龙',     icon: '🐉', hp: 4000,  speed: 0.4, goldMin: 400, goldMax: 800,  color: '#FF9F43' },
  boss:    { name: 'BOSS·巨龙',icon: '👑', hp: 15000, speed: 0.3, goldMin: 2000,goldMax: 5000, color: '#FF6B6B' },
}

// ===== V3 副本波次配置 =====
export const DUNGEON_WAVES = [
  { wave: 1,  monster: 'slime',  count: 1, hpMult: 1.0, goldMult: 1.0, special: null },
  { wave: 2,  monster: 'slime',  count: 1, hpMult: 1.2, goldMult: 1.0, special: null },
  { wave: 3,  monster: 'slime',  count: 2, hpMult: 1.0, goldMult: 1.0, special: null },
  { wave: 4,  monster: 'goblin', count: 1, hpMult: 1.0, goldMult: 1.0, special: 'speed_up' },
  { wave: 5,  monster: 'goblin', count: 1, hpMult: 1.3, goldMult: 1.1, special: 'speed_up' },
  { wave: 6,  monster: 'goblin', count: 2, hpMult: 1.0, goldMult: 1.0, special: 'speed_up' },
  { wave: 7,  monster: 'goblin', count: 2, hpMult: 1.2, goldMult: 1.1, special: 'speed_up' },
  { wave: 8,  monster: 'wyrm',   count: 1, hpMult: 1.0, goldMult: 1.0, special: 'sprint' },
  { wave: 9,  monster: 'wyrm',   count: 1, hpMult: 1.3, goldMult: 1.1, special: 'sprint' },
  { wave: 10, monster: 'wyrm',   count: 1, hpMult: 1.6, goldMult: 1.2, special: 'sprint' },
  { wave: 11, monster: 'wyrm',   count: 1, hpMult: 1.9, goldMult: 1.3, special: 'sprint' },
  { wave: 12, monster: 'wyrm',   count: 1, hpMult: 2.2, goldMult: 1.4, special: 'sprint' },
  { wave: 13, monster: 'wyrm',   count: 2, hpMult: 1.5, goldMult: 1.2, special: 'sprint' },
  { wave: 14, monster: 'wyrm',   count: 2, hpMult: 1.8, goldMult: 1.3, special: 'sprint' },
  { wave: 15, monster: 'boss',   count: 1, hpMult: 1.0, goldMult: 1.0, special: 'boss' },
]

// 游戏模式
export const GAME_MODES = {
  CLASSIC: 'classic',
  ZEN: 'zen',
  RANKED: 'ranked',
  DUNGEON: 'dungeon',
}

// 游戏状态
export const GAME_STATES = {
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game_over',
  DUNGEON_CLEAR: 'dungeon_clear',
}

// 连锁倍率
export const CHAIN_MULTIPLIERS = [1, 1.5, 2, 3, 5, 8]

// 粒子配置
export const PARTICLE_CONFIG = {
  maxParticles: 500,
  burstCount: 15,
  burstSpeed: 6,
  lifetime: 0.8,
  gravity: 0.15,
}

// ===== V3: 彩虹融合配置 =====
export const FUSION_CONFIG = {
  radius: 150,
  particleCount: 120,
  baseDamage: 2000,
  extraDamagePerBubble: 100,
  fusionBaseScore: 1000,
  fusionBonusPerBubble: 100,
  shakeAmount: 20,
  glowDuration: 1.5,
  waveDuration: 0.5,
}

// ===== V3: 双彩虹融合配置（两个彩虹泡泡碰撞） =====
export const DOUBLE_RAINBOW_FUSION = {
  radius: 250,
  particleCount: 300,
  baseDamage: 8000,
  extraDamagePerBubble: 300,
  fusionBaseScore: 5000,
  fusionBonusPerBubble: 300,
  shakeAmount: 35,
  glowDuration: 2.5,
  screenFlashDuration: 0.8,
  waveCount: 3,
  slowMoDuration: 0.6,
}

// ===== V3: 即时反馈配置 =====
export const FEEDBACK_CONFIG = {
  // 合成闪光
  mergeFlashLifetime: 0.4,
  mergeFlashScale: 0.3,
  // 分数飘字
  scoreTextLifetime: 1.0,
  scoreTextSpeed: 1.8,
  // 屏幕震动
  shakeDecay: 0.85,
  shakeThreshold: 0.1,
  // 连锁脉冲
  chainPulseColors: ['#FFE66D', '#FF9F43', '#FF6B6B', '#C9B1FF', null],
  // 分数弹出动画
  popInDuration: 0.15,
  popInScale: 1.3,
  // combo 文字
  comboTextLifetime: 2.0,
  comboTextRise: 60,
}

// ===== V3: 里程碑配置 =====
export const MILESTONES = [
  { score: 500,  text: '不错！',       color: '#4ECDC4' },
  { score: 1000, text: '太棒了！',     color: '#95E1A0' },
  { score: 2000, text: '势不可挡！',   color: '#FFE66D' },
  { score: 5000, text: '无人能挡！',   color: '#FF6B6B' },
  { score: 10000, text: '泡泡大师！',  color: null },
  { score: 20000, text: '传奇降临！',  color: '#FFB800' },
  { score: 50000, text: '神之一手！',  color: null },
]
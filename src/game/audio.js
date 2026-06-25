/**
 * 泡泡工坊 V3 - 音效系统
 * 原始 Web Audio 程序化合成（还原碰撞/发射音效）+ V3 双彩虹/副本/道具音效
 */
class AudioSystem {
  constructor() {
    this.ctx = null
    this.enabled = true
    this.volume = 0.5
    this.masterGain = null
    this._initialized = false
    this._monsterHitOsc = false
  }

  init() {
    if (this._initialized) return
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = this.volume
      this.masterGain.connect(this.ctx.destination)
      this._initialized = true
    } catch (e) {
      console.warn('Web Audio API 不可用:', e)
      this.enabled = false
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
  }

  isInitialized() { return this._initialized }

  /** 创建一个振荡器音符 */
  _playTone(freq, duration, type = 'sine', gainValue = 0.3, delay = 0) {
    if (!this.enabled || !this.ctx) return
    const now = this.ctx.currentTime + delay
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    gain.gain.setValueAtTime(gainValue, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    osc.connect(gain)
    gain.connect(this.masterGain)
    osc.start(now)
    osc.stop(now + duration)
  }

  /** 创建噪声（用于碰撞质感） */
  _playNoise(duration, gainValue = 0.1, delay = 0) {
    if (!this.enabled || !this.ctx) return
    const now = this.ctx.currentTime + delay
    const bufferSize = this.ctx.sampleRate * duration
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.5
    }
    const source = this.ctx.createBufferSource()
    source.buffer = buffer
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(gainValue, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 2000
    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain)
    source.start(now)
    source.stop(now + duration)
  }

  // ===== 原始音效（还原自 bubble-workshop） =====

  /** 发射音效 - 轻柔的"啵"声 + 气流噪声 */
  playLaunch() {
    this._playTone(440, 0.15, 'sine', 0.2)
    this._playNoise(0.08, 0.05)
  }

  /** 碰撞音效 - 橡胶弹跳声，音高随泡泡大小变化 */
  playBounce(level = 1) {
    const freq = 600 - (level - 1) * 80
    this._playTone(Math.max(freq, 200), 0.1, 'triangle', 0.15)
    this._playNoise(0.05, 0.03)
  }

  /** 合成音效 - 三个上升音符 */
  playMerge(level = 1) {
    const baseFreq = 400 + (level - 1) * 100
    this._playTone(baseFreq, 0.2, 'sine', 0.25)
    this._playTone(baseFreq * 1.25, 0.25, 'sine', 0.2, 0.08)
    this._playTone(baseFreq * 1.5, 0.3, 'sine', 0.15, 0.16)
  }

  /** 经典彩虹消除音效 - C5/E5/G5/C6 和弦 + 风铃尾音 */
  playFusion() {
    const notes = [523, 659, 784, 1047] // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      this._playTone(freq, 0.8, 'sine', 0.2, i * 0.05)
      this._playTone(freq * 2, 0.6, 'triangle', 0.08, i * 0.05 + 0.1)
    })
    // 风铃尾音
    this._playTone(2093, 1.2, 'sine', 0.06, 0.3)
    this._playTone(2637, 1.0, 'sine', 0.04, 0.4)
  }

  /** 连锁音效 - 递增音阶 */
  playChain(chainCount = 1) {
    const baseFreq = 500 + chainCount * 100
    this._playTone(baseFreq, 0.3, 'sine', 0.2)
    this._playTone(baseFreq * 1.5, 0.4, 'triangle', 0.1, 0.05)
  }

  /** 游戏结束音效 - 下行三音阶 */
  playGameOver() {
    this._playTone(440, 0.5, 'sine', 0.2)
    this._playTone(349, 0.6, 'sine', 0.15, 0.2)
    this._playTone(262, 0.8, 'sine', 0.1, 0.4)
  }

  /** 按钮点击音效 */
  playClick() {
    this._playTone(800, 0.08, 'sine', 0.1)
  }

  /** 道具使用音效 */
  playItemUse() {
    this._playTone(600, 0.15, 'triangle', 0.2)
    this._playTone(900, 0.2, 'sine', 0.15, 0.1)
    this._playTone(1200, 0.25, 'sine', 0.1, 0.2)
  }

  /** 里程碑音效 */
  playMilestone(level) {
    const f = 600 + level * 100
    this._playTone(f, 0.2, 'sine', 0.4)
    setTimeout(() => this._playTone(f * 1.25, 0.2, 'sine', 0.35), 150)
    setTimeout(() => this._playTone(f * 1.5, 0.3, 'sine', 0.35), 300)
  }

  // ===== V3: 双彩虹融合音效 =====
  playDoubleFusion() {
    const ctx = this.ctx
    if (!ctx || !this.enabled) return
    const t = ctx.currentTime
    // 震撼低音
    const osc1 = ctx.createOscillator()
    osc1.type = 'sawtooth'; osc1.frequency.value = 55
    const g1 = ctx.createGain()
    g1.gain.setValueAtTime(0.5, t)
    g1.gain.exponentialRampToValueAtTime(0.4, t + 0.3)
    g1.gain.exponentialRampToValueAtTime(0.001, t + 1.0)
    osc1.connect(g1); g1.connect(this.masterGain)
    osc1.start(t); osc1.stop(t + 1.0)
    // 上升音阶（修复参数顺序：freq, duration, type, gainValue, delay）
    const notes = [262, 330, 392, 523, 659, 784, 1047]
    for (let i = 0; i < notes.length; i++) {
      setTimeout(() => this._playTone(notes[i], 0.3, 'sine', 0.15), i * 50)
    }
    // 英雄和弦
    setTimeout(() => {
      this._playTone(1047, 0.6, 'sine', 0.2)
      this._playTone(1318, 0.6, 'sine', 0.15)
      this._playTone(1568, 0.6, 'sine', 0.15)
    }, 350)
    // 风铃爆炸
    setTimeout(() => {
      for (let i = 0; i < 8; i++) {
        setTimeout(() => this._playTone(1200 + Math.random() * 800, 0.3, 'sine', 0.1), i * 30)
      }
    }, 700)
  }

  // ===== V3: 副本音效 =====
  playMonsterHit() {
    if (!this._monsterHitOsc) {
      this._monsterHitOsc = true
      this._playTone(100, 0.1, 'sawtooth', 0.2)
      setTimeout(() => { this._monsterHitOsc = false }, 100)
    }
  }
  playMonsterDie() {
    this._playTone(200, 0.15, 'sawtooth', 0.3)
    setTimeout(() => this._playTone(150, 0.15, 'sawtooth', 0.25), 100)
    setTimeout(() => this._playTone(100, 0.2, 'sawtooth', 0.2), 200)
  }
  playCoinDrop() {
    this._playTone(2000, 0.05, 'sine', 0.15)
    setTimeout(() => this._playTone(2400, 0.05, 'sine', 0.15), 60)
  }

  // ===== V3: 即时反馈音效 =====
  playComboText() { this._playTone(800, 0.08, 'sine', 0.2) }
  playScorePop() { this._playTone(1000, 0.04, 'sine', 0.1) }
}

const audio = new AudioSystem()
export default audio
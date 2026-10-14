import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type MirrorTheme = 'versailles' | 'carnival_funhouse' | 'cyber_prism';

interface ThemePalette {
  name: string;
  bgTop: string;
  bgMid: string;
  floorTop: string;
  floorBottom: string;
  frameColor: string;
  accent: string;
}

const THEMES: Record<MirrorTheme, ThemePalette> = {
  versailles: {
    name: 'Versailles Gallery',
    bgTop: '#0f172a',
    bgMid: '#1e1b4b',
    floorTop: '#312e81',
    floorBottom: '#0f172a',
    frameColor: '#facc15',
    accent: '#38bdf8',
  },
  carnival_funhouse: {
    name: 'Neon Funhouse Mirrors',
    bgTop: '#1f0836',
    bgMid: '#3b0764',
    floorTop: '#4c1d95',
    floorBottom: '#18042c',
    frameColor: '#f472b6',
    accent: '#facc15',
  },
  cyber_prism: {
    name: 'Holographic Prism Hall',
    bgTop: '#041421',
    bgMid: '#082f49',
    floorTop: '#0c4a6e',
    floorBottom: '#020617',
    frameColor: '#22d3ee',
    accent: '#a855f7',
  },
};

const THEME_ORDER: MirrorTheme[] = ['versailles', 'carnival_funhouse', 'cyber_prism'];

type MirrorStateType = 'calm' | 'impostor' | 'royal_crown' | 'trap_bomb';

interface GalleryMirror {
  index: number;
  x: number;
  y: number;
  w: number;
  h: number;
  state: MirrorStateType;
  stateTimer: number;
  shatterTimer: number;
  posePhase: number;
}

interface MirrorShardPickup {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gold: boolean;
  active: boolean;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

interface MirrorHunter {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  moveDir: number;
  swingAnim: number;
  stunTimer: number;
  charging: boolean;
  charge: number;
  overchargeLockout: number;
  score: number;
  combo: number;
  lastTapTime: number;
  isUnderdog: boolean;
  botTargetX: number;
  botShouldSwing: boolean;
  botShouldHold: boolean;
}

export class PhantomMirrorGazeGame extends BaseGame {
  private hunters: Map<PlayerId, MirrorHunter> = new Map();
  private mirrors: GalleryMirror[] = [];
  private shards: MirrorShardPickup[] = [];
  private floatingTexts: FloatingText[] = [];
  private nextShardId: number = 1;
  private theme: MirrorTheme = 'versailles';
  private animTime: number = 0;
  private screenShake: number = 0;
  private suddenDeathAlerted: boolean = false;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 45.0;
  }

  private triggerScreenShake(amt: number): void {
    this.screenShake = Math.max(this.screenShake, amt);
  }

  public init(width: number, height: number): void {
    this.theme = THEME_ORDER[Math.floor(Math.random() * THEME_ORDER.length)];
    this.reset(width, height);

    if (!this.keyHandler && typeof window !== 'undefined') {
      this.keyHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          const idx = (THEME_ORDER.indexOf(this.theme) + 1) % THEME_ORDER.length;
          this.theme = THEME_ORDER[idx];
          this.audio.playTap();
        } else if (e.key === '1') {
          this.theme = 'versailles';
          this.audio.playTap();
        } else if (e.key === '2') {
          this.theme = 'carnival_funhouse';
          this.audio.playTap();
        } else if (e.key === '3') {
          this.theme = 'cyber_prism';
          this.audio.playTap();
        }
      };
      window.addEventListener('keydown', this.keyHandler);
    }
  }

  public override destroy(): void {
    if (this.keyHandler && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    super.destroy();
  }

  public handlePointerDown(x: number, y: number, _width: number, height: number): void {
    if (x >= 20 && x <= 190 && y >= height - 44 && y <= height - 12) {
      const idx = (THEME_ORDER.indexOf(this.theme) + 1) % THEME_ORDER.length;
      this.theme = THEME_ORDER[idx];
      this.audio.playTap();
    }
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45.0;
    this.animTime = 0;
    this.screenShake = 0;
    this.suddenDeathAlerted = false;
    this.hunters.clear();
    this.mirrors = [];
    this.shards = [];
    this.floatingTexts = [];
    this.botReactionTimers.clear();

    // Create 5 Grand Ornate Mirrors across the gallery wall
    const mirrorCount = 5;
    const marginX = 95;
    const span = width - marginX * 2;
    const mirrorY = height * 0.41;

    for (let i = 0; i < mirrorCount; i++) {
      const mx = marginX + (span * (i + 0.5)) / mirrorCount;
      const initialState: MirrorStateType =
        i === 1 || i === 3 ? 'impostor' : i === 2 ? 'royal_crown' : 'calm';
      this.mirrors.push({
        index: i,
        x: mx,
        y: mirrorY,
        w: 108,
        h: 162,
        state: initialState,
        stateTimer: initialState === 'calm' ? 0.6 + Math.random() * 0.9 : 2.8 + Math.random() * 1.2,
        shatterTimer: 0,
        posePhase: Math.random() * Math.PI * 2,
      });
    }

    const active = this.getActivePlayers();
    const count = Math.max(active.length, 1);
    const floorY = height * 0.68;

    active.forEach((p, idx) => {
      const startX = 140 + ((width - 280) * (idx + 0.5)) / count;
      this.hunters.set(p.id, {
        id: p.id,
        x: startX,
        y: floorY,
        vx: 0,
        moveDir: idx % 2 === 0 ? 1 : -1,
        swingAnim: 0,
        stunTimer: 0,
        charging: false,
        charge: 0,
        overchargeLockout: 0,
        score: 0,
        combo: 1,
        lastTapTime: -10,
        isUnderdog: false,
        botTargetX: startX,
        botShouldSwing: false,
        botShouldHold: false,
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  private addFloatingText(x: number, y: number, text: string, color: string): void {
    this.floatingTexts.push({ x, y, text, color, alpha: 1.35, vy: -28 });
  }

  private spawnShards(x: number, y: number, count: number, goldChance: number = 0.35): void {
    for (let i = 0; i < count; i++) {
      if (this.shards.filter((s) => s.active).length >= 10) break;
      this.shards.push({
        id: this.nextShardId++,
        x: x + (Math.random() - 0.5) * 30,
        y: y + 10,
        vx: (Math.random() - 0.5) * 210,
        vy: -130 - Math.random() * 90,
        gold: Math.random() < goldChance,
        active: true,
      });
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    const clampedDt = Math.min(dt, 0.05);
    this.animTime += clampedDt;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - clampedDt * 28);
    }

    this.roundTimer = Math.max(0, this.roundTimer - clampedDt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    const isSuddenDeath = this.roundTimer <= 12.0;
    if (isSuddenDeath && !this.suddenDeathAlerted) {
      this.suddenDeathAlerted = true;
      this.audio.playFanfare();
      this.triggerScreenShake(9);
      this.addFloatingText(
        width * 0.5,
        104,
        '🪞 HALL OF ILLUSIONS OVERDRIVE! 2X SHATTER POINTS! 🪞',
        '#facc15'
      );
    }

    const sdMult = isSuddenDeath ? 2 : 1;
    const floorY = height * 0.68;

    // Underdog Calculation
    let maxScore = 0;
    this.hunters.forEach((h) => {
      if (h.score > maxScore) maxScore = h.score;
    });
    this.hunters.forEach((h) => {
      h.isUnderdog = maxScore - h.score >= 110;
    });

    // Update Mirrors along the Gallery Wall
    for (const m of this.mirrors) {
      m.posePhase += clampedDt * 5.0;
      if (m.shatterTimer > 0) {
        m.shatterTimer = Math.max(0, m.shatterTimer - clampedDt);
      }

      m.stateTimer -= clampedDt;
      if (m.stateTimer <= 0) {
        if (m.state === 'calm') {
          // Activate a mirror anomaly!
          const roll = Math.random();
          if (roll < 0.55) {
            m.state = 'impostor';
            m.stateTimer = isSuddenDeath ? 2.4 : 3.2;
          } else if (roll < 0.82) {
            m.state = 'royal_crown';
            m.stateTimer = 2.8;
          } else {
            m.state = 'trap_bomb';
            m.stateTimer = 2.0;
          }
          this.audio.playWhoosh();
        } else {
          // State expired naturally
          if (m.state === 'trap_bomb') {
            // Trap mirror detonates outward, stunning anyone standing right in front of it!
            m.shatterTimer = 0.6;
            this.audio.playExplosion();
            this.particles.spawnExplosion(m.x, m.y + 40, '#ef4444', 18);
            this.hunters.forEach((h) => {
              if (Math.abs(h.x - m.x) < 62 && h.stunTimer <= 0) {
                h.stunTimer = 0.85;
                h.combo = 1;
                h.score = Math.max(0, h.score - 15);
                h.vx = (h.x >= m.x ? 1 : -1) * 240;
                this.addFloatingText(h.x, h.y - 42, 'TRAP MIRROR BLAST! -15', '#ef4444');
              }
            });
          }
          m.state = 'calm';
          m.stateTimer = (isSuddenDeath ? 0.45 : 0.85) + Math.random() * 0.7;
        }
      }
    }

    // Ensure at least 2 active Impostor or Royal Crown mirrors at all times so there's zero dead time
    const activeAnomalyCount = this.mirrors.filter((m) => m.state !== 'calm').length;
    if (activeAnomalyCount < 2) {
      const calmMirrors = this.mirrors.filter((m) => m.state === 'calm');
      if (calmMirrors.length > 0) {
        const pick = calmMirrors[Math.floor(Math.random() * calmMirrors.length)];
        pick.state = Math.random() < 0.7 ? 'impostor' : 'royal_crown';
        pick.stateTimer = 3.0;
      }
    }

    this.updateBots(clampedDt, width, height);

    // Update Hunters
    this.hunters.forEach((h) => {
      const p = this.getPlayer(h.id);
      if (!p) return;

      if (h.swingAnim > 0) h.swingAnim = Math.max(0, h.swingAnim - clampedDt * 3.5);
      if (h.overchargeLockout > 0) h.overchargeLockout = Math.max(0, h.overchargeLockout - clampedDt);

      if (h.stunTimer > 0) {
        h.stunTimer = Math.max(0, h.stunTimer - clampedDt);
        h.charging = false;
        h.charge = 0;
        h.vx *= Math.pow(0.08, clampedDt);
        h.x = Math.max(70, Math.min(width - 70, h.x + h.vx * clampedDt));
        return;
      }

      const speedMult = h.isUnderdog ? 1.2 : 1.0;
      const isBot = p.type.startsWith('bot_');

      if (!isBot) {
        const steer = this.input.getSteer(h.id);
        const holding = this.input.isActionPressed(h.id) || this.input.isPressed(h.id);
        const justPressed = this.input.justPressed(h.id) || this.input.justAction(h.id);
        const released = this.input.justReleased(h.id);

        if (Math.abs(steer) > 0.12) {
          h.moveDir = steer >= 0 ? 1 : -1;
          h.vx += steer * 780 * speedMult * clampedDt;
        } else {
          // Single-button / patrol accessibility: glide smoothly across the gallery
          h.vx += h.moveDir * 270 * speedMult * clampedDt;
        }

        if (justPressed) {
          if (this.animTime - h.lastTapTime < 0.26) {
            h.moveDir *= -1;
          }
          h.lastTapTime = this.animTime;
          this.swingSilverMallet(h, p.color, sdMult);
          if (h.overchargeLockout <= 0) {
            h.charging = true;
            h.charge = 0;
          }
        }

        if (holding && h.charging && h.overchargeLockout <= 0) {
          h.charge += clampedDt * 0.88;
          if (h.charge >= 1.0) {
            h.charging = false;
            h.charge = 0;
            h.overchargeLockout = 0.85;
            h.stunTimer = 0.65;
            this.audio.playStun();
            this.addFloatingText(h.x, h.y - 44, 'PRISM OVERLOAD!', '#ef4444');
          }
        } else if (released && h.charging) {
          if (h.charge >= 0.72 && h.charge <= 0.98) {
            this.firePrismShockwave(h, p.color, sdMult);
          }
          h.charging = false;
          h.charge = 0;
        } else if (!holding) {
          h.charging = false;
          h.charge = Math.max(0, h.charge - clampedDt * 2.5);
        }
      } else {
        // Bot execution
        const dx = h.botTargetX - h.x;
        if (Math.abs(dx) > 12) {
          h.moveDir = Math.sign(dx);
          h.vx += h.moveDir * 720 * speedMult * clampedDt;
        }
        if (h.botShouldSwing) {
          h.botShouldSwing = false;
          this.swingSilverMallet(h, p.color, sdMult);
        }
        if (h.botShouldHold && h.overchargeLockout <= 0) {
          h.charging = true;
          h.charge += clampedDt * 0.85;
          if (h.charge >= 0.82) {
            this.firePrismShockwave(h, p.color, sdMult);
            h.charging = false;
            h.charge = 0;
            h.botShouldHold = false;
          }
        } else {
          h.charging = false;
          h.charge = Math.max(0, h.charge - clampedDt * 2.0);
        }
      }

      const maxVx = (h.charging ? 220 : 340) * speedMult;
      h.vx = Math.max(-maxVx, Math.min(maxVx, h.vx));
      h.vx *= Math.pow(0.16, clampedDt);
      h.x += h.vx * clampedDt;

      if (h.x < 75) {
        h.x = 75;
        h.moveDir = 1;
        h.vx = Math.abs(h.vx) * 0.65;
      } else if (h.x > width - 75) {
        h.x = width - 75;
        h.moveDir = -1;
        h.vx = -Math.abs(h.vx) * 0.65;
      }

      // Passive Royal Crown Blessing if standing directly in front of a Royal Crown Mirror!
      for (const m of this.mirrors) {
        if (m.state === 'royal_crown' && Math.abs(h.x - m.x) < 44) {
          const pts = 30 * sdMult;
          h.score += pts;
          h.combo = Math.min(6, h.combo + 1);
          m.state = 'calm';
          m.stateTimer = 0.8;
          this.audio.playScore();
          this.particles.spawnSparks(m.x, m.y, '#facc15', 16);
          this.addFloatingText(m.x, m.y - 30, `+${pts} ROYAL BLESSING! (${h.combo}x)`, '#facc15');
        }
      }
    });

    // Elastic Hunter-to-Hunter Collisions on the Gallery Floor
    const hunterList = Array.from(this.hunters.values());
    for (let i = 0; i < hunterList.length; i++) {
      for (let j = i + 1; j < hunterList.length; j++) {
        const a = hunterList[i];
        const b = hunterList[j];
        const dx = b.x - a.x;
        const minDist = 46;
        if (Math.abs(dx) < minDist) {
          const sign = dx >= 0 ? 1 : -1;
          const overlap = minDist - Math.abs(dx);
          a.x -= sign * overlap * 0.5;
          b.x += sign * overlap * 0.5;

          const va = a.vx;
          const vb = b.vx;
          a.vx = vb * (b.isUnderdog ? 1.35 : 1.1) - sign * 165;
          b.vx = va * (a.isUnderdog ? 1.35 : 1.1) + sign * 165;
          a.moveDir = Math.sign(a.vx) || -1;
          b.moveDir = Math.sign(b.vx) || 1;

          this.audio.playBounce();
          this.triggerScreenShake(4);
          this.particles.spawnSparks((a.x + b.x) * 0.5, floorY, '#ffffff', 10);
        }
      }
    }

    // Update Loose Mirror Shard Pickups on the Floor
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const sh = this.shards[i];
      if (!sh.active) {
        this.shards.splice(i, 1);
        continue;
      }
      sh.x += sh.vx * clampedDt;
      sh.y += sh.vy * clampedDt;
      sh.vy += 420 * clampedDt;
      if (sh.y >= floorY + 8) {
        sh.y = floorY + 8;
        sh.vy = 0;
        sh.vx *= Math.pow(0.05, clampedDt);
      }
      if (sh.x < 60 || sh.x > width - 60) {
        sh.vx *= -0.7;
        sh.x = Math.max(60, Math.min(width - 60, sh.x));
      }

      this.hunters.forEach((h) => {
        if (!sh.active || h.stunTimer > 0) return;
        if (Math.abs(h.x - sh.x) < 34 && Math.abs(h.y - sh.y) < 38) {
          sh.active = false;
          const pts = (sh.gold ? 25 : 14) * sdMult;
          h.score += pts;
          this.audio.playCoin();
          this.particles.spawnSparks(sh.x, sh.y, sh.gold ? '#facc15' : '#38bdf8', 10);
          this.addFloatingText(
            sh.x,
            sh.y - 24,
            sh.gold ? `+${pts} GOLDEN PRISM!` : `+${pts} SHARD`,
            sh.gold ? '#facc15' : '#38bdf8'
          );
        }
      });
    }

    // Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * clampedDt;
      ft.alpha -= clampedDt * 0.95;
      if (ft.alpha <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  private swingSilverMallet(h: MirrorHunter, color: string, sdMult: number): void {
    h.swingAnim = 1.0;
    this.audio.playTap();

    // Find closest mirror within hammer reach
    let targetMirror: GalleryMirror | null = null;
    let bestDist = 72;
    for (const m of this.mirrors) {
      const d = Math.abs(h.x - m.x);
      if (d < bestDist) {
        bestDist = d;
        targetMirror = m;
      }
    }

    if (!targetMirror) return;

    if (targetMirror.state === 'impostor') {
      const pts = (40 + h.combo * 5) * sdMult;
      h.score += pts;
      h.combo = Math.min(6, h.combo + 1);
      targetMirror.state = 'calm';
      targetMirror.stateTimer = 0.75;
      targetMirror.shatterTimer = 0.65;
      this.audio.playExplosion();
      this.audio.playScore();
      this.triggerScreenShake(7);
      this.particles.spawnExplosion(targetMirror.x, targetMirror.y, '#a855f7', 22);
      this.spawnShards(targetMirror.x, targetMirror.y + 30, 3, 0.45);
      this.addFloatingText(
        targetMirror.x,
        targetMirror.y - 36,
        `+${pts} PHANTOM SHATTERED! (${h.combo}x)`,
        color
      );
    } else if (targetMirror.state === 'trap_bomb') {
      // Defused trap bomb mirror with hammer strike? No, hitting a bomb mirror triggers it unless charging prism!
      h.score = Math.max(0, h.score - 15);
      h.stunTimer = 0.75;
      h.combo = 1;
      targetMirror.state = 'calm';
      targetMirror.stateTimer = 0.9;
      targetMirror.shatterTimer = 0.65;
      this.audio.playExplosion();
      this.triggerScreenShake(8);
      this.particles.spawnExplosion(targetMirror.x, targetMirror.y, '#ef4444', 20);
      this.addFloatingText(targetMirror.x, targetMirror.y - 36, 'BOMB MIRROR! -15', '#ef4444');
    }
  }

  private firePrismShockwave(h: MirrorHunter, color: string, sdMult: number): void {
    h.swingAnim = 1.0;
    const baseBonus = 50 * sdMult;
    h.score += baseBonus;
    this.audio.playScore();
    this.triggerScreenShake(9);
    this.particles.spawnExplosion(h.x, h.y - 20, '#38bdf8', 24);
    this.addFloatingText(h.x, h.y - 48, `+${baseBonus} PRISM SHATTER WAVE!`, '#facc15');

    // Shatter all Impostor or Trap Bomb mirrors within 190px safely!
    for (const m of this.mirrors) {
      if (Math.abs(m.x - h.x) <= 190 && (m.state === 'impostor' || m.state === 'trap_bomb')) {
        const pts = 45 * sdMult;
        h.score += pts;
        h.combo = Math.min(6, h.combo + 1);
        m.state = 'calm';
        m.stateTimer = 0.85;
        m.shatterTimer = 0.7;
        this.particles.spawnExplosion(m.x, m.y, '#facc15', 20);
        this.spawnShards(m.x, m.y + 30, 2, 0.6);
        this.addFloatingText(m.x, m.y - 44, `+${pts} PRISM BANISH!`, '#facc15');
      }
    }

    // Mirror Shockwave Shunt against nearby rivals!
    this.hunters.forEach((other) => {
      if (other.id === h.id) return;
      const dx = other.x - h.x;
      if (Math.abs(dx) <= 175) {
        const pushSign = dx >= 0 ? 1 : -1;
        other.vx = pushSign * 320;
        other.stunTimer = Math.max(other.stunTimer, 0.75);
        const shuntPts = 45 * sdMult;
        h.score += shuntPts;
        this.audio.playBounce();
        this.particles.spawnExplosion(other.x, other.y, color, 18);
        this.addFloatingText(other.x, other.y - 36, `+${shuntPts} MIRROR WAVE SHUNT!`, color);
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const h = this.hunters.get(botId);
    if (!h || h.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) ?? 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const reactDelay =
      difficulty === 'bot_hard' ? 0.11 : difficulty === 'bot_normal' ? 0.23 : 0.41;
    const blunderRate =
      difficulty === 'bot_hard' ? 0.02 : difficulty === 'bot_normal' ? 0.12 : 0.22;
    this.botReactionTimers.set(botId, reactDelay + Math.random() * 0.05);

    if (Math.random() < blunderRate) {
      h.botShouldHold = false;
      return;
    }

    // Find best mirror target (Impostor or Royal Crown) or loose Golden Shard
    let bestX = h.x;
    let bestScore = -999;
    let targetMirror: GalleryMirror | null = null;

    for (const m of this.mirrors) {
      if (m.state === 'impostor' || m.state === 'royal_crown') {
        const val = (m.state === 'impostor' ? 120 : 95) - Math.abs(m.x - h.x) * 0.25;
        if (val > bestScore) {
          bestScore = val;
          bestX = m.x;
          targetMirror = m;
        }
      } else if (m.state === 'trap_bomb' && Math.abs(m.x - h.x) < 65) {
        // Step away from trap bomb mirror!
        bestX = m.x + (h.x >= m.x ? 95 : -95);
        targetMirror = null;
        break;
      }
    }

    for (const sh of this.shards) {
      if (!sh.active) continue;
      const val = (sh.gold ? 85 : 55) - Math.abs(sh.x - h.x) * 0.3;
      if (val > bestScore) {
        bestScore = val;
        bestX = sh.x;
      }
    }

    h.botTargetX = bestX;

    if (targetMirror && targetMirror.state === 'impostor' && Math.abs(h.x - targetMirror.x) < 55) {
      h.botShouldSwing = true;
    }

    // Use Hold-to-Charge Prism Wave when multiple anomalies or a rival is close
    let rivalNearby = false;
    this.hunters.forEach((other) => {
      if (other.id !== h.id && Math.abs(other.x - h.x) < 150) {
        rivalNearby = true;
      }
    });
    h.botShouldHold = rivalNearby && difficulty !== 'bot_easy';
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const pal = THEMES[this.theme];
    ctx.save();
    if (this.screenShake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake,
        (Math.random() - 0.5) * this.screenShake
      );
    }

    // 1. Grand Gallery Wall Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height * 0.64);
    bgGrad.addColorStop(0, pal.bgTop);
    bgGrad.addColorStop(1, pal.bgMid);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height * 0.64);

    // Checkered Marble Ballroom / Gallery Floor
    const floorTopY = height * 0.62;
    const floorGrad = ctx.createLinearGradient(0, floorTopY, 0, height);
    floorGrad.addColorStop(0, pal.floorTop);
    floorGrad.addColorStop(1, pal.floorBottom);
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, floorTopY, width, height - floorTopY);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    for (let x = 0; x <= width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, floorTopY);
      ctx.lineTo((x - width / 2) * 1.45 + width / 2, height);
      ctx.stroke();
    }

    // 2. Render the 5 Giant Ornate Magic Mirrors along the Gallery Wall
    for (const m of this.mirrors) {
      ctx.save();
      const shakeX =
        m.state === 'impostor' || m.state === 'trap_bomb'
          ? Math.sin(this.animTime * 28 + m.index) * 2.5
          : 0;
      ctx.translate(m.x + shakeX, m.y);

      // Ornate Pedestal & Arch Frame
      const borderCol =
        m.state === 'impostor'
          ? '#a855f7'
          : m.state === 'royal_crown'
          ? '#facc15'
          : m.state === 'trap_bomb'
          ? '#ef4444'
          : pal.frameColor;

      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = m.state === 'calm' ? 3 : 4.5;
      ctx.beginPath();
      ctx.roundRect(-m.w / 2 - 7, -m.h / 2 - 7, m.w + 14, m.h + 14, 22);
      ctx.fill();
      ctx.stroke();

      // Mirror Glass Surface
      const glassGrad = ctx.createLinearGradient(0, -m.h / 2, 0, m.h / 2);
      if (m.state === 'impostor') {
        glassGrad.addColorStop(0, '#3b0764');
        glassGrad.addColorStop(1, '#581c87');
      } else if (m.state === 'royal_crown') {
        glassGrad.addColorStop(0, '#422006');
        glassGrad.addColorStop(1, '#713f12');
      } else if (m.state === 'trap_bomb') {
        glassGrad.addColorStop(0, '#450a0a');
        glassGrad.addColorStop(1, '#7f1d1d');
      } else {
        glassGrad.addColorStop(0, '#1e293b');
        glassGrad.addColorStop(1, '#0f172a');
      }
      ctx.fillStyle = glassGrad;
      ctx.beginPath();
      ctx.roundRect(-m.w / 2, -m.h / 2, m.w, m.h, 16);
      ctx.fill();

      // Tell-Tale Reflection inside the Mirror
      if (m.state === 'impostor') {
        // Phantom Impostor raising its spectral claw & grinning!
        ctx.fillStyle = '#c084fc';
        ctx.beginPath();
        ctx.arc(0, -6, 24, 0, Math.PI * 2);
        ctx.fill();

        // Raised wrong hand waving menacingly
        const waveY = -22 + Math.sin(m.posePhase * 2) * 8;
        ctx.strokeStyle = '#e879f9';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(18, 4);
        ctx.lineTo(34, waveY);
        ctx.stroke();

        // Glowing eyes
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(-8, -10, 4.5, 0, Math.PI * 2);
        ctx.arc(8, -10, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Badge above mirror
        ctx.fillStyle = '#e879f9';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🔨 TAP: SHATTER!', 0, -m.h / 2 - 14);
      } else if (m.state === 'royal_crown') {
        // Golden Royal Crown Blessing
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.moveTo(-22, 12);
        ctx.lineTo(-26, -14);
        ctx.lineTo(-10, -2);
        ctx.lineTo(0, -22);
        ctx.lineTo(10, -2);
        ctx.lineTo(26, -14);
        ctx.lineTo(22, 12);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👑 TOUCH: +30 BLESSING', 0, -m.h / 2 - 14);
      } else if (m.state === 'trap_bomb') {
        // Ticking Cursed Bomb Mirror
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💣 STAND CLEAR!', 0, -m.h / 2 - 14);
      } else {
        // Calm subtle reflection silhouette
        ctx.fillStyle = 'rgba(148, 163, 184, 0.22)';
        ctx.beginPath();
        ctx.arc(0, 6, 18, 0, Math.PI * 2);
        ctx.fill();
      }

      // Shatter crack lines
      if (m.shatterTimer > 0) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-36, -48);
        ctx.lineTo(0, 0);
        ctx.lineTo(38, -28);
        ctx.moveTo(0, 0);
        ctx.lineTo(-28, 46);
        ctx.moveTo(0, 0);
        ctx.lineTo(34, 50);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 3. Render Loose Mirror Shard Pickups on the Floor
    for (const sh of this.shards) {
      if (!sh.active) continue;
      ctx.save();
      ctx.translate(sh.x, sh.y);
      ctx.fillStyle = sh.gold ? '#facc15' : '#38bdf8';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(9, 0);
      ctx.lineTo(0, 10);
      ctx.lineTo(-9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 4. Render 2.5D Mascot Mirror Hunters & Silver Mallets
    this.hunters.forEach((h) => {
      const p = this.getPlayer(h.id);
      if (!p) return;

      // Floor shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.ellipse(h.x, h.y + 18, 20, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      const mood =
        h.stunTimer > 0
          ? 'shocked'
          : h.swingAnim > 0.2 || h.combo >= 3
          ? 'triumph'
          : h.charging
          ? 'focused'
          : 'idle';
      this.drawPlayerMascot(ctx, h.id, h.x, h.y, 19, mood, this.animTime, h.vx * 0.0008);

      // Silver Banishing Mallet in hand
      ctx.save();
      ctx.translate(h.x + h.moveDir * 16, h.y - 4);
      ctx.rotate(h.moveDir * (0.3 - h.swingAnim * 1.4));
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-3, -18, 6, 18);
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.fillRect(-10, -26, 20, 10);
      ctx.strokeRect(-10, -26, 20, 10);
      ctx.restore();

      // Hold-to-charge Prism Wave ring (72%-98%)
      if (h.charging && h.charge > 0.04) {
        const inSweet = h.charge >= 0.72 && h.charge <= 0.98;
        ctx.strokeStyle = inSweet ? '#facc15' : '#38bdf8';
        ctx.lineWidth = inSweet ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(h.x, h.y, 28, -Math.PI / 2, -Math.PI / 2 + h.charge * Math.PI * 2);
        ctx.stroke();
      }
    });

    // 5. Floating Combat Texts
    for (const ft of this.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, ft.alpha);
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    // 6. Top Instruction Banner (y: 56)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 265, 52, 530, 28, 14);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '🪞 STEER: RUN GALLERY • TAP: SMASH IMPOSTOR MIRROR • HOLD (72-98%): PRISM WAVE SHUNT!',
      width * 0.5,
      70
    );

    // 7. Corner Player Cards (y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const h = this.hunters.get(p.id);
      if (!h) return;
      const isLeft = idx % 2 === 0;
      const row = Math.floor(idx / 2);
      const cardX = isLeft ? 18 : width - 178;
      const cardY = height - 128 + row * 40;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 160, 34, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${p.name}: ${Math.floor(h.score)}`, cardX + 10, cardY + 15);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '10px sans-serif';
      ctx.fillText(
        `${h.combo}x Combo ${h.isUnderdog ? '• ⚡SURGE' : ''}`,
        cardX + 10,
        cardY + 28
      );
    });

    // 8. Bottom-Left Theme Pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎨 ${pal.name} [T]`, 105, height - 24);

    ctx.restore();
  }

  public getScore(playerId: PlayerId): number {
    return this.hunters.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.hunters.entries())
      .map(([playerId, h]) => ({ playerId, score: Math.floor(h.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId
        ? `${winnerId} shattered the Impostor Mirrors and claimed the Royal Prism Crown!`
        : 'Hall of Mirrors Showdown!',
    };
  }
}

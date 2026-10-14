import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type VikingThemeId = 'valhalla' | 'ragnarok' | 'cyber_viking';

interface VikingTheme {
  name: string;
  skyTop: string;
  skyBot: string;
  auroraColor: string;
  waterEven: string;
  waterOdd: string;
  iceFill: string;
  accent: string;
}

const THEMES: Record<VikingThemeId, VikingTheme> = {
  valhalla: {
    name: 'Fjords of Valhalla',
    skyTop: '#071324',
    skyBot: '#153450',
    auroraColor: 'rgba(52, 211, 153, 0.25)',
    waterEven: '#0f2942',
    waterOdd: '#163859',
    iceFill: '#bae6fd',
    accent: '#38bdf8',
  },
  ragnarok: {
    name: 'Muspelheim Fire Fjord',
    skyTop: '#1c0705',
    skyBot: '#5c190e',
    auroraColor: 'rgba(251, 146, 60, 0.25)',
    waterEven: '#2a0f0a',
    waterOdd: '#3d160f',
    iceFill: '#fdba74',
    accent: '#f97316',
  },
  cyber_viking: {
    name: 'Neon Bifrost Waterway',
    skyTop: '#090418',
    skyBot: '#240f4a',
    auroraColor: 'rgba(232, 121, 249, 0.25)',
    waterEven: '#13092b',
    waterOdd: '#1d103f',
    iceFill: '#67e8f9',
    accent: '#e879f9',
  },
};

const THEME_ORDER: VikingThemeId[] = ['valhalla', 'ragnarok', 'cyber_viking'];

interface FjordHazard {
  id: number;
  x: number;
  lane: number;
  type: 'iceberg' | 'serpent' | 'rune';
  shattered: boolean;
}

interface Callout {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
}

export interface LongshipRacer {
  id: PlayerId;
  lane: number;
  laneY: number;
  shipX: number;
  vx: number;
  speed: number;
  score: number;
  combo: number;
  drumBeatPhase: number;
  charge: number;
  charging: boolean;
  ramTimer: number;
  foulTimer: number;
  shuntCooldown: number;
  laneSwitchCooldown: number;
  icebergsShattered: number;
  ramsLanded: number;
  botReactionTimer: number;
  botTargetLane: number;
  botReleaseThreshold: number;
}

export class VikingLongshipGame extends BaseGame {
  public racers: Map<PlayerId, LongshipRacer> = new Map();
  public hazards: FjordHazard[] = [];
  public currentMapName: string = 'Fjords of Valhalla';

  private themeId: VikingThemeId = 'valhalla';
  private callouts: Callout[] = [];
  private obsIdCounter: number = 0;
  private nextHazardTimer: number = 0.85;
  private animTime: number = 0;
  private screenShake: number = 0;
  private suddenDeathAnnounced: boolean = false;

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 38.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
    this.bindThemeControls();
  }

  private bindThemeControls(): void {
    this.cleanupControls();
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        const idx = (THEME_ORDER.indexOf(this.themeId) + 1) % THEME_ORDER.length;
        this.setTheme(THEME_ORDER[idx]);
      } else if (e.key === '1') {
        this.setTheme('valhalla');
      } else if (e.key === '2') {
        this.setTheme('ragnarok');
      } else if (e.key === '3') {
        this.setTheme('cyber_viking');
      }
    };
    this.clickHandler = (e: MouseEvent) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const mx = (e.clientX - rect.left) * scaleX;
      const my = (e.clientY - rect.top) * scaleY;
      if (mx >= 20 && mx <= 190 && my >= canvas.height - 44 && my <= canvas.height - 12) {
        const idx = (THEME_ORDER.indexOf(this.themeId) + 1) % THEME_ORDER.length;
        this.setTheme(THEME_ORDER[idx]);
      }
    };
    window.addEventListener('keydown', this.keyHandler);
    window.addEventListener('mousedown', this.clickHandler);
  }

  private setTheme(id: VikingThemeId): void {
    this.themeId = id;
    this.currentMapName = THEMES[id].name;
    this.audio.playTap();
  }

  private cleanupControls(): void {
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.clickHandler) {
      window.removeEventListener('mousedown', this.clickHandler);
      this.clickHandler = null;
    }
  }

  private getLaneCenterY(lane: number, height: number): number {
    const top = 150;
    const fjordH = height - 285;
    const laneH = fjordH / 3;
    return top + lane * laneH + laneH * 0.5;
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 38.0;
    this.racers.clear();
    this.hazards = [];
    this.callouts = [];
    this.nextHazardTimer = 0.65;
    this.animTime = 0;
    this.screenShake = 0;
    this.suddenDeathAnnounced = false;

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const lane = idx % 3;
      const laneY = this.getLaneCenterY(lane, height);
      this.racers.set(p.id, {
        id: p.id,
        lane,
        laneY,
        shipX: 140 + (idx % 2) * 55,
        vx: 0,
        speed: 175,
        score: 0,
        combo: 0,
        drumBeatPhase: (idx * 0.25) % 1.0,
        charge: 0,
        charging: false,
        ramTimer: 0,
        foulTimer: 0,
        shuntCooldown: 0,
        laneSwitchCooldown: 0,
        icebergsShattered: 0,
        ramsLanded: 0,
        botReactionTimer: 0.14,
        botTargetLane: lane,
        botReleaseThreshold: 0.82,
      });
    });

    for (let i = 0; i < 4; i++) {
      this.hazards.push({
        id: ++this.obsIdCounter,
        x: width * (0.45 + i * 0.15),
        lane: i % 3,
        type: i % 2 === 0 ? 'rune' : 'iceberg',
        shattered: false,
      });
    }
  }

  private spawnCallout(x: number, y: number, text: string, color: string): void {
    this.callouts.push({ x, y, text, color, life: 0.95, maxLife: 0.95 });
  }

  private getLeaderScore(): number {
    let best = 0;
    this.racers.forEach((r) => {
      if (r.score > best) best = r.score;
    });
    return best;
  }

  private isUnderdog(r: LongshipRacer): boolean {
    return this.getLeaderScore() - r.score >= 110;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.animTime += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.cleanupControls();
      return;
    }

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 26);
    }

    const suddenDeath = this.roundTimer <= 12.0;
    if (suddenDeath && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.audio.playFanfare();
      this.spawnCallout(width * 0.5, height * 0.22, '🥁 RAGNAROK TIDAL SURGE (2X SCORE)! 🥁', '#facc15');
    }

    const scoreMult = suddenDeath ? 2 : 1;
    const scrollSpeed = suddenDeath ? 240 : 195;

    // Spawn shared Fjord Hazards & Odin Runes across the 3 lanes
    this.nextHazardTimer -= dt * (suddenDeath ? 1.35 : 1.0);
    if (this.nextHazardTimer <= 0) {
      const roll = Math.random();
      const type: FjordHazard['type'] =
        roll < 0.36 ? 'rune' : roll < 0.74 ? 'iceberg' : 'serpent';
      this.hazards.push({
        id: ++this.obsIdCounter,
        x: width + 50,
        lane: Math.floor(Math.random() * 3),
        type,
        shattered: false,
      });
      this.nextHazardTimer = 0.72 + Math.random() * 0.4;
    }

    for (let i = this.hazards.length - 1; i >= 0; i--) {
      this.hazards[i].x -= scrollSpeed * dt;
      if (this.hazards[i].x < -60 || this.hazards[i].shattered) {
        this.hazards.splice(i, 1);
      }
    }

    this.updateBots(dt, width, height);

    // Update Racers
    this.racers.forEach((r) => {
      if (r.foulTimer > 0) r.foulTimer = Math.max(0, r.foulTimer - dt);
      if (r.ramTimer > 0) r.ramTimer = Math.max(0, r.ramTimer - dt);
      if (r.shuntCooldown > 0) r.shuntCooldown = Math.max(0, r.shuntCooldown - dt);
      if (r.laneSwitchCooldown > 0) r.laneSwitchCooldown = Math.max(0, r.laneSwitchCooldown - dt);

      r.drumBeatPhase = (r.drumBeatPhase + dt * 1.15) % 1.0;

      const p = this.getPlayer(r.id);
      const underdog = this.isUnderdog(r);

      if (p && !p.type.startsWith('bot_') && r.foulTimer <= 0) {
        const steer = this.input.getSteer(r.id);
        const throttle = this.input.getThrottle(r.id);
        const justTapped = this.input.justPressed(r.id) || this.input.justAction(r.id);
        const holdAction = this.input.isActionPressed(r.id) || this.input.isPressed(r.id);

        if (r.laneSwitchCooldown <= 0) {
          const laneInput = Math.abs(throttle) > 0.35 ? -throttle : steer;
          if (laneInput < -0.4 && r.lane > 0) {
            r.lane--;
            r.laneSwitchCooldown = 0.22;
            this.audio.playTap();
          } else if (laneInput > 0.4 && r.lane < 2) {
            r.lane++;
            r.laneSwitchCooldown = 0.22;
            this.audio.playTap();
          }
        }

        if (justTapped && !r.charging) {
          this.strokeWarDrum(r, scoreMult);
        }

        if (holdAction) {
          r.charging = true;
          r.charge = Math.min(1.0, r.charge + dt * 1.1);
          if (r.charge >= 1.0) {
            r.charging = false;
            r.charge = 0;
          }
        } else if (r.charging) {
          const released = r.charge;
          r.charging = false;
          r.charge = 0;
          if (released >= 0.25) {
            this.executeBerserkerRam(r, released, scoreMult);
          }
        }
      }

      const targetY = this.getLaneCenterY(r.lane, height);
      r.laneY += (targetY - r.laneY) * Math.min(1, dt * 12);

      // Slipstream drafting behind a leading ship in the same lane!
      let drafting = false;
      this.racers.forEach((other) => {
        if (other.id !== r.id && other.lane === r.lane && other.shipX > r.shipX && other.shipX - r.shipX < 160) {
          drafting = true;
        }
      });

      const baseSpeed = (underdog ? 195 : 165) * (drafting ? 1.22 : 1.0);
      r.speed += (baseSpeed - r.speed) * dt * 1.8;

      r.vx *= Math.pow(0.08, dt);
      r.shipX += (r.vx + (r.speed - 170) * 0.45) * dt;
      r.shipX = Math.max(95, Math.min(width - 140, r.shipX));

      // Check Hazards & Odin Runes
      this.hazards.forEach((obs) => {
        if (obs.shattered || obs.lane !== r.lane) return;
        if (Math.abs(obs.x - r.shipX) < 42) {
          obs.shattered = true;
          if (obs.type === 'rune') {
            r.combo++;
            const pts = (38 + Math.min(28, r.combo * 3)) * scoreMult;
            r.score += pts;
            r.speed = Math.min(310, r.speed + 45);
            this.audio.playCoin();
            this.particles.spawnConfetti(obs.x, r.laneY, 12);
            this.spawnCallout(obs.x, r.laneY - 26, `ᚠ +${pts} ODIN RUNE!`, '#facc15');
          } else if (r.ramTimer > 0 || r.speed >= 205 || underdog) {
            // Shatter Iceberg or Slay Sea Serpent with Berserker Prow!
            r.icebergsShattered++;
            r.combo++;
            const basePts = obs.type === 'serpent' ? 65 : 48;
            const pts = Math.round(
              (basePts + Math.min(30, r.combo * 4)) * (r.ramTimer > 0 ? 1.5 : 1.0) * scoreMult
            );
            r.score += pts;
            this.screenShake = Math.min(10, this.screenShake + 4);
            this.audio.playScore();
            this.particles.spawnExplosion(
              obs.x,
              r.laneY,
              obs.type === 'iceberg' ? '#bae6fd' : '#4ade80',
              16
            );
            this.spawnCallout(
              obs.x,
              r.laneY - 28,
              obs.type === 'serpent' ? `🐉 SERPENT SLAIN! +${pts}` : `🧊 SHATTERED! +${pts}`,
              '#facc15'
            );
          } else {
            // Glancing impact pushes ship back and switches lane safely
            r.foulTimer = 0.55;
            r.combo = 0;
            r.vx -= 140;
            r.score = Math.max(0, r.score - 15);
            this.audio.playStun();
            this.particles.spawnExplosion(obs.x, r.laneY, '#ef4444', 12);
            this.spawnCallout(r.shipX, r.laneY - 28, '-15 HULL CRUNCH!', '#ef4444');
          }
        }
      });
    });

    // Elastic Ship-to-Ship Broadside Bumping
    const list = Array.from(this.racers.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (Math.abs(a.laneY - b.laneY) < 34 && Math.abs(b.shipX - a.shipX) < 68) {
          const dir = b.shipX >= a.shipX ? 1 : -1;
          a.vx -= dir * 110;
          b.vx += dir * 110;
          this.audio.playBounce();
          this.particles.spawnSparks((a.shipX + b.shipX) * 0.5, (a.laneY + b.laneY) * 0.5, '#facc15', 8);
        }
      }
    }

    // Update Callouts
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y -= 30 * dt;
      c.life -= dt;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }
  }

  private strokeWarDrum(r: LongshipRacer, scoreMult: number): void {
    const onBeat = r.drumBeatPhase >= 0.72 || r.drumBeatPhase <= 0.18;
    if (onBeat) {
      r.speed = Math.min(320, r.speed + 65);
      r.vx += 85;
      r.combo++;
      const pts = (24 + Math.min(24, r.combo * 3)) * scoreMult;
      r.score += pts;
      this.audio.playCoin();
      this.particles.spawnSparks(r.shipX - 24, r.laneY + 8, '#bae6fd', 10);
      this.spawnCallout(r.shipX, r.laneY - 30, `🥁 DRUM SURGE +${pts}`, '#38bdf8');
    } else {
      r.speed = Math.min(260, r.speed + 25);
      r.vx += 30;
      this.audio.playTap();
    }
  }

  private executeBerserkerRam(
    r: LongshipRacer,
    chargeLevel: number,
    scoreMult: number
  ): void {
    const isSweetSpot = chargeLevel >= 0.72 && chargeLevel <= 0.98;
    r.ramTimer = isSweetSpot ? 1.15 : 0.55;
    r.speed = Math.min(340, r.speed + (isSweetSpot ? 95 : 45));
    r.vx += isSweetSpot ? 210 : 95;

    if (isSweetSpot) {
      this.screenShake = Math.min(14, this.screenShake + 7);
      this.audio.playExplosion();
      this.particles.spawnExplosion(r.shipX + 36, r.laneY, '#facc15', 18);
      this.spawnCallout(r.shipX, r.laneY - 34, '🔥 VALHALLA BERSERKER RAM!', '#facc15');

      // Tidal Wake Shunt against nearby rival longships!
      this.racers.forEach((other) => {
        if (other.id === r.id || other.shuntCooldown > 0) return;
        if (Math.hypot(other.shipX - r.shipX, other.laneY - r.laneY) <= 115) {
          other.vx -= 220;
          other.lane = (other.lane + 1) % 3;
          other.shuntCooldown = 1.2;
          const pts = 70 * scoreMult;
          r.score += pts;
          r.ramsLanded++;
          this.audio.playStun();
          this.particles.spawnExplosion(other.shipX, other.laneY, '#facc15', 14);
          this.spawnCallout(other.shipX, other.laneY - 32, `🌊 TIDAL RAM! +${pts}`, '#facc15');
        }
      });
    } else {
      this.audio.playWhoosh();
      this.particles.spawnSparks(r.shipX + 28, r.laneY, '#fde047', 8);
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const r = this.racers.get(botId);
    if (!r || r.foulTimer > 0) return;

    const scoreMult = this.roundTimer <= 12.0 ? 2 : 1;

    r.botReactionTimer -= dt;
    if (r.botReactionTimer <= 0) {
      r.botReactionTimer =
        difficulty === 'bot_hard' ? 0.10 : difficulty === 'bot_normal' ? 0.22 : 0.38;
      const blunder =
        difficulty === 'bot_easy' ? 0.22 : difficulty === 'bot_normal' ? 0.08 : 0.0;

      // Evaluate lanes for upcoming runes & icebergs
      const upcoming = this.hazards.find(
        (h) => !h.shattered && h.x > r.shipX - 10 && h.x < r.shipX + 220
      );
      if (upcoming && Math.random() > blunder) {
        if (upcoming.type === 'rune') {
          r.lane = upcoming.lane;
        } else if (r.ramTimer > 0 || r.speed >= 210) {
          r.lane = upcoming.lane; // Ram through it for points!
        } else if (upcoming.lane === r.lane) {
          r.lane = (r.lane + 1) % 3; // Steer around hazard if slow!
        }
      }

      if ((r.drumBeatPhase >= 0.76 || r.drumBeatPhase <= 0.12) && !r.charging && Math.random() > blunder) {
        this.strokeWarDrum(r, scoreMult);
        if (difficulty !== 'bot_easy' && Math.random() < 0.45) {
          r.charging = true;
          r.botReleaseThreshold = difficulty === 'bot_hard' ? 0.80 : 0.74;
        }
      }
    }

    if (r.charging) {
      r.charge = Math.min(1.0, r.charge + dt * 1.1);
      if (r.charge >= r.botReleaseThreshold) {
        const released = r.charge;
        r.charging = false;
        r.charge = 0;
        this.executeBerserkerRam(r, released, scoreMult);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeId];
    const top = 150;
    const fjordH = height - 285;
    const laneH = fjordH / 3;

    ctx.save();
    if (this.screenShake > 0.2) {
      ctx.translate(
        (Math.random() - 0.5) * this.screenShake,
        (Math.random() - 0.5) * this.screenShake
      );
    }

    // 1. Nordic Night Sky & Aurora Borealis
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, theme.skyTop);
    skyGrad.addColorStop(1, theme.skyBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = theme.auroraColor;
    ctx.beginPath();
    ctx.moveTo(0, 95);
    for (let x = 0; x <= width; x += 60) {
      ctx.lineTo(x, 85 + Math.sin(this.animTime * 2 + x * 0.015) * 20);
    }
    ctx.lineTo(width, 150);
    ctx.lineTo(0, 150);
    ctx.closePath();
    ctx.fill();

    // 2. Shared 3-Lane Fjord Channel
    for (let l = 0; l < 3; l++) {
      const ly = top + l * laneH;
      ctx.fillStyle = l % 2 === 0 ? theme.waterEven : theme.waterOdd;
      ctx.fillRect(0, ly, width, laneH);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(width, ly);
      ctx.stroke();
    }

    // 3. Render Fjord Hazards (Crystal Icebergs, Midgard Serpents & Odin Runes)
    this.hazards.forEach((obs) => {
      if (obs.shattered) return;
      const oy = this.getLaneCenterY(obs.lane, height);
      ctx.save();
      ctx.translate(obs.x, oy);

      if (obs.type === 'rune') {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#451a03';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ᚠ', 0, 4);
      } else if (obs.type === 'iceberg') {
        ctx.fillStyle = theme.iceFill;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-20, 16);
        ctx.lineTo(-8, -22);
        ctx.lineTo(4, -10);
        ctx.lineTo(14, -24);
        ctx.lineTo(22, 16);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Sea Serpent Coils
        ctx.fillStyle = '#16a34a';
        ctx.strokeStyle = '#4ade80';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(-8, 4, 13, Math.PI, 0);
        ctx.arc(10, 4, 10, Math.PI, 0);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(-12, -4, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // 4. Render 2.5D Viking Longships & Mascot Captains
    this.racers.forEach((r, pId) => {
      const cfg = this.getPlayer(pId);
      const color = cfg?.color ?? '#38bdf8';
      const sx = r.shipX;
      const sy = r.laneY;
      const isSweetSpot = r.charge >= 0.72 && r.charge <= 0.98;

      ctx.save();
      ctx.translate(sx, sy);

      // Berserker Fire Prow Aura
      if (r.ramTimer > 0) {
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(16, -4, 34 + Math.sin(this.animTime * 18) * 4, -0.9, 0.9);
        ctx.stroke();
      }

      // Clinker-built Oak Hull & Dragon Figurehead
      ctx.fillStyle = '#78350f';
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-38, -6);
      ctx.lineTo(36, -6);
      ctx.lineTo(26, 12);
      ctx.lineTo(-32, 12);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Dragon Prow Neck
      ctx.strokeStyle = r.ramTimer > 0 ? '#facc15' : '#b45309';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(32, -6);
      ctx.quadraticCurveTo(46, -24, 42, -32);
      ctx.stroke();

      // Round Viking Shields along Gunwale
      for (let sh = -24; sh <= 16; sh += 13) {
        ctx.fillStyle = sh % 2 === 0 ? color : '#facc15';
        ctx.beginPath();
        ctx.arc(sh, 2, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Animated Golden Oars
      const oarSwing = Math.sin(this.animTime * 12) * 9;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2;
      for (let ox = -22; ox <= 14; ox += 12) {
        ctx.beginPath();
        ctx.moveTo(ox, 6);
        ctx.lineTo(ox - oarSwing, 19);
        ctx.stroke();
      }

      // Viking Captain Mascot
      this.drawPlayerMascot(
        ctx,
        pId,
        -6,
        -18,
        15,
        r.foulTimer > 0 ? 'shocked' : r.ramTimer > 0 ? 'triumph' : 'focused',
        this.animTime
      );

      // War Drum Cadence Ring ahead of Prow
      const drumX = 64;
      const drumY = -8;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.beginPath();
      ctx.arc(drumX, drumY, 11, 0, Math.PI * 2);
      ctx.fill();
      const beatR = 11 + (1 - r.drumBeatPhase) * 14;
      ctx.strokeStyle = r.drumBeatPhase >= 0.72 ? '#facc15' : '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(drumX, drumY, beatR, 0, Math.PI * 2);
      ctx.stroke();

      // Hold-to-Charge Berserker Ram Gauge (72%–98% Sweet Spot)
      if (r.charging && r.charge > 0.04) {
        const bw = 44;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(-bw / 2 - 1, -44, bw + 2, 6);
        ctx.fillStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.fillRect(-bw / 2 + bw * 0.72, -43, bw * 0.26, 4);
        ctx.fillStyle = isSweetSpot ? '#facc15' : '#38bdf8';
        ctx.fillRect(-bw / 2, -43, bw * r.charge, 4);
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${cfg?.name ?? `P${pId + 1}`}: ${r.score}`, 0, 26);
      ctx.restore();
    });

    // 5. Callouts
    this.callouts.forEach((c) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, c.life / c.maxLife);
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000000';
      ctx.fillText(c.text, c.x + 1, c.y + 1);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    });

    ctx.restore();

    // 6. Top Instruction Pill (y: 56)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 245, 56, 490, 28, 14);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '🥁 STEER: SWITCH FJORD LANE • TAP: DRUM BEAT • HOLD (72–98%): BERSERKER RAM!',
      width / 2,
      74
    );

    // 7. Corner Score Cards (y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const r = this.racers.get(p.id);
      if (!r) return;
      const isLeft = idx % 2 === 0;
      const row = Math.floor(idx / 2);
      const cardX = isLeft ? 18 : width - 178;
      const cardY = height - 128 - row * 56;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 160, 48, 10);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cardX + 10, cardY + 18);
      ctx.fillStyle = '#facc15';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`${Math.floor(r.score)} pts`, cardX + 10, cardY + 37);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`🧊${r.icebergsShattered} 🌊${r.ramsLanded}`, cardX + 150, cardY + 37);
    });

    // 8. Interactive Theme Pill (bottom-left x: 20, y: height - 44, w: 170, h: 32)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(20, height - 44, 170, 32, 16);
    ctx.fill();
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🎨 [T] ${theme.name}`, 105, height - 24);
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.racers.forEach((r, pId) => scores.set(pId, Math.floor(r.score)));
    return scores;
  }

  public getRoundResult(): RoundResult {
    this.cleanupControls();
    const rankings = Array.from(this.racers.entries())
      .map(([playerId, r]) => ({ playerId, score: Math.floor(r.score), place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    const winnerCfg = winnerId ? this.getPlayer(winnerId) : undefined;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerCfg
        ? `${winnerCfg.name} sailed into Valhalla with ${rankings[0].score} pts!`
        : 'All longships lost in the icy fjord!',
    };
  }
}

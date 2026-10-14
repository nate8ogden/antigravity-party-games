import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface HighwayEntity {
  id: number;
  laneFloat: number; // -1.5 to +1.5
  z: number; // 1.0 (horizon) down to 0.0 (camera)
  speedZ: number;
  type: 'CRUISER' | 'BOOST_CHEVRON' | 'SYNTH_CASSETTE' | 'BARRIER_DRONE';
  color: string;
  collected: boolean;
}

interface FloatingCallout {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
}

interface RacerPlayer {
  id: PlayerId;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  score: number;
  speedMph: number;
  boostTimer: number;
  stunTimer: number;
  draftTimer: number;
  charge: number;
  isCharging: boolean;
  underdog: boolean;
  botTargetX: number;
  botReactionTimer: number;
}

interface ThemePalette {
  id: string;
  name: string;
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  groundFill: string;
  gridLine: string;
  sunTop: string;
  sunBot: string;
}

const THEMES: ThemePalette[] = [
  {
    id: 'miami_vice_84',
    name: 'Miami Sunset Grid',
    skyTop: '#090418',
    skyMid: '#3b0764',
    skyHorizon: '#db2777',
    groundFill: '#0b031d',
    gridLine: '#ec4899',
    sunTop: '#fde047',
    sunBot: '#f43f5e'
  },
  {
    id: 'cyber_tokyo',
    name: 'Neo-Tokyo Cyan',
    skyTop: '#020617',
    skyMid: '#0f172a',
    skyHorizon: '#0284c7',
    groundFill: '#040d21',
    gridLine: '#38bdf8',
    sunTop: '#67e8f9',
    sunBot: '#6366f1'
  },
  {
    id: 'outrun_horizon',
    name: 'Solaris OutRun Gold',
    skyTop: '#1c0904',
    skyMid: '#7c2d12',
    skyHorizon: '#f59e0b',
    groundFill: '#140804',
    gridLine: '#fbbf24',
    sunTop: '#fef08a',
    sunBot: '#ea580c'
  }
];

export class SynthwaveNeonRacerGame extends BaseGame {
  private playersState: Map<PlayerId, RacerPlayer> = new Map();
  private entities: HighwayEntity[] = [];
  private callouts: FloatingCallout[] = [];
  private nextEntityId = 1;
  private gridScroll = 0;
  private spawnTimer = 0;
  private hitStopTimer = 0;
  private suddenDeath = false;
  private themeIndex = 0;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.setupThemeHotkeys();
    this.reset(width, height);
  }

  private setupThemeHotkeys(): void {
    if (typeof window === 'undefined' || this.keyHandler) return;
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 't' || e.key === 'T') {
        this.themeIndex = (this.themeIndex + 1) % THEMES.length;
      } else if (e.key === '1') {
        this.themeIndex = 0;
      } else if (e.key === '2') {
        this.themeIndex = 1;
      } else if (e.key === '3') {
        this.themeIndex = 2;
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    super.destroy();
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45;
    this.playersState.clear();
    this.entities = [];
    this.callouts = [];
    this.nextEntityId = 1;
    this.gridScroll = 0;
    this.spawnTimer = 0;
    this.hitStopTimer = 0;
    this.suddenDeath = false;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = (width - 180) / (count + 1);

    active.forEach((p, idx) => {
      const startX = 90 + spacing * (idx + 1);
      this.playersState.set(p.id, {
        id: p.id,
        name: p.name,
        color: p.color,
        x: startX,
        y: height - 78,
        vx: 0,
        vy: 0,
        score: 0,
        speedMph: 145,
        boostTimer: 0,
        stunTimer: 0,
        draftTimer: 0,
        charge: 0,
        isCharging: false,
        underdog: false,
        botTargetX: startX,
        botReactionTimer: 0
      });
    });

    for (let i = 0; i < 6; i++) {
      this.spawnEntity(0.35 + i * 0.12);
    }
  }

  private spawnEntity(startZ = 1.0): void {
    const laneChoices = [-1.35, -0.45, 0.45, 1.35];
    const laneFloat = laneChoices[Math.floor(Math.random() * laneChoices.length)] + (Math.random() - 0.5) * 0.18;
    const roll = Math.random();
    let type: HighwayEntity['type'] = 'CRUISER';
    let color = '#f43f5e';
    let speedZ = 0.42 + Math.random() * 0.18;

    if (roll < 0.28) {
      type = 'BOOST_CHEVRON';
      color = '#38bdf8';
      speedZ = 0.52;
    } else if (roll < 0.52) {
      type = 'SYNTH_CASSETTE';
      color = '#fbbf24';
      speedZ = 0.48;
    } else if (this.suddenDeath && roll > 0.78) {
      type = 'BARRIER_DRONE';
      color = '#a855f7';
      speedZ = 0.62;
    }

    this.entities.push({
      id: this.nextEntityId++,
      laneFloat,
      z: startZ,
      speedZ,
      type,
      color,
      collected: false
    });
  }

  private projectPoint(laneFloat: number, z: number, width: number, height: number): { x: number; y: number; scale: number } {
    const horizonY = Math.max(125, height * 0.34);
    const bottomY = height - 24;
    const perspective = Math.pow(1 - z, 1.45);
    const y = horizonY + perspective * (bottomY - horizonY);
    const halfRoadW = 34 + perspective * (width * 0.42 - 34);
    const x = width / 2 + (laneFloat / 1.6) * halfRoadW;
    const scale = 0.25 + perspective * 0.95;
    return { x, y, scale };
  }

  private addCallout(x: number, y: number, text: string, color: string): void {
    this.callouts.push({ x, y, vy: -42, text, color, life: 0.95 });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 15 && !this.suddenDeath) {
      this.suddenDeath = true;
      this.audio.playBoost();
      this.addCallout(width / 2, height * 0.28, 'OVERDRIVE FINAL LAP! 2X CASSETTES!', '#fbbf24');
    }

    this.updateBots(dt, width, height);

    const speedFactor = this.suddenDeath ? 1.32 : 1.0;
    this.gridScroll = (this.gridScroll + dt * 2.8 * speedFactor) % 1;

    // Determine leader for Underdog Surge
    let maxScore = 0;
    for (const ps of this.playersState.values()) {
      if (ps.score > maxScore) maxScore = ps.score;
    }
    for (const ps of this.playersState.values()) {
      ps.underdog = maxScore - ps.score >= 120;
    }

    // Spawn highway entities
    this.spawnTimer += dt * speedFactor;
    if (this.spawnTimer >= 0.46) {
      this.spawnTimer = 0;
      this.spawnEntity(1.0);
    }

    // Update entities
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const ent = this.entities[i];
      ent.z -= ent.speedZ * dt * speedFactor;
      if (ent.z < -0.08 || ent.collected) {
        this.entities.splice(i, 1);
      }
    }

    // Update Callouts
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y += c.vy * dt;
      c.life -= dt;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }

    // Update Players
    const active = this.getActivePlayers();
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
      }
      if (ps.boostTimer > 0) {
        ps.boostTimer -= dt;
      }

      // Slipstream check behind another racer or close cruiser
      let drafting = false;
      for (const other of this.playersState.values()) {
        if (other.id !== ps.id && other.y < ps.y - 6 && Math.abs(other.x - ps.x) < 38) {
          drafting = true;
          break;
        }
      }
      if (!drafting) {
        for (const ent of this.entities) {
          if (ent.type === 'CRUISER' && ent.z > 0.14 && ent.z < 0.42) {
            const proj = this.projectPoint(ent.laneFloat, ent.z, width, height);
            if (Math.abs(proj.x - ps.x) < 36) {
              drafting = true;
              break;
            }
          }
        }
      }

      if (drafting) {
        ps.draftTimer = Math.min(2.0, ps.draftTimer + dt);
        ps.score += dt * 12;
      } else {
        ps.draftTimer = Math.max(0, ps.draftTimer - dt * 1.5);
      }

      const steer = ps.stunTimer > 0 ? 0 : this.input.getSteer(p.id);
      const throttle = ps.stunTimer > 0 ? 0 : this.input.getThrottle(p.id);
      const isPressed = ps.stunTimer <= 0 && this.input.isPressed(p.id);

      // Hold-to-charge Flux-Capacitor Warp & Side-Swipe Shunt (72% - 98% Sweet Spot)
      if (isPressed) {
        ps.isCharging = true;
        ps.charge = Math.min(1.0, ps.charge + dt * (drafting ? 0.95 : 0.72));
      } else if (ps.isCharging) {
        ps.isCharging = false;
        if (ps.charge >= 0.72 && ps.charge <= 0.98) {
          // Sweet Spot Flux Warp!
          const bonus = this.suddenDeath ? 90 : 65;
          ps.score += bonus;
          ps.boostTimer = 2.4;
          ps.vy = -120;
          this.audio.playBoost();
          this.hitStopTimer = 0.045;
          this.particles.shake(0.32);
          this.particles.emit(ps.x, ps.y, 24, '#38bdf8');
          this.addCallout(ps.x, ps.y - 28, `88 MPH FLUX WARP! +${bonus}`, '#38bdf8');

          // Side-swipe shunt nearby rivals
          for (const rival of this.playersState.values()) {
            if (rival.id === ps.id) continue;
            const d = Math.hypot(rival.x - ps.x, rival.y - ps.y);
            if (d < 95) {
              const dir = rival.x >= ps.x ? 1 : -1;
              rival.vx += dir * 340;
              rival.stunTimer = 0.65;
              ps.score += 55;
              this.audio.playBounce();
              this.particles.emit(rival.x, rival.y, 18, ps.color);
              this.addCallout(rival.x, rival.y - 20, 'OUTRUN SIDE-SWIPE! +55', ps.color);
            }
          }
        } else if (ps.charge > 0.98) {
          // Overheated turbo blowback
          ps.stunTimer = 0.55;
          this.audio.playBuzzer();
          this.addCallout(ps.x, ps.y - 20, 'TURBO OVERHEAT!', '#ef4444');
        } else if (ps.charge >= 0.25) {
          // Quick lane hop dash
          ps.vx += (steer !== 0 ? Math.sign(steer) : 1) * 180;
          this.audio.playBounce();
        }
        ps.charge = 0;
      }

      const underdogBoost = ps.underdog ? 1.16 : 1.0;
      const draftBoost = ps.draftTimer > 0.2 ? 1.22 : 1.0;
      const accelX = 980 * underdogBoost * (ps.boostTimer > 0 ? 1.28 : 1.0);
      ps.vx += steer * accelX * dt;
      ps.vy += -throttle * 420 * dt;

      // Return spring toward cruising Y line
      const homeY = height - 78 - (ps.boostTimer > 0 ? 22 : 0) - (ps.draftTimer > 0.2 ? 10 : 0);
      ps.vy += (homeY - ps.y) * 5.5 * dt;

      ps.vx *= Math.pow(0.015, dt);
      ps.vy *= Math.pow(0.04, dt);

      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      const minX = 58;
      const maxX = width - 58;
      if (ps.x < minX) {
        ps.x = minX;
        ps.vx = Math.abs(ps.vx) * 0.5;
      } else if (ps.x > maxX) {
        ps.x = maxX;
        ps.vx = -Math.abs(ps.vx) * 0.5;
      }
      ps.y = Math.max(height * 0.56, Math.min(height - 46, ps.y));

      // Continuous highway distance points
      const baseRate = ps.boostTimer > 0 ? 16 : 8;
      ps.score += dt * baseRate * draftBoost * underdogBoost;
      ps.speedMph = Math.round(140 + (ps.boostTimer > 0 ? 58 : 0) + (drafting ? 24 : 0) + Math.abs(ps.vx) * 0.08);

      // Entity collisions near player plane
      for (const ent of this.entities) {
        if (ent.collected || ent.z > 0.28 || ent.z < 0.02) continue;
        const proj = this.projectPoint(ent.laneFloat, ent.z, width, height);
        const dist = Math.hypot(ps.x - proj.x, ps.y - proj.y);

        if (dist < 32) {
          ent.collected = true;
          if (ent.type === 'BOOST_CHEVRON') {
            ps.boostTimer = 2.2;
            ps.score += 40;
            this.audio.playBoost();
            this.particles.emit(proj.x, proj.y, 16, '#38bdf8');
            this.addCallout(proj.x, proj.y - 16, 'NITRO CHEVRON! +40', '#38bdf8');
          } else if (ent.type === 'SYNTH_CASSETTE') {
            const pts = this.suddenDeath ? 90 : 50;
            ps.score += pts;
            this.audio.playScore();
            this.particles.emit(proj.x, proj.y, 18, '#fbbf24');
            this.addCallout(proj.x, proj.y - 16, `SYNTH TAPE! +${pts}`, '#fbbf24');
          } else {
            // Cruiser or Barrier Drone impact
            if (ps.boostTimer > 0.5 || ps.underdog) {
              // Smash through cruiser!
              ps.score += 35;
              this.audio.playExplosion();
              this.hitStopTimer = 0.035;
              this.particles.shake(0.25);
              this.particles.emit(proj.x, proj.y, 20, '#f43f5e');
              this.addCallout(proj.x, proj.y - 18, 'CRUISER TAKEDOWN! +35', '#f43f5e');
            } else {
              ps.stunTimer = 0.85;
              ps.boostTimer = 0;
              ps.score = Math.max(0, ps.score - 25);
              ps.vx += (ps.x >= proj.x ? 1 : -1) * 220;
              this.audio.playExplosion();
              this.particles.shake(0.35);
              this.particles.emit(ps.x, ps.y, 18, '#ef4444');
              this.addCallout(ps.x, ps.y - 18, 'BUMPER WRECK! -25', '#ef4444');
            }
          }
        }
      }
    }

    // Elastic Player-to-Player Door-Slam Collisions
    const list = Array.from(this.playersState.values());
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 38;
        if (dist > 0 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = minDist - dist;
          a.x -= nx * overlap * 0.5;
          a.y -= ny * overlap * 0.5;
          b.x += nx * overlap * 0.5;
          b.y += ny * overlap * 0.5;

          const force = 210;
          a.vx -= nx * force * (b.underdog ? 1.35 : 1);
          b.vx += nx * force * (a.underdog ? 1.35 : 1);
          this.audio.playBounce();
          this.particles.emit((a.x + b.x) / 2, (a.y + b.y) / 2, 10, '#fde047');
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.stunTimer > 0) return;

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer <= 0) {
      const delay = difficulty === 'bot_easy' ? 0.32 : difficulty === 'bot_normal' ? 0.22 : 0.14;
      ps.botReactionTimer = delay;

      let bestX = width / 2;
      let bestScore = -999;

      // Evaluate candidate X positions across the road
      for (let sampleX = 80; sampleX <= width - 80; sampleX += 42) {
        let val = 0;
        for (const ent of this.entities) {
          if (ent.collected || ent.z > 0.65 || ent.z < 0.04) continue;
          const proj = this.projectPoint(ent.laneFloat, ent.z, width, height);
          const d = Math.abs(sampleX - proj.x);
          if (d < 46) {
            if (ent.type === 'SYNTH_CASSETTE' || ent.type === 'BOOST_CHEVRON') {
              val += (1 - ent.z) * 140;
            } else {
              val -= (1 - ent.z) * 190;
            }
          }
        }
        if (difficulty === 'bot_easy') {
          val += (Math.random() - 0.5) * 90;
        } else if (difficulty === 'bot_normal') {
          val += (Math.random() - 0.5) * 35;
        }
        if (val > bestScore) {
          bestScore = val;
          bestX = sampleX;
        }
      }
      ps.botTargetX = bestX;
    }

    const dx = ps.botTargetX - ps.x;
    const steer = Math.abs(dx) > 12 ? Math.sign(dx) : 0;

    // Charge Flux Warp when clear or near rival
    let holdAction = false;
    if (ps.isCharging) {
      const targetRelease = difficulty === 'bot_hard' ? 0.84 : 0.78;
      holdAction = ps.charge < targetRelease;
    } else if (Math.random() < (difficulty === 'bot_easy' ? 0.015 : 0.04)) {
      holdAction = true;
    }

    this.input.setBotInput(botId, holdAction, steer, 0);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.themeIndex % THEMES.length];
    const horizonY = Math.max(125, height * 0.34);

    // 1. Synthwave Sky Gradient
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY);
    sky.addColorStop(0, theme.skyTop);
    sky.addColorStop(0.55, theme.skyMid);
    sky.addColorStop(1, theme.skyHorizon);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, horizonY);

    // 2. Giant Retrowave Slotted Sun
    const sunR = 52;
    const sunY = horizonY - 18;
    const sunGrad = ctx.createLinearGradient(width / 2, sunY - sunR, width / 2, sunY + sunR);
    sunGrad.addColorStop(0, theme.sunTop);
    sunGrad.addColorStop(1, theme.sunBot);
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(width / 2, sunY, sunR, 0, Math.PI * 2);
    ctx.fill();

    // Horizontal Sun Scanline Cutouts
    ctx.fillStyle = theme.skyMid;
    for (let i = 0; i < 6; i++) {
      const sy = sunY + 4 + i * 7;
      ctx.fillRect(width / 2 - sunR - 4, sy, sunR * 2 + 8, 2 + i * 0.55);
    }

    // Wireframe Mountain Range along Horizon
    ctx.fillStyle = '#120629';
    ctx.strokeStyle = theme.gridLine;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    const peaks = [0, 0.12, 0.24, 0.36, 0.5, 0.64, 0.76, 0.88, 1.0];
    const heights = [0, 28, 12, 36, 8, 38, 14, 26, 0];
    for (let i = 0; i < peaks.length; i++) {
      ctx.lineTo(peaks[i] * width, horizonY - heights[i]);
    }
    ctx.lineTo(width, horizonY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Perspective Ground & 4-Lane Highway
    ctx.fillStyle = theme.groundFill;
    ctx.fillRect(0, horizonY, width, height - horizonY);

    // Perspective radial grid lines
    ctx.strokeStyle = theme.gridLine;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 1.2;
    for (let lane = -3.2; lane <= 3.2; lane += 0.8) {
      const topPt = this.projectPoint(lane, 1.0, width, height);
      const botPt = this.projectPoint(lane, 0.0, width, height);
      ctx.beginPath();
      ctx.moveTo(topPt.x, topPt.y);
      ctx.lineTo(botPt.x, botPt.y);
      ctx.stroke();
    }

    // Scrolling horizontal perspective rungs
    for (let i = 0; i < 12; i++) {
      const z = ((i + (1 - this.gridScroll)) / 12) % 1;
      const left = this.projectPoint(-3.2, z, width, height);
      const right = this.projectPoint(3.2, z, width, height);
      ctx.beginPath();
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Glowing Highway Curbs
    const leftTop = this.projectPoint(-1.6, 1.0, width, height);
    const leftBot = this.projectPoint(-1.6, 0.0, width, height);
    const rightTop = this.projectPoint(1.6, 1.0, width, height);
    const rightBot = this.projectPoint(1.6, 0.0, width, height);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(leftTop.x, leftTop.y);
    ctx.lineTo(leftBot.x, leftBot.y);
    ctx.moveTo(rightTop.x, rightTop.y);
    ctx.lineTo(rightBot.x, rightBot.y);
    ctx.stroke();

    // 4. Render Highway Entities (sorted far to near)
    const sorted = [...this.entities].sort((a, b) => b.z - a.z);
    for (const ent of sorted) {
      if (ent.collected) continue;
      const proj = this.projectPoint(ent.laneFloat, ent.z, width, height);
      ctx.save();
      ctx.translate(proj.x, proj.y);
      ctx.scale(proj.scale, proj.scale);

      if (ent.type === 'BOOST_CHEVRON') {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3.5;
        for (let c = -1; c <= 1; c++) {
          ctx.beginPath();
          ctx.moveTo(-18, c * 8 + 6);
          ctx.lineTo(0, c * 8 - 6);
          ctx.lineTo(18, c * 8 + 6);
          ctx.stroke();
        }
      } else if (ent.type === 'SYNTH_CASSETTE') {
        // Golden 80s Synth Cassette Tape
        ctx.fillStyle = '#fbbf24';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.fillRect(-18, -12, 36, 24);
        ctx.strokeRect(-18, -12, 36, 24);
        ctx.fillStyle = '#ec4899';
        ctx.fillRect(-14, -8, 28, 8);
        ctx.fillStyle = '#090418';
        ctx.beginPath();
        ctx.arc(-7, 4, 3.5, 0, Math.PI * 2);
        ctx.arc(7, 4, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 2.5D Retro Cruiser / Drone
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = ent.color;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-22, -14, 44, 24, 5);
        ctx.fill();
        ctx.stroke();
        // Twin Neon Taillights
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-18, -2, 10, 5);
        ctx.fillRect(8, -2, 10, 5);
      }
      ctx.restore();
    }

    // 5. Render Player Gull-Wing Supercars
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Slipstream draft wind lines
      if (ps.draftTimer > 0.15) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-24, -22);
        ctx.lineTo(-24, 18);
        ctx.moveTo(24, -22);
        ctx.lineTo(24, 18);
        ctx.stroke();
      }

      // Sweet-spot charge ring
      if (ps.isCharging) {
        const inSweet = ps.charge >= 0.72 && ps.charge <= 0.98;
        ctx.strokeStyle = inSweet ? '#fde047' : '#38bdf8';
        ctx.lineWidth = inSweet ? 4 : 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 32, -Math.PI / 2, -Math.PI / 2 + ps.charge * Math.PI * 2);
        ctx.stroke();
      }

      // Twin Flame Tire Trails when Boosting
      if (ps.boostTimer > 0) {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(-17, 14, 7, 22);
        ctx.fillRect(10, 14, 7, 22);
      }

      // Gull-wing DeLorean Supercar Body
      ctx.rotate(ps.vx * 0.00045);
      ctx.fillStyle = ps.stunTimer > 0 ? '#475569' : '#0f172a';
      ctx.strokeStyle = ps.underdog ? '#fde047' : ps.color;
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(-16, -18);
      ctx.lineTo(16, -18);
      ctx.lineTo(23, 14);
      ctx.lineTo(-23, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Louvered rear window & neon tail grille
      ctx.fillStyle = ps.color;
      ctx.fillRect(-13, -10, 26, 8);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-18, 6, 11, 5);
      ctx.fillRect(7, 6, 11, 5);

      // Player Tag + MPH
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${ps.name} • ${Math.round(ps.score)} (${ps.speedMph}MPH)`, 0, 30);

      ctx.restore();
    }

    // 6. Floating Callouts
    for (const c of this.callouts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, c.life));
      ctx.fillStyle = c.color;
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    }

    // 7. Translucent HUD Banner
    ctx.fillStyle = 'rgba(9, 4, 24, 0.72)';
    ctx.fillRect(0, 0, width, 36);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `⏱ ${Math.ceil(this.roundTimer)}s | Theme: ${theme.name} [T]`,
      14,
      22
    );
    ctx.textAlign = 'right';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(
      'Steer: Lanes & Draft • Hold Action (72-98%): 88MPH Flux Warp & Side-Swipe',
      width - 14,
      22
    );
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.values())
      .sort((a, b) => b.score - a.score)
      .map((ps, idx) => ({
        playerId: ps.id,
        score: Math.round(ps.score),
        place: idx + 1
      }));

    return {
      winnerId: rankings[0]?.playerId ?? null,
      rankings,
      mvpHighlight: 'Blazed down the Synthwave Sunset Highway at 88 MPH!'
    };
  }

  public handlePointerDown(_x: number, _y: number, _width: number, _height: number): boolean {
    return false;
  }
}

import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type InsectType = 'firefly' | 'dragonfly' | 'golden_beetle' | 'butterfly' | 'wasp';

interface Insect {
  id: number;
  type: InsectType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  value: number;
  color: string;
  wingAngle: number;
  flutterSpeed: number;
  caughtBy: PlayerId | null;
  destroyed: boolean;
}

interface FrogPlayer {
  id: PlayerId;
  baseX: number;
  baseY: number;
  centerAngle: number;
  aimAngle: number;
  sweepDir: number;
  minAimAngle: number;
  maxAimAngle: number;
  tongueState: 'IDLE' | 'EXTENDING' | 'RETRACTING';
  tongueLength: number;
  maxTongueLength: number;
  mouthOpen: number; // 0 to 1
  stunTimer: number;
  score: number;
  insectsCaught: number;
  caughtInsect: Insect | null;
  botReactionTimer: number;
}

export class ChompFrogsGame extends BaseGame {
  private playersState: Map<PlayerId, FrogPlayer> = new Map();
  private insects: Insect[] = [];
  private currentMapName: string = 'Lotus Pond';
  private pondCenterX: number = 0;
  private pondCenterY: number = 0;
  private pondRadius: number = 220;
  private insectCounter: number = 0;
  private spawnTimer: number = 0;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 40;
    this.insects = [];
    this.insectCounter = 0;
    this.spawnTimer = 0;

    this.pondCenterX = width / 2;
    this.pondCenterY = height / 2 + 18;
    this.pondRadius = Math.min(width, height) * 0.38;

    this.generateProceduralMap(width, height);
    this.initPlayers(width, height);

    // Initial insect wave
    for (let i = 0; i < 14; i++) {
      this.spawnInsect();
    }
  }

  private initPlayers(width: number, height: number): void {
    this.playersState.clear();
    const active = this.getActivePlayers();
    const isTwoPlayer = active.length === 2;

    if (isTwoPlayer) {
      // P1 on Left, P2 on Right facing center
      const pad = 65;
      const leftAngle = 0; // facing right
      const rightAngle = Math.PI; // facing left

      const configs = [
        {
          x: pad,
          y: this.pondCenterY,
          centerAngle: leftAngle,
          minA: -Math.PI * 0.35,
          maxA: Math.PI * 0.35
        },
        {
          x: width - pad,
          y: this.pondCenterY,
          centerAngle: rightAngle,
          minA: Math.PI * 0.65,
          maxA: Math.PI * 1.35
        }
      ];

      active.forEach((p, idx) => {
        const c = configs[idx % configs.length];
        this.playersState.set(p.id, {
          id: p.id,
          baseX: c.x,
          baseY: c.y,
          centerAngle: c.centerAngle,
          aimAngle: c.centerAngle,
          sweepDir: 1,
          minAimAngle: c.minA,
          maxAimAngle: c.maxA,
          tongueState: 'IDLE',
          tongueLength: 0,
          maxTongueLength: width * 0.44,
          mouthOpen: 0,
          stunTimer: 0,
          score: 0,
          insectsCaught: 0,
          caughtInsect: null,
          botReactionTimer: 0.2 + idx * 0.1
        });
      });
    } else {
      // 3 or 4 Players: 4 Corner pond bank positions
      const cornerPad = 72;
      const configs = [
        {
          x: cornerPad,
          y: this.pondCenterY - this.pondRadius * 0.75,
          centerAngle: Math.PI * 0.22,
          minA: 0,
          maxA: Math.PI * 0.44
        }, // Top-Left
        {
          x: width - cornerPad,
          y: this.pondCenterY - this.pondRadius * 0.75,
          centerAngle: Math.PI * 0.78,
          minA: Math.PI * 0.56,
          maxA: Math.PI
        }, // Top-Right
        {
          x: cornerPad,
          y: this.pondCenterY + this.pondRadius * 0.75,
          centerAngle: -Math.PI * 0.22,
          minA: -Math.PI * 0.44,
          maxA: 0
        }, // Bottom-Left
        {
          x: width - cornerPad,
          y: this.pondCenterY + this.pondRadius * 0.75,
          centerAngle: -Math.PI * 0.78,
          minA: -Math.PI,
          maxA: -Math.PI * 0.56
        } // Bottom-Right
      ];

      active.forEach((p, idx) => {
        const c = configs[idx % configs.length];
        this.playersState.set(p.id, {
          id: p.id,
          baseX: c.x,
          baseY: c.y,
          centerAngle: c.centerAngle,
          aimAngle: c.centerAngle,
          sweepDir: 1,
          minAimAngle: c.minA,
          maxAimAngle: c.maxA,
          tongueState: 'IDLE',
          tongueLength: 0,
          maxTongueLength: this.pondRadius * 1.5,
          mouthOpen: 0,
          stunTimer: 0,
          score: 0,
          insectsCaught: 0,
          caughtInsect: null,
          botReactionTimer: 0.2 + idx * 0.1
        });
      });
    }
  }

  private generateProceduralMap(width: number, height: number): void {
    const maps = [
      'Lotus Pond',
      'Swamp Hollow',
      'Mushroom Marsh',
      'Firefly Bayou'
    ];
    this.currentMapName = maps[Math.floor(Math.random() * maps.length)];
  }

  private spawnInsect(): void {
    // Pick random position within center pond zone
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDist = Math.random() * (this.pondRadius * 0.75);
    const x = this.pondCenterX + Math.cos(spawnAngle) * spawnDist;
    const y = this.pondCenterY + Math.sin(spawnAngle) * spawnDist;

    // Pick insect type
    const roll = Math.random();
    let type: InsectType = 'firefly';
    let value = 100;
    let color = '#FDE047';
    let radius = 10;
    let speed = 40 + Math.random() * 30;

    if (roll < 0.45) {
      type = 'firefly';
      value = 100;
      color = '#FDE047';
      radius = 9;
      speed = 35;
    } else if (roll < 0.68) {
      type = 'dragonfly';
      value = 150;
      color = '#38BDF8';
      radius = 11;
      speed = 65;
    } else if (roll < 0.82) {
      type = 'wasp';
      value = -150;
      color = '#EF4444';
      radius = 12;
      speed = 50;
    } else if (roll < 0.93) {
      type = 'golden_beetle';
      value = 250;
      color = '#F59E0B';
      radius = 13;
      speed = 45;
    } else {
      type = 'butterfly';
      value = 400;
      color = '#EC4899';
      radius = 14;
      speed = 80;
    }

    const moveAngle = Math.random() * Math.PI * 2;
    this.insects.push({
      id: ++this.insectCounter,
      type,
      x,
      y,
      vx: Math.cos(moveAngle) * speed,
      vy: Math.sin(moveAngle) * speed,
      radius,
      value,
      color,
      wingAngle: 0,
      flutterSpeed: 15 + Math.random() * 10,
      caughtBy: null,
      destroyed: false
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bot inputs via BaseGame
    this.updateBots(dt, width, height);

    // Insect Spawner maintenance
    this.spawnTimer -= dt;
    const activeInsects = this.insects.filter((ins) => !ins.destroyed && ins.caughtBy === null);
    if (this.spawnTimer <= 0 && activeInsects.length < 18) {
      this.spawnInsect();
      this.spawnTimer = 1.1 + Math.random() * 0.8;
    }

    // Update Insects motion
    for (const ins of this.insects) {
      if (ins.destroyed) continue;

      ins.wingAngle += ins.flutterSpeed * dt;

      if (ins.caughtBy === null) {
        // Natural wandering inside pond
        ins.x += ins.vx * dt;
        ins.y += ins.vy * dt;

        // Bounce gently inside pond boundary
        const distFromCenter = Math.hypot(ins.x - this.pondCenterX, ins.y - this.pondCenterY);
        if (distFromCenter > this.pondRadius * 0.88) {
          const normalAngle = Math.atan2(ins.y - this.pondCenterY, ins.x - this.pondCenterX);
          ins.vx = -Math.cos(normalAngle) * Math.abs(ins.vx);
          ins.vy = -Math.sin(normalAngle) * Math.abs(ins.vy);
        }
      }
    }

    // Update Frog Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      // Handle Stun
      if (ps.stunTimer > 0) {
        ps.stunTimer = Math.max(0, ps.stunTimer - dt);
        ps.tongueState = 'IDLE';
        ps.tongueLength = 0;
        ps.mouthOpen = 0;
        continue;
      }

      // Frog Aim Oscillations (when idle)
      if (ps.tongueState === 'IDLE') {
        const sweepSpeed = 1.6; // rad/s
        ps.aimAngle += ps.sweepDir * sweepSpeed * dt;
        if (ps.aimAngle > ps.maxAimAngle) {
          ps.aimAngle = ps.maxAimAngle;
          ps.sweepDir = -1;
        } else if (ps.aimAngle < ps.minAimAngle) {
          ps.aimAngle = ps.minAimAngle;
          ps.sweepDir = 1;
        }

        // Steer override with joystick/keys if available
        const steer = this.input.getSteer(p.id);
        if (Math.abs(steer) > 0.3) {
          ps.aimAngle = Math.max(ps.minAimAngle, Math.min(ps.maxAimAngle, ps.aimAngle + steer * 2.5 * dt));
        }

        // Check for tongue fire
        const shoot = this.input.justAction(p.id) || (this.input.justPressed(p.id) && Math.abs(steer) <= 0.3);

        if (shoot) {
          ps.tongueState = 'EXTENDING';
          ps.mouthOpen = 1;
          this.audio.playWhoosh();
        }
      } else if (ps.tongueState === 'EXTENDING') {
        const shootSpeed = 640; // px/s
        ps.tongueLength += shootSpeed * dt;

        const tipX = ps.baseX + Math.cos(ps.aimAngle) * ps.tongueLength;
        const tipY = ps.baseY + Math.sin(ps.aimAngle) * ps.tongueLength;

        // Collision check with insects
        let hit = false;
        for (const ins of this.insects) {
          if (ins.destroyed || ins.caughtBy !== null) continue;

          const dist = Math.hypot(tipX - ins.x, tipY - ins.y);
          if (dist <= ins.radius + 14) {
            // Snagged!
            ins.caughtBy = ps.id;
            ps.caughtInsect = ins;
            ps.tongueState = 'RETRACTING';
            hit = true;

            if (ins.type === 'wasp') {
              this.audio.playStun();
              this.particles.shake(0.3);
            } else {
              this.audio.playTap();
            }
            break;
          }
        }

        // Max range check
        if (!hit && ps.tongueLength >= ps.maxTongueLength) {
          ps.tongueState = 'RETRACTING';
        }
      } else if (ps.tongueState === 'RETRACTING') {
        const snapSpeed = 720; // px/s
        ps.tongueLength -= snapSpeed * dt;

        const tipX = ps.baseX + Math.cos(ps.aimAngle) * ps.tongueLength;
        const tipY = ps.baseY + Math.sin(ps.aimAngle) * ps.tongueLength;

        if (ps.caughtInsect) {
          ps.caughtInsect.x = tipX;
          ps.caughtInsect.y = tipY;
        }

        // Fully retracted
        if (ps.tongueLength <= 0) {
          ps.tongueLength = 0;
          ps.tongueState = 'IDLE';
          ps.mouthOpen = 0;

          if (ps.caughtInsect) {
            const ins = ps.caughtInsect;
            ins.destroyed = true;

            if (ins.type === 'wasp') {
              // Wasp Sting!
              ps.score = Math.max(0, ps.score + ins.value);
              ps.stunTimer = 1.6;
              this.particles.showFloatingText('STUNG! -150', ps.baseX, ps.baseY - 32, '#EF4444', 24);
              this.particles.spawnExplosion(ps.baseX, ps.baseY, '#EF4444', 18);
            } else {
              // Delicious Chomp!
              ps.score += ins.value;
              ps.insectsCaught += 1;
              this.audio.playChomp();
              this.particles.showFloatingText(`+${ins.value}`, ps.baseX, ps.baseY - 30, ins.color, 24);
              this.particles.spawnConfetti(ps.baseX, ps.baseY, 15);
            }

            ps.caughtInsect = null;
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.tongueState !== 'IDLE' || ps.stunTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    const tolerance =
      difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.09 : 0.16;
    ps.botReactionTimer = 0.06;

    let bestScore = -9999;
    let targetAngle = 0;

    for (const ins of this.insects) {
      if (ins.destroyed || ins.caughtBy !== null) continue;

      const dx = ins.x - ps.baseX;
      const dy = ins.y - ps.baseY;
      const angle = Math.atan2(dy, dx);

      if (angle < ps.minAimAngle || angle > ps.maxAimAngle) continue;

      const dist = Math.hypot(dx, dy);
      if (dist > ps.maxTongueLength * 0.95) continue;

      let score = (ins.value / dist) * 100;
      if (ins.type === 'wasp') score = -500;
      if (ins.type === 'golden_beetle') score += 120;
      if (ins.type === 'butterfly') score += 200;

      if (score > bestScore) {
        bestScore = score;
        targetAngle = angle;
      }
    }

    const angleDiff = targetAngle - ps.aimAngle;
    let steerDir = 0;
    if (Math.abs(angleDiff) > 0.05) {
      steerDir = angleDiff > 0 ? 1 : -1;
    }

    if (difficulty === 'bot_easy') {
      // Easy bots mostly rely on passive sweep
      if (Math.random() < 0.7) steerDir = 0;
    }

    if (bestScore > 0 && Math.abs(angleDiff) < tolerance) {
      if (difficulty === 'bot_easy' && Math.random() < 0.35) {
        this.input.setBotInput(botId, false, 0, 0, false);
        return;
      }
      this.input.setBotInput(botId, true, steerDir, 0, true);
    } else {
      this.input.setBotInput(botId, false, steerDir, 0, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Lush Pond Background
    ctx.fillStyle = '#064E3B';
    ctx.fillRect(0, 0, width, height);

    // Deep Pond Waters
    const pondGrad = ctx.createRadialGradient(
      this.pondCenterX,
      this.pondCenterY,
      20,
      this.pondCenterX,
      this.pondCenterY,
      this.pondRadius
    );
    pondGrad.addColorStop(0, '#0284C7');
    pondGrad.addColorStop(0.7, '#0369A1');
    pondGrad.addColorStop(1, '#075985');

    ctx.beginPath();
    ctx.arc(this.pondCenterX, this.pondCenterY, this.pondRadius, 0, Math.PI * 2);
    ctx.fillStyle = pondGrad;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#047857';
    ctx.stroke();

    // Water Ripple Glints
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    const ripOffset = (performance.now() * 0.03) % 50;
    for (let r = 30 + ripOffset; r < this.pondRadius; r += 50) {
      ctx.beginPath();
      ctx.arc(this.pondCenterX, this.pondCenterY, r, 0.2, 1.4);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.stroke();
    }

    // 2. Insects
    for (const ins of this.insects) {
      if (ins.destroyed) continue;
      this.renderInsect(ctx, ins);
    }

    // 3. Frogs & Tongues
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderFrogPlayer(ctx, ps, p.color);
    }

    // 4. Center HUD Pod
    this.renderCenterHudPod(ctx, width);
  }

  private renderInsect(ctx: CanvasRenderingContext2D, ins: Insect): void {
    ctx.save();
    ctx.translate(ins.x, ins.y);

    // Fluttering Translucent Wings
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    const wingFlap = Math.sin(ins.wingAngle) * 6;

    ctx.beginPath();
    ctx.ellipse(-ins.radius * 0.6, -wingFlap, ins.radius * 0.7, ins.radius * 0.35, 0.3, 0, Math.PI * 2);
    ctx.ellipse(ins.radius * 0.6, -wingFlap, ins.radius * 0.7, ins.radius * 0.35, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.arc(0, 0, ins.radius, 0, Math.PI * 2);
    ctx.fillStyle = ins.color;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    // Glowing core
    if (ins.type === 'firefly' || ins.type === 'golden_beetle' || ins.type === 'butterfly') {
      ctx.beginPath();
      ctx.arc(0, 0, ins.radius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    } else if (ins.type === 'wasp') {
      // Wasp warning stripes
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-ins.radius * 0.5, -ins.radius * 0.3, ins.radius, 2);
      ctx.fillRect(-ins.radius * 0.5, ins.radius * 0.2, ins.radius, 2);
    }

    ctx.restore();
  }

  private renderFrogPlayer(
    ctx: CanvasRenderingContext2D,
    ps: FrogPlayer,
    color: string
  ): void {
    // 1. Lily Pad Perch
    ctx.fillStyle = '#15803D';
    ctx.beginPath();
    ctx.arc(ps.baseX, ps.baseY, 26, 0.3, Math.PI * 1.8);
    ctx.lineTo(ps.baseX, ps.baseY);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#14532D';
    ctx.stroke();

    // 2. Elastic Sticky Tongue (if extended)
    if (ps.tongueLength > 0) {
      const tipX = ps.baseX + Math.cos(ps.aimAngle) * ps.tongueLength;
      const tipY = ps.baseY + Math.sin(ps.aimAngle) * ps.tongueLength;

      // Elastic pink rope
      ctx.beginPath();
      ctx.moveTo(ps.baseX, ps.baseY);
      ctx.lineTo(tipX, tipY);
      ctx.strokeStyle = '#F43F5E';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Sticky suction tip bulb
      ctx.beginPath();
      ctx.arc(tipX, tipY, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#BE123C';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    }

    // 3. Frog Body
    ctx.save();
    ctx.translate(ps.baseX, ps.baseY);
    ctx.rotate(ps.aimAngle);

    // Frog Main Torso
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    // Bulging Frog Eyes
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(6, -11, 5.5, 0, Math.PI * 2);
    ctx.arc(6, 11, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    // Pupils (dizzy if stunned, normal otherwise)
    ctx.fillStyle = '#0F172A';
    if (ps.stunTimer > 0) {
      // Dizzy X eyes
      ctx.font = '700 8px monospace';
      ctx.fillText('X', 4, -9);
      ctx.fillText('X', 4, 13);
    } else {
      ctx.beginPath();
      ctx.arc(8, -11, 2.5, 0, Math.PI * 2);
      ctx.arc(8, 11, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Frog Mouth
    ctx.beginPath();
    if (ps.mouthOpen > 0) {
      ctx.ellipse(10, 0, 6, 8, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#991B1B';
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.arc(10, 0, 6, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();

    // Score Tag above frog
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${ps.score} pts`, ps.baseX, ps.baseY - 32);
  }

  private renderCenterHudPod(ctx: CanvasRenderingContext2D, width: number): void {
    const podW = 340;
    const podH = 26;
    const podX = width / 2 - podW / 2;
    const podY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 13);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Map Name Badge
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#34D399';
    ctx.fillText(`POND: ${this.currentMapName}`, podX + 16, podY + 17);

    // Timer display
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    const timerColor = this.roundTimer < 10 ? '#EF4444' : '#F1F5F9';
    ctx.fillStyle = timerColor;
    ctx.fillText(`TIME: ${this.roundTimer.toFixed(1)}s`, podX + podW - 16, podY + 17);
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const rankings = active
      .map((p) => {
        const ps = this.playersState.get(p.id);
        const score = ps ? ps.score : 0;
        return { playerId: p.id, score, place: 1 };
      })
      .sort((a, b) => b.score - a.score);

    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });

    const winnerId =
      rankings.length > 0 && (rankings.length === 1 || rankings[0].score > rankings[1].score)
        ? rankings[0].playerId
        : null;

    let mvpHighlight = 'Pond Apex Predator!';
    if (winnerId !== null) {
      const ps = this.playersState.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} snagged ${ps?.insectsCaught || 0} insects!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}

import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface PaintPlayer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  score: number;
  fireCooldown: number;
  stunTimer: number;
}

interface PaintPellet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: PlayerId;
  color: string;
  bounces: number;
  lifetime: number;
}

interface PaintSplat {
  x: number;
  y: number;
  radius: number;
  color: string;
}

interface TargetPinata {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  radius: number;
}

interface ArenaBunker {
  x: number;
  y: number;
  radius: number;
  color: string;
}

export class PixelPaintballGame extends BaseGame {
  private playersState: Map<PlayerId, PaintPlayer> = new Map();
  private pellets: PaintPellet[] = [];
  private splats: PaintSplat[] = [];
  private pinatas: TargetPinata[] = [];
  private bunkers: ArenaBunker[] = [];
  private spawnPinataTimer: number = 2.0;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.roundTimer = 40;
    this.isFinished = false;
    this.playersState.clear();
    this.pellets = [];
    this.splats = [];
    this.pinatas = [];
    this.bunkers = [];

    const cx = width / 2;
    const cy = height / 2;

    // Procedural Tactical Bunker Layout
    this.generateRandomMap(cx, cy, width, height);

    const active = this.getActivePlayers();
    const spawnOffsets = [
      { x: width * 0.22, y: height * 0.28 },
      { x: width * 0.78, y: height * 0.28 },
      { x: width * 0.22, y: height * 0.72 },
      { x: width * 0.78, y: height * 0.72 }
    ];

    active.forEach((p, idx) => {
      const pos = spawnOffsets[idx % spawnOffsets.length];
      this.playersState.set(p.id, {
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: Math.atan2(height / 2 - pos.y, width / 2 - pos.x),
        score: 0,
        fireCooldown: 0,
        stunTimer: 0
      });
    });

    // Spawn 2 initial pinatas
    for (let i = 0; i < 2; i++) {
      this.spawnPinata(width, height);
    }
  }

  public currentMapName: string = 'Speedball X';

  private generateRandomMap(cx: number, cy: number, width: number, height: number): void {
    const archetypes = ['Speedball X', 'Fortress Ring', 'Dual Citadel', 'Scatter Pillboxes'];
    this.currentMapName = archetypes[Math.floor(Math.random() * archetypes.length)];
    this.bunkers = [];

    switch (this.currentMapName) {
      case 'Speedball X':
        // Central X formation + 4 flank bunkers
        this.bunkers = [
          { x: cx, y: cy, radius: 26, color: '#38BDF8' },
          { x: cx - width * 0.22, y: cy, radius: 22, color: '#EC4899' },
          { x: cx + width * 0.22, y: cy, radius: 22, color: '#EC4899' },
          { x: cx, y: cy - height * 0.18, radius: 20, color: '#FACC15' },
          { x: cx, y: cy + height * 0.18, radius: 20, color: '#10B981' }
        ];
        break;

      case 'Fortress Ring':
        // Hexagonal ring of 6 protective barricades
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2;
          const dist = Math.min(width, height) * 0.24;
          const colors = ['#38BDF8', '#EC4899', '#FACC15', '#10B981', '#A855F7', '#F97316'];
          this.bunkers.push({
            x: cx + Math.cos(ang) * dist,
            y: cy + Math.sin(ang) * dist,
            radius: 21,
            color: colors[i % colors.length]
          });
        }
        break;

      case 'Dual Citadel':
        // Two large defensive shields with 4 angled rebound corners
        this.bunkers = [
          { x: cx - width * 0.14, y: cy, radius: 28, color: '#38BDF8' },
          { x: cx + width * 0.14, y: cy, radius: 28, color: '#EC4899' },
          { x: cx, y: cy - height * 0.24, radius: 18, color: '#10B981' },
          { x: cx, y: cy + height * 0.24, radius: 18, color: '#FACC15' },
          { x: cx - width * 0.28, y: cy - height * 0.15, radius: 18, color: '#8B5CF6' },
          { x: cx + width * 0.28, y: cy + height * 0.15, radius: 18, color: '#8B5CF6' }
        ];
        break;

      case 'Scatter Pillboxes':
      default:
        // 7 procedurally scattered bunkers ensuring open lines for players
        const scatterColors = ['#38BDF8', '#EC4899', '#FACC15', '#10B981', '#A855F7', '#EF4444', '#06B6D4'];
        this.bunkers.push({ x: cx, y: cy, radius: 24, color: '#FBBF24' });
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 + 0.25;
          const dist = (i % 2 === 0 ? 0.26 : 0.18) * Math.min(width, height);
          this.bunkers.push({
            x: cx + Math.cos(ang) * dist,
            y: cy + Math.sin(ang) * dist,
            radius: 20 + (i % 3) * 2,
            color: scatterColors[i % scatterColors.length]
          });
        }
        break;
    }
  }

  private spawnPinata(width: number, height: number) {
    this.pinatas.push({
      x: width * 0.35 + Math.random() * width * 0.3,
      y: height * 0.35 + Math.random() * height * 0.3,
      vx: (Math.random() - 0.5) * 80,
      vy: (Math.random() - 0.5) * 80,
      hp: 3,
      radius: 18
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    // Spawn pinatas periodically
    this.spawnPinataTimer -= dt;
    if (this.spawnPinataTimer <= 0 && this.pinatas.length < 3) {
      this.spawnPinata(width, height);
      this.spawnPinataTimer = 6.0;
    }

    // Update Pinatas
    for (const pinata of this.pinatas) {
      pinata.x += pinata.vx * dt;
      pinata.y += pinata.vy * dt;

      if (pinata.x < 60 || pinata.x > width - 60) pinata.vx *= -1;
      if (pinata.y < 80 || pinata.y > height - 80) pinata.vy *= -1;
    }

    // Bot AI
    this.updateBots(dt, width, height);

    // Update Players
    const active = this.getActivePlayers();
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        continue;
      }

      if (ps.fireCooldown > 0) ps.fireCooldown -= dt;

      const steer = this.input.getSteer(p.id);
      const isAction = this.input.isActionPressed(p.id);
      const isFiring = isAction || (this.input.isPressed(p.id) && steer === 0);

      if (steer !== 0) {
        ps.angle += steer * 4.2 * dt;
        const speed = isAction ? 240 : 200;
        ps.vx = Math.cos(ps.angle) * speed;
        ps.vy = Math.sin(ps.angle) * speed;
      } else if (isFiring) {
        // Single-button mobile mode or Space hold: drive forward while firing!
        const speed = 190;
        ps.vx = Math.cos(ps.angle) * speed;
        ps.vy = Math.sin(ps.angle) * speed;
      } else {
        // Idle scan when not holding button
        ps.angle += 2.2 * dt;
        ps.vx *= Math.pow(0.85, dt * 60);
        ps.vy *= Math.pow(0.85, dt * 60);
      }

      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Bunker collisions for players
      const r = 16;
      for (const b of this.bunkers) {
        const db = Math.hypot(ps.x - b.x, ps.y - b.y);
        if (db < b.radius + r && db > 0.01) {
          const nx = (ps.x - b.x) / db;
          const ny = (ps.y - b.y) / db;
          ps.x = b.x + nx * (b.radius + r);
          ps.y = b.y + ny * (b.radius + r);
        }
      }

      // Arena boundaries
      ps.x = Math.max(r + 10, Math.min(width - r - 10, ps.x));
      ps.y = Math.max(r + 65, Math.min(height - r - 65, ps.y));

      // Firing Paint Pellets
      if (isFiring && ps.fireCooldown <= 0) {
        ps.fireCooldown = 0.22;
        this.audio.playLaser();

        const pelletSpeed = 520;
        this.pellets.push({
          x: ps.x + Math.cos(ps.angle) * 18,
          y: ps.y + Math.sin(ps.angle) * 18,
          vx: Math.cos(ps.angle) * pelletSpeed + (Math.random() - 0.5) * 40,
          vy: Math.sin(ps.angle) * pelletSpeed + (Math.random() - 0.5) * 40,
          ownerId: p.id,
          color: p.color,
          bounces: 0,
          lifetime: 1.4
        });
      }
    }

    // Update Pellets
    for (let i = this.pellets.length - 1; i >= 0; i--) {
      const pel = this.pellets[i];
      pel.lifetime -= dt;
      if (pel.lifetime <= 0) {
        this.pellets.splice(i, 1);
        continue;
      }

      pel.x += pel.vx * dt;
      pel.y += pel.vy * dt;

      // Bunker Ricochets
      let bounced = false;
      for (const b of this.bunkers) {
        const db = Math.hypot(pel.x - b.x, pel.y - b.y);
        if (db < b.radius + 5) {
          const nx = (pel.x - b.x) / db;
          const ny = (pel.y - b.y) / db;
          const dot = pel.vx * nx + pel.vy * ny;
          pel.vx -= 2 * dot * nx;
          pel.vy -= 2 * dot * ny;
          pel.x = b.x + nx * (b.radius + 6);
          pel.y = b.y + ny * (b.radius + 6);
          bounced = true;
          this.audio.playBounce();
          break;
        }
      }

      // Arena Wall Bounce & Splat
      if (pel.x < 15 || pel.x > width - 15) {
        pel.vx *= -1;
        bounced = true;
      }
      if (pel.y < 70 || pel.y > height - 70) {
        pel.vy *= -1;
        bounced = true;
      }

      if (bounced) {
        pel.bounces++;
        this.audio.playBounce();

        // Floor / Wall Splat Mark
        if (this.splats.length > 80) this.splats.shift();
        this.splats.push({
          x: pel.x,
          y: pel.y,
          radius: 8 + Math.random() * 8,
          color: pel.color
        });

        if (pel.bounces >= 2) {
          this.pellets.splice(i, 1);
          continue;
        }
      }

      // Check Pinata Hit
      let hitPinata = false;
      for (let j = this.pinatas.length - 1; j >= 0; j--) {
        const pin = this.pinatas[j];
        if (Math.hypot(pel.x - pin.x, pel.y - pin.y) < pin.radius + 6) {
          pin.hp--;
          hitPinata = true;
          this.audio.playBounce();

          // Particle burst
          this.particles.spawnSparks(pin.x, pin.y, '#F59E0B', 8);

          if (pin.hp <= 0) {
            this.pinatas.splice(j, 1);
            const owner = this.playersState.get(pel.ownerId);
            if (owner) {
              owner.score += 3;
              this.audio.playTone(660, 0.1, 'triangle');
              setTimeout(() => this.audio.playTone(990, 0.15, 'sine'), 80);
              this.particles.spawnExplosion(pin.x, pin.y, '#F59E0B', 24);
              this.particles.showFloatingText('+3 PIÑATA BUST!', pin.x, pin.y - 12, '#FACC15', 18);
              if (owner.score >= 15) this.isFinished = true;
            }
          }
          break;
        }
      }
      if (hitPinata) {
        this.pellets.splice(i, 1);
        continue;
      }

      // Check Player Hit
      for (const p of active) {
        if (p.id === pel.ownerId) continue;
        const ps = this.playersState.get(p.id);
        if (!ps || ps.stunTimer > 0) continue;

        if (Math.hypot(pel.x - ps.x, pel.y - ps.y) < 18) {
          // Paintball Tag!
          ps.stunTimer = 1.0;
          ps.vx = pel.vx * 0.4;
          ps.vy = pel.vy * 0.4;

          const shooter = this.playersState.get(pel.ownerId);
          if (shooter) {
            shooter.score += 1;
            this.audio.playScore();
            if (shooter.score >= 15) this.isFinished = true;
          }

          // Massive colored splat on floor
          this.splats.push({
            x: ps.x,
            y: ps.y,
            radius: 20 + Math.random() * 8,
            color: pel.color
          });

          this.particles.shake(0.3);
          this.audio.playStun();
          this.pellets.splice(i, 1);
          break;
        }
      }
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

    // Nearest opponent
    let nearestOpp: PaintPlayer | null = null;
    let minOppDist = Infinity;
    for (const [id, opp] of this.playersState.entries()) {
      if (id === botId) continue;
      const d = Math.hypot(opp.x - ps.x, opp.y - ps.y);
      if (d < minOppDist) {
        minOppDist = d;
        nearestOpp = opp;
      }
    }

    // Nearest pinata
    let nearestPinata: TargetPinata | null = null;
    let minPinDist = Infinity;
    for (const pin of this.pinatas) {
      const d = Math.hypot(pin.x - ps.x, pin.y - ps.y);
      if (d < minPinDist) {
        minPinDist = d;
        nearestPinata = pin;
      }
    }

    if (difficulty === 'bot_easy') {
      if (Math.random() < 0.04) {
        ps.angle = Math.random() * Math.PI * 2;
      }
      this.input.setBotPressed(botId, Math.random() < 0.25);
    } else if (difficulty === 'bot_normal') {
      const target = nearestPinata && minPinDist < 250 ? nearestPinata : nearestOpp;
      if (target) {
        ps.angle = Math.atan2(target.y - ps.y, target.x - ps.x);
        this.input.setBotPressed(botId, Math.random() < 0.65);
      }
    } else {
      // Hard: tactical kiting & rapid pinpoint bursts
      const target = nearestPinata || nearestOpp;
      if (target) {
        const leadX = target.x + (target.vx || 0) * 0.15;
        const leadY = target.y + (target.vy || 0) * 0.15;
        ps.angle = Math.atan2(leadY - ps.y, leadX - ps.x);

        // Keep distance if opponent is rushing
        if (minOppDist < 120 && nearestOpp) {
          ps.angle = Math.atan2(ps.y - nearestOpp.y, ps.x - nearestOpp.x);
        }

        this.input.setBotPressed(botId, true);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Indoor Laser Paintball Arena Floor
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, width, height);

    // Floor tactical grid
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 60);
      ctx.lineTo(x, height - 60);
      ctx.stroke();
    }
    for (let y = 60; y < height - 60; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Render Paint Splats on Floor
    for (const splat of this.splats) {
      ctx.save();
      ctx.fillStyle = splat.color + '66';
      ctx.beginPath();
      ctx.arc(splat.x, splat.y, splat.radius, 0, Math.PI * 2);
      ctx.fill();

      // Droplet specks
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(splat.x + Math.cos(a) * (splat.radius + 4), splat.y + Math.sin(a) * (splat.radius + 4), 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Render Tactical Inflatable Bunkers
    for (const b of this.bunkers) {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Inflatable Cylindrical Highlight
      ctx.beginPath();
      ctx.arc(b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.fill();

      // Bunker emblem
      ctx.fillStyle = '#0F172A';
      ctx.font = 'bold 10px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('COVER', b.x, b.y);
      ctx.restore();
    }

    // Render Pinatas
    for (const pin of this.pinatas) {
      ctx.save();
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#FBBF24';
      ctx.beginPath();
      ctx.arc(pin.x, pin.y, pin.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#78350F';
      ctx.font = '900 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`🎯 ${pin.hp}`, pin.x, pin.y + 4.5);
      ctx.restore();
    }

    // Render Paint Pellets
    for (const pel of this.pellets) {
      ctx.save();
      ctx.shadowColor = pel.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = pel.color;
      ctx.beginPath();
      ctx.arc(pel.x, pel.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Players
    const active = this.getActivePlayers();
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);
      ctx.rotate(ps.angle);

      // Stun overlay if hit
      if (ps.stunTimer > 0) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Blaster Barrel
      ctx.fillStyle = '#334155';
      ctx.fillRect(8, -3.5, 12, 7);

      // Rover Body
      ctx.shadowColor = p.colorDark;
      ctx.shadowBlur = 8;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Paint Hopper Tank on back
      ctx.fillStyle = p.colorLight;
      ctx.beginPath();
      ctx.arc(-6, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Spinning Cartoon Stun Stars
      if (ps.stunTimer > 0) {
        ctx.save();
        for (let s = 0; s < 3; s++) {
          const sAngle = (Date.now() * 0.008) + (s * Math.PI * 2 / 3);
          const sx = ps.x + Math.cos(sAngle) * 16;
          const sy = ps.y - 20 + Math.sin(sAngle) * 6;
          ctx.fillStyle = '#FACC15';
          ctx.shadowColor = '#FACC15';
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(sx, sy, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Player Name
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, ps.x, ps.y - 20);
    }

    // Top Center Score Corridor
    const hudW = 290;
    const hudH = 26;
    const hudX = width / 2 - hudW / 2;
    const hudY = 56;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(hudX, hudY, hudW, hudH, 13);
    else ctx.rect(hudX, hudY, hudW, hudH);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    let summary = active.map((p) => {
      const ps = this.playersState.get(p.id);
      return `${p.name}: 🎨 ${ps?.score || 0}/15`;
    }).join('   •   ');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(summary, width / 2, hudY + 17);
  }

  public isRoundOver(): boolean {
    if (this.isFinished) return true;
    for (const ps of this.playersState.values()) {
      if (ps.score >= 15) return true;
    }
    return false;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    let winnerId: PlayerId | null = null;
    let highestScore = -1;

    active.forEach((p) => {
      const ps = this.playersState.get(p.id);
      const sc = ps?.score || 0;
      if (sc > highestScore) {
        highestScore = sc;
        winnerId = p.id;
      }
    });

    const sorted = [...active].sort((a, b) => {
      const scA = this.playersState.get(a.id)?.score || 0;
      const scB = this.playersState.get(b.id)?.score || 0;
      return scB - scA;
    });

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      place: idx + 1,
      score: this.playersState.get(p.id)?.score || 0
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} dominated the Paintball Arena!` : 'Paint splatter covered the arena in a draw!'
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }
}

import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface FloatingHit {
  text: string;
  color: string;
  x: number;
  y: number;
  alpha: number;
  scale: number;
}

interface VaultPin {
  depth: number; // 0 to 100% (100% = burned through)
  thickness: number;
}

interface ThermalDrillHeist {
  id: PlayerId;
  x: number;
  y: number;
  pins: VaultPin[];
  currentPinIdx: number;
  heat: number; // 0 to 100%
  isDrilling: boolean;
  overheated: boolean;
  overheatTimer: number;
  alarmStunTimer: number;
  drillSparksTimer: number;
  doorOpenAnim: number; // 0 to 1
  score: number;
  combo: number;
  shakeTimer: number;
  floatingHits: FloatingHit[];
}

export class VaultSafeGame extends BaseGame {
  private heists: Map<PlayerId, ThermalDrillHeist> = new Map();
  public currentMapName: string = 'High-Sec Federal Reserve Vault';

  private securityLaserX: number = 0;
  private securityLaserDir: number = 1;
  private botReactionTimers: Map<PlayerId, number> = new Map();

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 35.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.heists.clear();
    this.botReactionTimers.clear();
    this.securityLaserX = width * 0.15;
    this.securityLaserDir = 1;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.heists.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height * 0.52,
        pins: [
          { depth: 0, thickness: 100 },
          { depth: 0, thickness: 120 },
          { depth: 0, thickness: 140 }
        ],
        currentPinIdx: 0,
        heat: 15,
        isDrilling: false,
        overheated: false,
        overheatTimer: 0,
        alarmStunTimer: 0,
        drillSparksTimer: 0,
        doorOpenAnim: 0,
        score: 0,
        combo: 0,
        shakeTimer: 0,
        floatingHits: []
      });
      this.botReactionTimers.set(p.id, 0.2 + Math.random() * 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Sweeping security alarm laser
    this.securityLaserX += this.securityLaserDir * 180 * dt;
    if (this.securityLaserX > width * 0.88) {
      this.securityLaserX = width * 0.88;
      this.securityLaserDir = -1;
    } else if (this.securityLaserX < width * 0.12) {
      this.securityLaserX = width * 0.12;
      this.securityLaserDir = 1;
    }

    this.updateBots(dt, width, height);

    let allVaultsBreached = true;

    for (const p of this.getActivePlayers()) {
      const h = this.heists.get(p.id);
      if (!h) continue;

      // Update cooldowns
      if (h.overheatTimer > 0) {
        h.overheatTimer -= dt;
        if (h.overheatTimer <= 0) {
          h.overheated = false;
          h.heat = 25;
        }
      }
      if (h.alarmStunTimer > 0) h.alarmStunTimer -= dt;
      if (h.shakeTimer > 0) h.shakeTimer -= dt;

      // If vault door is open, celebrate breach
      if (h.currentPinIdx >= h.pins.length) {
        h.doorOpenAnim = Math.min(1.0, h.doorOpenAnim + dt * 2.0);
        continue;
      }

      allVaultsBreached = false;

      // Update floating texts
      for (let i = h.floatingHits.length - 1; i >= 0; i--) {
        const hit = h.floatingHits[i];
        hit.y -= dt * 32;
        hit.alpha -= dt * 1.5;
        hit.scale = Math.min(1.2, hit.scale + dt * 0.8);
        if (hit.alpha <= 0) {
          h.floatingHits.splice(i, 1);
        }
      }

      // Check player input (hold or press to fire thermal cutter)
      const isPressing = this.input.isPressed(p.id) || this.input.justAction(p.id);
      h.isDrilling = isPressing && h.overheatTimer <= 0 && h.alarmStunTimer <= 0;

      if (h.isDrilling) {
        // Build heat
        h.heat = Math.min(105, h.heat + 55 * dt);

        // Security Laser Sweep detection
        const laserDist = Math.abs(h.x - this.securityLaserX);
        if (laserDist < 28) {
          // ALARM TRIPPED!
          h.alarmStunTimer = 1.0;
          h.combo = 0;
          h.score = Math.max(0, h.score - 15);
          h.shakeTimer = 0.4;
          this.audio.playBuzzer();
          this.particles.emit(h.x, h.y, 10, '#00E5FF');

          h.floatingHits.push({
            text: 'SECURITY SHOCK! -15 🚨',
            color: '#00E5FF',
            x: 0,
            y: -30,
            alpha: 1.0,
            scale: 1.1
          });
          continue;
        }

        // Check Overheat
        if (h.heat >= 100) {
          h.overheated = true;
          h.overheatTimer = 1.25;
          h.combo = 0;
          h.score = Math.max(0, h.score - 10);
          h.shakeTimer = 0.45;
          this.audio.playExplosion();
          this.particles.emit(h.x, h.y - 20, 12, '#37474F');

          h.floatingHits.push({
            text: 'OVERHEATED! -10 🔥',
            color: '#FF1744',
            x: 0,
            y: -30,
            alpha: 1.0,
            scale: 1.2
          });
          continue;
        }

        // Cutting efficiency based on heat sweet spot (70% - 94%)
        const inSweetSpot = h.heat >= 68 && h.heat <= 94;
        const cutRate = inSweetSpot ? 42 : 18; // 2.5x speed in red-hot zone!

        const curPin = h.pins[h.currentPinIdx];
        curPin.depth += cutRate * dt;

        // Particle sparks & audio
        h.drillSparksTimer -= dt;
        if (h.drillSparksTimer <= 0) {
          h.drillSparksTimer = 0.08;
          if (inSweetSpot) {
            this.audio.playLaser();
            this.particles.spawnSparks(h.x - 8, h.y - 25 + h.currentPinIdx * 18, '#FFD700', 6);
          } else {
            this.audio.playTap();
            this.particles.emit(h.x - 8, h.y - 25 + h.currentPinIdx * 18, 3, '#FF9100');
          }
        }

        // Check Pin Burn-through!
        if (curPin.depth >= curPin.thickness) {
          curPin.depth = curPin.thickness;
          h.currentPinIdx++;
          h.combo++;
          const pinPts = 35 + h.combo * 5;
          h.score += pinPts;

          this.audio.playScore();
          this.particles.spawnSparks(h.x, h.y - 10, '#00E676', 14);

          h.floatingHits.push({
            text: `PIN CUT! +${pinPts} ⚡`,
            color: '#00E676',
            x: 0,
            y: -25,
            alpha: 1.0,
            scale: 1.15
          });

          // Check if Vault Door is completely breached!
          if (h.currentPinIdx >= h.pins.length) {
            const vaultJackpot = 120 + h.combo * 15;
            h.score += vaultJackpot;
            this.audio.playChime();
            this.audio.playFanfare();
            this.particles.spawnConfetti(h.x, h.y - 40, 24);

            h.floatingHits.push({
              text: `VAULT BREACHED! +${vaultJackpot} 💰`,
              color: '#FFD700',
              x: 0,
              y: -45,
              alpha: 1.0,
              scale: 1.35
            });
          }
        }
      } else {
        // Cooling down
        h.heat = Math.max(10, h.heat - 70 * dt);
      }
    }

    if (allVaultsBreached || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const h = this.heists.get(botId);
    if (!h || h.currentPinIdx >= h.pins.length || h.overheatTimer > 0 || h.alarmStunTimer > 0) {
      this.input.setBotInput(botId, false);
      return;
    }

    // Check security laser proximity
    const laserDist = Math.abs(h.x - this.securityLaserX);
    const laserApproaching = laserDist < 45;

    let shouldHold = false;

    if (laserApproaching) {
      // Release trigger to dodge security sweep
      if (difficulty === 'bot_easy' && Math.random() < 0.25) shouldHold = true; // Mistake
      else shouldHold = false;
    } else {
      // Maintain heat in sweet spot
      const targetHeat = difficulty === 'bot_hard' ? 88 : difficulty === 'bot_normal' ? 80 : 65;

      if (h.heat < targetHeat) {
        shouldHold = true;
      } else {
        shouldHold = false; // Feather to vent heat
      }
    }

    this.input.setBotInput(botId, shouldHold);

    const nextDelay = difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.14 : 0.22;
    this.botReactionTimers.set(botId, nextDelay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const h = this.heists.get(p.id);
      return {
        playerId: p.id,
        score: h?.score || 0,
        pins: h?.currentPinIdx || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topPins = scores[0]?.pins || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} sliced through ${topPins} tungsten vault pins with master thermal drill control!`
      : 'The bank vault held strong against the thermal drills!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. High-Sec Bank Vault Chamber Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0F172A');
    bgGrad.addColorStop(0.4, '#1E293B');
    bgGrad.addColorStop(0.8, '#334155');
    bgGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // High-tech floor grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx < width; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, 0); ctx.lineTo(gx, height);
      ctx.stroke();
    }

    // 2. Sweeping Security Laser Tripwire
    ctx.save();
    ctx.strokeStyle = '#00E5FF';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#00E5FF';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(this.securityLaserX, 0);
    ctx.lineTo(this.securityLaserX, height);
    ctx.stroke();

    // Laser emitter dot at top
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(this.securityLaserX, 10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Instructions Pill (cleanly positioned below top HUD)
    ctx.save();
    ctx.textAlign = 'center';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 265, 56, 530, 26, 13);
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '700 11px sans-serif';
    ctx.fillStyle = '#BAE6FD';
    ctx.fillText('HOLD TO DRILL • FEATHER IN RED-HOT ZONE (70-90%) • DODGE CYAN LASER SWEEPS!', width / 2, 73);
    ctx.restore();

    // 4. Render Bank Vault Stations
    for (const p of this.getActivePlayers()) {
      const h = this.heists.get(p.id);
      if (!h) continue;

      ctx.save();

      let shakeX = 0;
      let shakeY = 0;
      if (h.shakeTimer > 0) {
        shakeX = Math.sin(h.shakeTimer * 50) * 4;
        shakeY = Math.cos(h.shakeTimer * 40) * 2;
      }
      ctx.translate(h.x + shakeX, h.y + shakeY);

      const vaultW = 88;
      const vaultH = 120;
      const vaultTop = -60;

      // Heavy Reinforced Vault Outer Frame
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.roundRect(-vaultW / 2 - 4, vaultTop - 4, vaultW + 8, vaultH + 8, 8);
      ctx.fill();
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Steel Rivets around vault perimeter
      ctx.fillStyle = '#94A3B8';
      for (let rx = -vaultW / 2 + 2; rx <= vaultW / 2 - 2; rx += 16) {
        ctx.fillRect(rx, vaultTop - 2, 3, 3);
        ctx.fillRect(rx, vaultTop + vaultH - 1, 3, 3);
      }

      // Vault Door (Swings open when breached!)
      ctx.save();
      const openShift = h.doorOpenAnim * 40;
      ctx.translate(-openShift, 0);

      // Vault Door Body
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(-vaultW / 2, vaultTop, vaultW, vaultH, 6);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Heavy Vault Dial Wheel in center
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Wheel Spokes
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(-2, -22, 4, 44);
      ctx.fillRect(-22, -2, 44, 4);

      // Tungsten Lock Pins
      for (let i = 0; i < h.pins.length; i++) {
        const pin = h.pins[i];
        const py = vaultTop + 24 + i * 28;
        const isCut = i < h.currentPinIdx;
        const isCurrent = i === h.currentPinIdx;

        // Pin housing
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(vaultW / 2 - 24, py - 4, 22, 8);

        // Pin body
        if (isCut) {
          ctx.fillStyle = '#22C55E';
          ctx.fillRect(vaultW / 2 - 24, py - 3, 20, 6);
        } else if (isCurrent) {
          const cutPct = pin.depth / pin.thickness;
          ctx.fillStyle = '#F59E0B';
          ctx.fillRect(vaultW / 2 - 24, py - 3, 20 * (1 - cutPct), 6);
          // Molten cutting tip
          ctx.fillStyle = '#EF4444';
          ctx.fillRect(vaultW / 2 - 24 + 20 * (1 - cutPct) - 2, py - 4, 4, 8);
        } else {
          ctx.fillStyle = '#94A3B8';
          ctx.fillRect(vaultW / 2 - 24, py - 3, 20, 6);
        }
      }

      ctx.restore();

      // If Door Opened: Golden Bullion Loot Glow inside vault!
      if (h.doorOpenAnim > 0) {
        ctx.save();
        ctx.fillStyle = '#F59E0B';
        ctx.font = '22px sans-serif';
        ctx.fillText('💎', -10, -5);
        ctx.fillText('💰', 5, 15);
        ctx.restore();
      }

      // THERMAL DRILL & TEMPERATURE GAUGE
      const gaugeY = vaultTop + vaultH + 12;

      // Temperature Label right above gauge
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '800 8.5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`CUTTER HEAT: ${Math.round(h.heat)}%`, 0, gaugeY - 4);

      // Temperature bar container
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(-vaultW / 2, gaugeY, vaultW, 9, 3);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Red-Hot Cutting Sweet Spot Highlight (68% to 94%)
      ctx.fillStyle = 'rgba(239, 68, 68, 0.4)';
      ctx.fillRect(-vaultW / 2 + vaultW * 0.68, gaugeY + 1, vaultW * 0.26, 7);

      // Current Temperature Fill
      const heatRatio = Math.min(1.0, h.heat / 100);
      let heatColor = '#38BDF8';
      if (h.heat >= 68 && h.heat <= 94) heatColor = '#F59E0B'; // Red-hot optimal
      else if (h.heat > 94) heatColor = '#EF4444'; // Danger overheat!

      ctx.fillStyle = heatColor;
      ctx.fillRect(-vaultW / 2 + 1, gaugeY + 1, (vaultW - 2) * heatRatio, 7);

      // Active Thermal Cutter Torch
      if (h.isDrilling) {
        ctx.save();
        const pinY = vaultTop + 24 + h.currentPinIdx * 28;
        ctx.fillStyle = '#CBD5E1';
        ctx.fillRect(vaultW / 2 - 32, pinY - 3, 10, 6);
        // Laser torch flame
        ctx.fillStyle = h.heat >= 68 ? '#F59E0B' : '#38BDF8';
        ctx.beginPath();
        ctx.moveTo(vaultW / 2 - 22, pinY);
        ctx.lineTo(vaultW / 2 - 12, pinY - 4);
        ctx.lineTo(vaultW / 2 - 12, pinY + 4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // OVERHEAT WARNING
      if (h.overheated) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
        ctx.beginPath();
        ctx.roundRect(-vaultW / 2 + 4, -20, vaultW - 8, 24, 4);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 9px monospace';
        ctx.fillText('🔥 OVERHEAT!', 0, -5);
      }

      // ALARM STUN WARNING
      if (h.alarmStunTimer > 0) {
        ctx.fillStyle = 'rgba(6, 182, 212, 0.9)';
        ctx.beginPath();
        ctx.roundRect(-vaultW / 2 + 4, -20, vaultW - 8, 24, 4);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 9px monospace';
        ctx.fillText('🚨 SHOCKED!', 0, -5);
      }

      // Floating hit texts
      for (const hit of h.floatingHits) {
        ctx.save();
        ctx.translate(hit.x, hit.y);
        ctx.scale(hit.scale, hit.scale);
        ctx.globalAlpha = Math.max(0, hit.alpha);
        ctx.font = '900 12px sans-serif';
        ctx.textAlign = 'center';

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(hit.text, 0, 0);

        ctx.fillStyle = hit.color;
        ctx.fillText(hit.text, 0, 0);
        ctx.restore();
      }

      ctx.restore();

      // 5. Station Player Scoreboard
      ctx.save();
      const cardY = h.y + 94;
      const cardW = 100;
      const cardH = 50;

      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(h.x - cardW / 2, cardY, cardW, cardH, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 12px sans-serif';
      ctx.fillText(p.name, h.x, cardY + 16);

      ctx.font = '900 18px monospace';
      ctx.fillStyle = '#F59E0B';
      ctx.fillText(`${h.score}`, h.x, cardY + 33);

      if (h.combo >= 2) {
        ctx.fillStyle = '#EF4444';
        ctx.font = '800 10px monospace';
        ctx.fillText(`🔥 ${h.combo}x STREAK`, h.x, cardY + 46);
      } else {
        ctx.fillStyle = '#94A3B8';
        ctx.font = '700 9px monospace';
        ctx.fillText(`Pins: ${h.currentPinIdx}/${h.pins.length}`, h.x, cardY + 46);
      }

      ctx.restore();
    }
  }
}

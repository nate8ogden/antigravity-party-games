import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface GeyserVent {
  id: number;
  stoneIndex: number;
  state: 'dormant' | 'warning' | 'erupting';
  timer: number;
  cyclePeriod: number;
  warnDuration: number;
  eruptDuration: number;
}

interface FoxHopper {
  id: PlayerId;
  laneY: number;
  currentStone: number;
  x: number;
  y: number;
  isJumping: boolean;
  jumpT: number; // 0 to 1
  startX: number;
  targetX: number;
  score: number;
  singedTimer: number;
  animTimer: number;
  geysers: GeyserVent[];
}

export class GeyserLeapGame extends BaseGame {
  public hoppers: Map<PlayerId, FoxHopper> = new Map();
  public currentMapName: string = 'Geothermal Valley of Iceland';
  private totalStones: number = 22;
  private stoneSpacing: number = 70;
  private botThinkTimers: Map<PlayerId, number> = new Map();

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

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 35.0;
    this.hoppers.clear();
    this.botThinkTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    active.forEach((p, idx) => {
      const laneY = 70 + idx * laneHeight + laneHeight * 0.5;
      
      // Generate geysers along the path
      const geysers: GeyserVent[] = [];
      let gId = 0;
      for (let s = 2; s < this.totalStones - 1; s += 2) {
        geysers.push({
          id: gId++,
          stoneIndex: s,
          state: 'dormant',
          timer: (s * 0.8 + idx * 0.5) % 3.0,
          cyclePeriod: 2.8 + (s % 3) * 0.4,
          warnDuration: 0.8,
          eruptDuration: 0.9
        });
      }

      this.hoppers.set(p.id, {
        id: p.id,
        laneY,
        currentStone: 0,
        x: 60,
        y: laneY,
        isJumping: false,
        jumpT: 0,
        startX: 60,
        targetX: 60,
        score: 0,
        singedTimer: 0,
        animTimer: 0,
        geysers
      });

      this.botThinkTimers.set(p.id, 0.2 + Math.random() * 0.3);
    });
  }

  private performJump(hopper: FoxHopper): void {
    if (hopper.isJumping || hopper.singedTimer > 0) return;
    if (hopper.currentStone < this.totalStones - 1) {
      hopper.isJumping = true;
      hopper.jumpT = 0;
      hopper.startX = hopper.x;
      hopper.targetX = 60 + (hopper.currentStone + 1) * this.stoneSpacing;
      this.audio.playTone(380, 0.1, 'sine');
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.finishRound();
      return;
    }

    this.updateBots(dt, width, height);

    this.hoppers.forEach(hopper => {
      hopper.animTimer += dt;

      // Update geyser cycles
      hopper.geysers.forEach(g => {
        g.timer += dt;
        if (g.state === 'dormant') {
          if (g.timer >= g.cyclePeriod) {
            g.state = 'warning';
            g.timer = 0;
          }
        } else if (g.state === 'warning') {
          // Bubbling steam particles
          if (Math.random() < 0.3) {
            const stoneX = 60 + g.stoneIndex * this.stoneSpacing;
            this.particles.emit(stoneX + (Math.random() * 20 - 10), hopper.laneY + 10, 1, 'rgba(230, 245, 255, 0.7)');
          }
          if (g.timer >= g.warnDuration) {
            g.state = 'erupting';
            g.timer = 0;
            this.audio.playTone(180, 0.3, 'triangle');
          }
        } else if (g.state === 'erupting') {
          // Eruption steam plume
          const stoneX = 60 + g.stoneIndex * this.stoneSpacing;
          if (Math.random() < 0.6) {
            this.particles.emit(stoneX, hopper.laneY - 20, 2, 'rgba(255, 255, 255, 0.9)');
          }
          if (g.timer >= g.eruptDuration) {
            g.state = 'dormant';
            g.timer = 0;
          }
        }
      });

      // Singed recovery
      if (hopper.singedTimer > 0) {
        hopper.singedTimer -= dt;
        return;
      }

      // Handle Jump input
      if (!hopper.isJumping) {
        if (this.input.justPressed(hopper.id)) {
          this.performJump(hopper);
        }
      } else {
        // Progress jump
        hopper.jumpT += dt * 3.2; // ~0.3s per hop
        if (hopper.jumpT >= 1.0) {
          hopper.jumpT = 1.0;
          hopper.isJumping = false;
          hopper.currentStone++;
          hopper.x = hopper.targetX;
          hopper.score = hopper.currentStone * 10;
          this.audio.playTone(240, 0.06, 'triangle');

          // Check if landed on an erupting geyser!
          const activeGeyser = hopper.geysers.find(g => g.stoneIndex === hopper.currentStone);
          if (activeGeyser && activeGeyser.state === 'erupting') {
            // Hit by geyser steam blast!
            hopper.singedTimer = 1.0;
            hopper.currentStone = Math.max(0, hopper.currentStone - 1);
            hopper.targetX = 60 + hopper.currentStone * this.stoneSpacing;
            hopper.x = hopper.targetX;
            hopper.score = hopper.currentStone * 10;
            this.particles.emit(hopper.x, hopper.laneY - 15, 12, '#ff6633');
            this.particles.emit(hopper.x, hopper.laneY - 25, 15, '#ffffff');
            this.audio.playTone(120, 0.4, 'sawtooth');
          } else {
            this.particles.emit(hopper.x, hopper.laneY + 12, 4, 'rgba(200, 230, 255, 0.6)');
            // Check victory condition
            if (hopper.currentStone >= this.totalStones - 1) {
              hopper.score += 100;
              this.particles.emit(hopper.x, hopper.laneY, 25, '#ffd700');
              this.audio.playTone(600, 0.4, 'square');
              this.finishRound();
              return;
            }
          }
        } else {
          // Mid-jump trajectory
          hopper.x = hopper.startX + (hopper.targetX - hopper.startX) * hopper.jumpT;
          const jumpArc = Math.sin(hopper.jumpT * Math.PI) * 35;
          hopper.y = hopper.laneY - jumpArc;
        }
      }
    });
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _w: number,
    _h: number
  ): void {
    const hopper = this.hoppers.get(botId);
    if (!hopper || hopper.isJumping || hopper.singedTimer > 0) return;

    let timer = (this.botThinkTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botThinkTimers.set(botId, timer);
      return;
    }

    const nextStoneIdx = hopper.currentStone + 1;
    const nextGeyser = hopper.geysers.find(g => g.stoneIndex === nextStoneIdx);

    let willJump = false;
    if (!nextGeyser) {
      willJump = true;
    } else {
      if (nextGeyser.state === 'dormant') {
        const timeToWarn = nextGeyser.cyclePeriod - nextGeyser.timer;
        if (timeToWarn > 0.4) {
          willJump = true;
        } else {
          willJump = difficulty === 'bot_easy' ? Math.random() < 0.6 : false;
        }
      } else if (nextGeyser.state === 'warning') {
        willJump = difficulty === 'bot_easy' ? Math.random() < 0.4 : false;
      } else if (nextGeyser.state === 'erupting') {
        willJump = difficulty === 'bot_easy' ? Math.random() < 0.15 : false;
      }
    }

    if (willJump) {
      this.performJump(hopper);
      const delay = difficulty === 'bot_hard' ? 0.08 : difficulty === 'bot_normal' ? 0.18 : 0.35;
      this.botThinkTimers.set(botId, delay + Math.random() * 0.1);
    } else {
      this.botThinkTimers.set(botId, 0.15);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Thermal Arctic Valley Background
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#10223a');
    grad.addColorStop(0.5, '#1e3852');
    grad.addColorStop(1, '#2c475d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Distant snowy peaks & steam haze
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(0, 90);
    ctx.lineTo(width * 0.25, 45);
    ctx.lineTo(width * 0.5, 80);
    ctx.lineTo(width * 0.8, 35);
    ctx.lineTo(width, 70);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fill();
    ctx.restore();

    // HUD Instructions
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 170, 56, 340, 26, 13);
    ctx.fill();
    ctx.fillStyle = '#bbf2f6';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LEAP ACROSS HOT SPRINGS! WATCH OUT FOR GEYSER BLASTS!', width * 0.5, 69);
    ctx.restore();

    const active = this.getActivePlayers();
    const count = active.length;
    const laneHeight = (height - 90) / Math.max(count, 1);

    // Render Lanes
    this.hoppers.forEach(hopper => {
      const cfg = this.players.find(p => p.id === hopper.id);
      const laneY = hopper.laneY;

      // Lane separator
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(20, laneY + laneHeight * 0.48);
      ctx.lineTo(width - 20, laneY + laneHeight * 0.48);
      ctx.stroke();
      ctx.restore();

      // Render Stepping Stones & Geysers
      for (let s = 0; s < this.totalStones; s++) {
        const sx = 60 + s * this.stoneSpacing;
        const sy = laneY + 12;

        const geyser = hopper.geysers.find(g => g.stoneIndex === s);
        
        // Stone shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(sx, sy + 6, 18, 9, 0, 0, Math.PI * 2);
        ctx.fill();

        // Stone body
        if (s === this.totalStones - 1) {
          // Finish Shrine Stone
          ctx.fillStyle = '#ffd700';
          ctx.beginPath();
          ctx.ellipse(sx, sy, 24, 14, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#b8860b';
          ctx.beginPath();
          ctx.ellipse(sx, sy - 2, 19, 10, 0, 0, Math.PI * 2);
          ctx.fill();

          // Gold flag/shrine
          ctx.fillStyle = '#ff4444';
          ctx.fillRect(sx - 2, sy - 30, 4, 30);
          ctx.beginPath();
          ctx.moveTo(sx + 2, sy - 30);
          ctx.lineTo(sx + 20, sy - 22);
          ctx.lineTo(sx + 2, sy - 14);
          ctx.fill();
        } else if (geyser) {
          // Geyser vent stone (cracked volcanic rim)
          ctx.fillStyle = '#3a2e2b';
          ctx.beginPath();
          ctx.ellipse(sx, sy, 18, 10, 0, 0, Math.PI * 2);
          ctx.fill();

          // Vent hole
          ctx.fillStyle = geyser.state === 'erupting' ? '#ffaa44' : geyser.state === 'warning' ? '#ff7733' : '#1a1412';
          ctx.beginPath();
          ctx.ellipse(sx, sy, 8, 4, 0, 0, Math.PI * 2);
          ctx.fill();

          // Steam eruption rendering
          if (geyser.state === 'warning') {
            const pulse = Math.sin(hopper.animTimer * 18) * 3;
            ctx.fillStyle = 'rgba(255, 230, 200, 0.4)';
            ctx.beginPath();
            ctx.arc(sx, sy - 8, 10 + pulse, 0, Math.PI * 2);
            ctx.fill();
          } else if (geyser.state === 'erupting') {
            const plumeH = 50 + Math.sin(hopper.animTimer * 25) * 12;
            const jetGrad = ctx.createLinearGradient(sx, sy, sx, sy - plumeH);
            jetGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
            jetGrad.addColorStop(0.3, 'rgba(220, 245, 255, 0.8)');
            jetGrad.addColorStop(1, 'rgba(200, 230, 255, 0)');
            ctx.fillStyle = jetGrad;
            ctx.beginPath();
            ctx.moveTo(sx - 10, sy);
            ctx.quadraticCurveTo(sx - 16, sy - plumeH * 0.6, sx - 4, sy - plumeH);
            ctx.quadraticCurveTo(sx + 4, sy - plumeH, sx + 16, sy - plumeH * 0.6);
            ctx.lineTo(sx + 10, sy);
            ctx.closePath();
            ctx.fill();
          }
        } else {
          // Normal frosty stone
          ctx.fillStyle = '#688296';
          ctx.beginPath();
          ctx.ellipse(sx, sy, 17, 9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#89a8c0';
          ctx.beginPath();
          ctx.ellipse(sx, sy - 2, 14, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          // Snow cap
          ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.beginPath();
          ctx.ellipse(sx - 3, sy - 4, 8, 3, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Render Player Fox
      const foxY = hopper.isJumping ? hopper.y : laneY;
      const isSinged = hopper.singedTimer > 0;

      ctx.save();
      ctx.translate(hopper.x, foxY);

      if (isSinged) {
        ctx.rotate(Math.sin(hopper.animTimer * 25) * 0.3);
      }

      // Shadow when jumping
      if (hopper.isJumping) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        const shadowScale = 1 - (hopper.laneY - foxY) / 70;
        ctx.beginPath();
        ctx.ellipse(0, laneY - foxY + 8, Math.max(4, 14 * shadowScale), Math.max(2, 6 * shadowScale), 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Fox Body
      ctx.fillStyle = isSinged ? '#734d3b' : (cfg?.color || '#ffffff');
      ctx.beginPath();
      ctx.ellipse(0, -6, 14, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Bushy tail
      const tailWiggle = Math.sin(hopper.animTimer * 10) * 4;
      ctx.beginPath();
      ctx.ellipse(-14, -10 + tailWiggle, 9, 6, -0.4, 0, Math.PI * 2);
      ctx.fill();
      // Tail white tip
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-20, -13 + tailWiggle, 4, 0, Math.PI * 2);
      ctx.fill();

      // Fox Head
      ctx.fillStyle = isSinged ? '#734d3b' : (cfg?.color || '#ffffff');
      ctx.beginPath();
      ctx.ellipse(9, -12, 9, 8, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Ears
      ctx.beginPath();
      ctx.moveTo(8, -19);
      ctx.lineTo(13, -27);
      ctx.lineTo(16, -17);
      ctx.fill();
      ctx.fillStyle = '#ffaaaa';
      ctx.beginPath();
      ctx.moveTo(9, -19);
      ctx.lineTo(13, -24);
      ctx.lineTo(15, -18);
      ctx.fill();

      // Snout & Nose
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(15, -10, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.arc(19, -10, 2, 0, Math.PI * 2);
      ctx.fill();

      // Eye
      ctx.fillStyle = isSinged ? '#ff3300' : '#111111';
      ctx.beginPath();
      ctx.arc(11, -14, 2, 0, Math.PI * 2);
      ctx.fill();

      // Paws
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(5, 2, 4, 0, Math.PI * 2);
      ctx.arc(-5, 2, 4, 0, Math.PI * 2);
      ctx.fill();

      // Singed smoke puff indicator
      if (isSinged) {
        ctx.fillStyle = '#ff4400';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('HOT!', 0, -32);
      }

      ctx.restore();

      // Player Tag & Distance indicator
      ctx.save();
      ctx.fillStyle = cfg?.color || '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${cfg?.name || 'Player'}: ${hopper.currentStone}/${this.totalStones - 1} Stones`, 20, laneY - laneHeight * 0.32);
      ctx.restore();
    });
  }

  private finishRound(): void {
    this.isFinished = true;
  }

  public getScores(): Map<PlayerId, number> {
    const scores = new Map<PlayerId, number>();
    this.hoppers.forEach((h, pId) => scores.set(pId, h.score));
    return scores;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.hoppers.entries())
      .map(([playerId, h]) => ({ playerId, score: h.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} mastered the geysers!` : 'Scorched on the hot springs!'
    };
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }
}

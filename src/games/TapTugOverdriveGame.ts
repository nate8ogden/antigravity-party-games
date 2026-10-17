import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter } from '../core/CharacterRenderer';

interface TugReactorNode {
  id: PlayerId;
  name: string;
  color: string;
  colorLight: string;
  anchorX: number;
  anchorY: number;
  energy: number;
  taps: number;
  botTimer: number;
}

export class TapTugOverdriveGame extends BaseGame {
  private nodes: TugReactorNode[] = [];
  private coreX: number = 400;
  private coreY: number = 300;
  private surgeActive: boolean = false;
  private surgeTimer: number = 2.0;
  private animTime: number = 0;
  private winnerId: PlayerId | null = null;

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
    this.roundTimer = 28.0;
    this.winnerId = null;
    this.animTime = 0;
    this.surgeActive = false;
    this.surgeTimer = 2.2;
    this.coreX = width / 2;
    this.coreY = height / 2 + 10;
    this.input.setControlMode('single_button');

    const active = this.getActivePlayers();
    this.nodes = active.map((p, idx) => {
      const pos = this.getAnchorPosition(idx, active.length, width, height);
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        colorLight: p.colorLight,
        anchorX: pos.x,
        anchorY: pos.y,
        energy: 0,
        taps: 0,
        botTimer: 0.14
      };
    });
  }

  private getAnchorPosition(idx: number, count: number, width: number, height: number) {
    const cx = width / 2;
    const cy = height / 2 + 10;
    const r = Math.min(width, height) * 0.35;
    if (count <= 2) {
      return idx === 0 ? { x: cx - r, y: cy } : { x: cx + r, y: cy };
    }
    const angles = [-Math.PI * 0.75, -Math.PI * 0.25, Math.PI * 0.75, Math.PI * 0.25];
    const a = angles[idx] ?? 0;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    this.animTime += dt * 4;
    this.updateBots(dt, width, height);

    // Toggle 2x Overdrive Surge Window
    this.surgeTimer -= dt;
    if (this.surgeTimer <= 0) {
      this.surgeActive = !this.surgeActive;
      this.surgeTimer = this.surgeActive ? 1.3 : 2.1;
      if (this.surgeActive) {
        this.audio.playBoost();
        this.particles.showFloatingText('⚡ 2X OVERDRIVE SURGE! MASH TAP! ⚡', width / 2, 74, '#FBBF24', 19);
      }
    }

    for (let i = 0; i < this.nodes.length; i++) {
      const n = this.nodes[i];
      const pos = this.getAnchorPosition(i, this.nodes.length, width, height);
      n.anchorX = pos.x;
      n.anchorY = pos.y;

      const tapped = this.input.justPressed(n.id) || this.input.justAction(n.id);
      if (tapped) {
        const pullStrength = this.surgeActive ? 22 : 12;
        const dx = n.anchorX - this.coreX;
        const dy = n.anchorY - this.coreY;
        const dist = Math.hypot(dx, dy) || 1;
        this.coreX += (dx / dist) * pullStrength;
        this.coreY += (dy / dist) * pullStrength;
        n.energy += this.surgeActive ? 2 : 1;
        n.taps += 1;

        this.audio.playRopeTension(0.5);
        this.particles.spawnSparks(this.coreX, this.coreY, n.colorLight, 6);
      }

      // Check if plasma core reached this player's reactor node!
      const distToNode = Math.hypot(n.anchorX - this.coreX, n.anchorY - this.coreY);
      if (distToNode <= 34) {
        n.energy += 25;
        this.winnerId = n.id;
        this.audio.playExplosion();
        this.particles.spawnExplosion(n.anchorX, n.anchorY, n.color, 32);
        this.isFinished = true;
        return;
      }
    }

    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      // Closest node to the plasma core wins!
      const sorted = [...this.nodes].sort((a, b) => {
        const da = Math.hypot(a.anchorX - this.coreX, a.anchorY - this.coreY);
        const db = Math.hypot(b.anchorX - this.coreX, b.anchorY - this.coreY);
        return da - db;
      });
      if (sorted.length > 0) {
        this.winnerId = sorted[0].id;
        sorted[0].energy += 10;
      }
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
    const n = this.nodes.find((x) => x.id === botId);
    if (!n) return;

    n.botTimer -= dt;
    if (n.botTimer > 0) return;

    const tapInterval = difficulty === 'bot_hard' ? 0.095 : difficulty === 'bot_normal' ? 0.145 : 0.21;
    n.botTimer = tapInterval + Math.random() * 0.04;
    this.input.triggerBotPress(botId);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const cx = width / 2;
    const cy = height / 2 + 10;

    ctx.fillStyle = '#060A14';
    ctx.fillRect(0, 0, width, height);

    // Arena Containment Ring
    const maxR = Math.min(width, height) * 0.36;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, maxR, 0, Math.PI * 2);
    ctx.strokeStyle = this.surgeActive ? '#FBBF24' : 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = this.surgeActive ? 4 : 2;
    ctx.stroke();
    ctx.restore();

    // Draw tether beams from each player's node to the Plasma Core
    for (const n of this.nodes) {
      ctx.save();
      ctx.strokeStyle = n.color;
      ctx.lineWidth = 6;
      ctx.shadowColor = n.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(n.anchorX, n.anchorY);
      ctx.lineTo(this.coreX, this.coreY);
      ctx.stroke();

      // Player Reactor Anchor Pad
      ctx.beginPath();
      ctx.arc(n.anchorX, n.anchorY, 32, 0, Math.PI * 2);
      ctx.fillStyle = '#0F172A';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = n.colorLight;
      ctx.stroke();

      drawCharacter(ctx, n.anchorX, n.anchorY, 20, n.id, false, 'focused', this.animTime * 0.25);

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${n.name} (${n.taps}⚡)`, n.anchorX, n.anchorY + (n.anchorY > cy ? 46 : -38));
      ctx.restore();
    }

    // Draw Central Plasma Core
    ctx.save();
    const pulseR = 24 + Math.sin(this.animTime * 2.5) * 4;
    ctx.shadowColor = this.surgeActive ? '#FBBF24' : '#38BDF8';
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.arc(this.coreX, this.coreY, pulseR, 0, Math.PI * 2);
    ctx.fillStyle = this.surgeActive ? '#FDE047' : '#38BDF8';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.nodes].sort((a, b) => {
      if (a.id === this.winnerId) return -1;
      if (b.id === this.winnerId) return 1;
      return b.energy - a.energy;
    });
    const rankings = sorted.map((n, idx) => ({
      playerId: n.id,
      score: n.energy,
      place: idx + 1
    }));

    return {
      winnerId: this.winnerId,
      rankings,
      mvpHighlight:
        this.winnerId !== null
          ? `${this.players[this.winnerId].name} captured the Overdrive Plasma Core!`
          : 'Plasma Tug Stalemate!'
    };
  }
}

import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface WireModule {
  instructionText: string;
  correctWireIndex: number; // 0: Up (Red), 1: Right (Blue), 2: Down (Green), 3: Left (Yellow)
  avoidWireIndex?: number;
  wires: { color: string; label: string; keyHint: string }[];
  timer: number;
}

interface WirePlayer {
  id: PlayerId;
  score: number;
  stunTimer: number;
  feedbackText: string;
  feedbackColor: string;
  feedbackTimer: number;
  scissorsAngle: number;
  inputDebounceTimer: number;
}

export class WireCutterGame extends BaseGame {
  private wirePlayers: WirePlayer[] = [];
  private currentModule: WireModule = {
    instructionText: '',
    correctWireIndex: 0,
    wires: [],
    timer: 4.0
  };

  private selectedWireIndex: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private moduleRound: number = 0;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
    this.roundTimer = 32.0;
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.roundTimer = 32.0;
    this.isFinished = false;
    this.wirePlayers = [];
    this.botReactionTimers.clear();
    this.moduleRound = 0;

    const active = this.getActivePlayers();
    active.forEach((p) => {
      this.wirePlayers.push({
        id: p.id,
        score: 0,
        stunTimer: 0,
        feedbackText: '',
        feedbackColor: '#FFFFFF',
        feedbackTimer: 0,
        scissorsAngle: 0,
        inputDebounceTimer: 0
      });
    });

    this.generateNewModule();
  }

  private generateNewModule() {
    this.moduleRound++;
    const wireColors = [
      { color: '#EF4444', label: 'RED', keyHint: 'UP [W / ↑]' },
      { color: '#3B82F6', label: 'BLUE', keyHint: 'RIGHT [D / →]' },
      { color: '#10B981', label: 'GREEN', keyHint: 'DOWN [S / ↓]' },
      { color: '#F59E0B', label: 'YELLOW', keyHint: 'LEFT [A / ←]' }
    ];

    // Pick instruction type
    const types = ['direct', 'direct', 'direct_color', 'avoid', 'direction'];
    const type = types[Math.floor(Math.random() * types.length)];

    let targetIdx = Math.floor(Math.random() * 4);
    let prompt = '';

    let avoidIdx: number | undefined = undefined;

    if (type === 'direct') {
      prompt = `⚡ SNIP THE ${wireColors[targetIdx].label} WIRE!`;
    } else if (type === 'direct_color') {
      prompt = `✂️ CUT COLOR: ${wireColors[targetIdx].label}`;
    } else if (type === 'avoid') {
      avoidIdx = Math.floor(Math.random() * 4);
      targetIdx = (avoidIdx + 1) % 4;
      prompt = `⚠️ DO NOT CUT ${wireColors[avoidIdx].label}!`;
    } else {
      const dirs = ['UP', 'RIGHT', 'DOWN', 'LEFT'];
      targetIdx = Math.floor(Math.random() * 4);
      prompt = `🎯 CUT DIRECTION: ${dirs[targetIdx]}`;
    }

    this.currentModule = {
      instructionText: prompt,
      correctWireIndex: targetIdx,
      avoidWireIndex: avoidIdx,
      wires: wireColors,
      timer: 3.5
    };

    // Reset bot reaction timers with human latency
    this.wirePlayers.forEach((wp) => {
      const p = this.players[wp.id];
      if (p.type.startsWith('bot_')) {
        let delay = 0.45;
        if (p.type === 'bot_easy') delay = 0.85 + Math.random() * 0.4;
        else if (p.type === 'bot_normal') delay = 0.5 + Math.random() * 0.25;
        else if (p.type === 'bot_hard') delay = 0.22 + Math.random() * 0.15;
        this.botReactionTimers.set(wp.id, delay);
      }
    });

    this.audio.playTap();
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.selectedWireIndex = Math.floor(performance.now() * 0.0022) % 4;

    this.currentModule.timer -= dt;
    if (this.currentModule.timer <= 0) {
      // Module timed out
      this.audio.playExplosion();
      this.particles.spawnExplosion(width / 2, height / 2, '#EF4444', 24);
      this.generateNewModule();
      return;
    }

    // Update bots
    this.updateBots(dt, width, height);

    this.wirePlayers.forEach((wp) => {
      if (wp.stunTimer > 0) wp.stunTimer -= dt;
      if (wp.feedbackTimer > 0) wp.feedbackTimer -= dt;
      if (wp.inputDebounceTimer > 0) wp.inputDebounceTimer -= dt;

      // Handle Human Player Inputs (Debounced)
      const p = this.players[wp.id];
      if (p.type === 'human' && wp.stunTimer <= 0 && wp.inputDebounceTimer <= 0) {
        const steer = this.input.getSteer(wp.id);
        const throttle = this.input.getThrottle(wp.id);
        const action = this.input.justAction(wp.id) || this.input.justPressed(wp.id);

        let chosen: number | null = null;
        if (throttle > 0.4) chosen = 0; // Up [W / ArrowUp]
        else if (steer > 0.4) chosen = 1; // Right [D / ArrowRight]
        else if (throttle < -0.4) chosen = 2; // Down [S / ArrowDown]
        else if (steer < -0.4) chosen = 3; // Left [A / ArrowLeft]
        else if (action) chosen = this.selectedWireIndex; // 1-button rhythmic timing cut

        if (chosen !== null) {
          wp.inputDebounceTimer = 0.28; // 280ms debounce between cuts
          this.executeWireCut(wp, chosen, width, height);
        }
      }
    });

    // Check game over (first to 5 defusals or time out)
    const leader = this.wirePlayers.find((wp) => wp.score >= 5);
    if (leader || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const wp = this.wirePlayers.find((p) => p.id === botId);
    if (!wp || wp.stunTimer > 0) return;

    let timer = this.botReactionTimers.get(botId) || 0.5;
    timer -= dt;
    this.botReactionTimers.set(botId, timer);

    if (timer <= 0) {
      let errorRate = difficulty === 'bot_easy' ? 0.35 : difficulty === 'bot_normal' ? 0.15 : 0.02;
      let chosenWire = this.currentModule.correctWireIndex;
      if (this.currentModule.avoidWireIndex !== undefined) {
        const safeWires = [0, 1, 2, 3].filter((i) => i !== this.currentModule.avoidWireIndex);
        chosenWire = safeWires[Math.floor(Math.random() * safeWires.length)];
        if (Math.random() < errorRate) {
          chosenWire = this.currentModule.avoidWireIndex;
        }
      } else if (Math.random() < errorRate) {
        chosenWire = (chosenWire + 1 + Math.floor(Math.random() * 3)) % 4;
      }
      this.executeWireCut(wp, chosenWire, width, height);
      this.botReactionTimers.set(botId, 99); // Done for this module
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  private executeWireCut(wp: WirePlayer, wireIndex: number, width: number, height: number) {
    let isCorrect = false;
    if (this.currentModule.avoidWireIndex !== undefined) {
      isCorrect = wireIndex !== this.currentModule.avoidWireIndex;
    } else {
      isCorrect = wireIndex === this.currentModule.correctWireIndex;
    }

    if (isCorrect) {
      wp.score += 1;
      wp.feedbackText = 'DEFUSED! +1';
      wp.feedbackColor = '#22C55E';
      wp.feedbackTimer = 1.0;
      this.audio.playScore();
      this.particles.spawnSparks(width / 2, height / 2, '#22C55E', 20);
      this.generateNewModule();
    } else {
      wp.stunTimer = 1.6;
      wp.feedbackText = 'WRONG WIRE! 💥';
      wp.feedbackColor = '#EF4444';
      wp.feedbackTimer = 1.5;
      this.audio.playExplosion();
      this.particles.spawnExplosion(width / 2, height / 2, '#EF4444', 25);
      this.particles.addTrauma(0.4);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Cyber Security Bomb Chamber
    ctx.fillStyle = '#090D16';
    ctx.fillRect(0, 0, width, height);

    // Center Bomb Unit
    const bombW = Math.min(520, width * 0.85);
    const bombH = Math.min(380, height * 0.72);
    const bombX = width / 2 - bombW / 2;
    const bombY = height / 2 - bombH / 2 + 10;

    // Metal Frame
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#1E293B';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bombX, bombY, bombW, bombH, 16);
    else ctx.rect(bombX, bombY, bombW, bombH);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Digital Screen Header inside Bomb
    const screenH = 65;
    ctx.fillStyle = '#020617';
    ctx.fillRect(bombX + 16, bombY + 16, bombW - 32, screenH);
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bombX + 16, bombY + 16, bombW - 32, screenH);

    // Holographic Instruction
    ctx.fillStyle = '#38BDF8';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.currentModule.instructionText, width / 2, bombY + 44);

    // Module Timer Bar
    const timerPct = Math.max(0, this.currentModule.timer / 3.5);
    const barW = (bombW - 32) * timerPct;
    ctx.fillStyle = timerPct > 0.3 ? '#22C55E' : '#EF4444';
    ctx.fillRect(bombX + 16, bombY + 16 + screenH - 6, barW, 6);

    // 2. Render 4 Directional Wires
    const cx = width / 2;
    const cy = bombY + 16 + screenH + (bombH - screenH - 32) / 2;
    const wireLength = 95;

    const wireDirs = [
      { idx: 0, x: cx, y: cy - wireLength, label: 'UP [W / ↑]' },
      { idx: 1, x: cx + wireLength, y: cy, label: 'RIGHT [D / →]' },
      { idx: 2, x: cx, y: cy + wireLength, label: 'DOWN [S / ↓]' },
      { idx: 3, x: cx - wireLength, y: cy, label: 'LEFT [A / ←]' }
    ];

    // Central Terminal Core
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#38BDF8';
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.fillText('CORE', cx, cy + 4);

    wireDirs.forEach((w) => {
      const wireData = this.currentModule.wires[w.idx];

      // Glowing Neon Wire Cable
      ctx.save();
      ctx.strokeStyle = wireData.color;
      ctx.shadowColor = wireData.color;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(w.x, w.y);
      ctx.stroke();
      ctx.restore();

      // Terminal Terminal Node
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(w.x, w.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = wireData.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      if (w.idx === this.selectedWireIndex) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(w.x, w.y, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Node Keycap Badge
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 10px Montserrat, sans-serif';
      ctx.fillText(wireData.label, w.x, w.y + 3.5);

      // Key hint text
      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 9px monospace';
      const textOffY = w.idx === 0 ? -22 : w.idx === 2 ? 26 : 22;
      ctx.fillText(w.label, w.x, w.y + textOffY);
    });

    // 3. Render Centered Player Defusal Consoles
    const active = this.getActivePlayers();
    const cardW = Math.min(160, (width * 0.85) / active.length);
    const totalW = active.length * cardW + (active.length - 1) * 12;
    const startX = width / 2 - totalW / 2;
    const podY = Math.min(height - 46, bombY + bombH + 10);

    this.wirePlayers.forEach((wp, idx) => {
      const p = this.players[wp.id];
      const px = startX + idx * (cardW + 12);

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, podY, cardW, 36, 8);
      else ctx.rect(px, podY, cardW, 36);
      ctx.fill();
      ctx.strokeStyle = wp.stunTimer > 0 ? '#EF4444' : p.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Name & Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, px + 8, podY + 16);

      ctx.fillStyle = p.color;
      ctx.font = '900 12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`✂️ ${wp.score}/5`, px + cardW - 8, podY + 16);

      // Stun or Feedback status text below
      if (wp.stunTimer > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 9.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`⚡ STUNNED (${wp.stunTimer.toFixed(1)}s)`, px + cardW / 2, podY + 30);
      } else if (wp.feedbackTimer > 0) {
        ctx.fillStyle = wp.feedbackColor;
        ctx.font = 'bold 9.5px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(wp.feedbackText, px + cardW / 2, podY + 30);
      }
      ctx.restore();
    });
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.wirePlayers].sort((a, b) => b.score - a.score);
    const winnerId = sorted[0].score > sorted[1].score ? sorted[0].id : null;
    const winner = winnerId !== null ? this.players[winnerId] : null;

    return {
      winnerId,
      rankings: sorted.map((wp, idx) => ({ playerId: wp.id, place: (idx + 1) as 1 | 2 | 3 | 4, score: wp.score })),
      mvpHighlight: winner
        ? `${winner.name} defused ${sorted[0].score} Cyber Bombs!`
        : 'Bomb defusal duel tied!'
    };
  }
}

import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface CodeNode {
  code: string;
  isKey: boolean;
  x: number;
}

interface TerminalState {
  targetCode: string;
  nodes: CodeNode[];
  cursorX: number;
  cursorSpeed: number;
  stunTimer: number;
  score: number;
}

export class HackTerminalGame extends BaseGame {
  private terminals: Map<PlayerId, TerminalState> = new Map();
  private readonly CODE_POOL = ['A7', 'F3', '0B', '4E', '9C', 'D1', '8F'];

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(_width: number = 800, _height: number = 600): void {
    this.terminals.clear();
    this.roundTimer = 25.0;
    this.isFinished = false;

    for (const p of this.getActivePlayers()) {
      this.terminals.set(p.id, this.createTerminalState());
    }
  }

  private createTerminalState(): TerminalState {
    const target = this.CODE_POOL[Math.floor(Math.random() * this.CODE_POOL.length)];
    const nodes: CodeNode[] = [];
    for (let i = 0; i < 6; i++) {
      const isTarget = i === 2 || (i === 4 && Math.random() < 0.5);
      const code = isTarget ? target : this.CODE_POOL[Math.floor(Math.random() * this.CODE_POOL.length)];
      nodes.push({
        code,
        isKey: code === target,
        x: -40 + i * 25
      });
    }

    return {
      targetCode: target,
      nodes,
      cursorX: 0,
      cursorSpeed: 140,
      stunTimer: 0,
      score: 0
    };
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer -= dt;
    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      return;
    }

    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const term = this.terminals.get(p.id);
      if (!term) continue;

      if (term.stunTimer > 0) {
        term.stunTimer -= dt;
        continue;
      }

      // Cursor oscillates between -50 and 50
      term.cursorX += term.cursorSpeed * dt;
      if (term.cursorX > 50) {
        term.cursorX = 50;
        term.cursorSpeed = -Math.abs(term.cursorSpeed);
      } else if (term.cursorX < -50) {
        term.cursorX = -50;
        term.cursorSpeed = Math.abs(term.cursorSpeed);
      }

      if (this.input.justPressed(p.id)) {
        // Check if cursor aligns with a node
        const hitNode = term.nodes.find(n => Math.abs(n.x - term.cursorX) < 14);
        if (hitNode) {
          if (hitNode.isKey) {
            // Decrypt success!
            term.score += 15;
            this.audio.playTone(880, 0.1, 'sine');
            // Refresh terminal state
            Object.assign(term, this.createTerminalState(), { score: term.score });
          } else {
            // ICE firewall shock
            term.stunTimer = 1.2;
            term.score = Math.max(0, term.score - 5);
            this.audio.playTone(160, 0.2, 'sawtooth');
          }
        } else {
          this.audio.playTone(240, 0.05, 'triangle');
        }
      }
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', _width: number, _height: number): void {
    const term = this.terminals.get(botId);
    if (!term || term.stunTimer > 0) return;

    const keyNode = term.nodes.find(n => n.isKey);
    if (keyNode) {
      const dist = Math.abs(term.cursorX - keyNode.x);
      const margin = difficulty === 'bot_hard' ? 5 : difficulty === 'bot_normal' ? 9 : 14;
      if (dist <= margin) {
        this.input.setBotInput(botId, true);
      } else {
        this.input.setBotInput(botId, false);
      }
    }
  }

  private getTerminalPos(index: number, width: number, height: number): { x: number; y: number } {
    const positions = [
      { x: width * 0.28, y: height * 0.35 },
      { x: width * 0.72, y: height * 0.35 },
      { x: width * 0.28, y: height * 0.75 },
      { x: width * 0.72, y: height * 0.75 }
    ];
    return positions[index] || positions[0];
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const term = this.terminals.get(p.id);
      if (!term) continue;
      const pos = this.getTerminalPos(i, width, height);

      ctx.save();
      ctx.translate(pos.x, pos.y);

      // Cyber Terminal Screen Box
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-75, -75, 150, 150);
      ctx.strokeStyle = term.stunTimer > 0 ? '#EF4444' : p.color;
      ctx.lineWidth = 3;
      ctx.strokeRect(-75, -75, 150, 150);

      // Target Cipher Display
      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`TARGET: [${term.targetCode}]`, 0, -50);

      // Node Track
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-55, 0);
      ctx.lineTo(55, 0);
      ctx.stroke();

      // Nodes
      for (const node of term.nodes) {
        ctx.fillStyle = node.isKey ? '#10B981' : '#64748B';
        ctx.fillRect(node.x - 9, -12, 18, 24);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1;
        ctx.strokeRect(node.x - 9, -12, 18, 24);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(node.code, node.x, 4);
      }

      // Scanner Cursor
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(term.cursorX, -20);
      ctx.lineTo(term.cursorX, 20);
      ctx.stroke();

      if (term.stunTimer > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('ICE LOCKED', 0, 48);
      } else {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(`${p.name}: ${term.score}`, 0, 52);
      }

      ctx.restore();
    }

    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`TERMINAL HACK: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.terminals.get(p.id)?.score || 0,
        place: 1
      }))
      .sort((a, b) => b.score - a.score);

    for (let i = 0; i < rankings.length; i++) {
      rankings[i].place = i + 1;
    }

    const winnerId = rankings.length > 0 && rankings[0].score > (rankings[1]?.score ?? -1)
      ? rankings[0].playerId
      : null;

    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} cracked the mainframe ICE encryption!` : 'Terminal firewall locked all agents out!'
    };
  }
}

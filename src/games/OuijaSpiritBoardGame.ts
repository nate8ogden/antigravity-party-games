import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface LetterNode {
  char: string;
  x: number;
  y: number;
}

interface PlanchettePlayer {
  id: PlayerId;
  x: number;
  y: number;
  score: number;
  pulseTimer: number;
}

export class OuijaSpiritBoardGame extends BaseGame {
  private playersState: Map<PlayerId, PlanchettePlayer> = new Map();
  private letterNodes: LetterNode[] = [];
  private currentWord: string = 'GHOST';
  private currentLetterIndex: number = 0;
  private wordList: string[] = ['GHOST', 'WITCH', 'SPOOK', 'HAUNT', 'CRYPT', 'SPELL', 'NIGHT', 'SPIRIT'];
  private candleFlicker: number = 0;

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
    this.roundTimer = 30;
    this.playersState.clear();
    this.letterNodes = [];
    this.currentLetterIndex = 0;
    this.currentWord = this.wordList[Math.floor(Math.random() * this.wordList.length)];

    // Build Ouija Alphabet Arcs
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const centerX = width / 2;
    const centerY = height / 2 + 10;
    const radiusTop = Math.min(width, height) * 0.42;
    const radiusBottom = Math.min(width, height) * 0.30;

    // Top arc: A to M (13 letters)
    for (let i = 0; i < 13; i++) {
      const angle = Math.PI * 0.75 + (i / 12) * (Math.PI * 0.5); // spread around top
      this.letterNodes.push({
        char: alphabet[i],
        x: centerX + Math.cos(angle) * radiusTop,
        y: centerY + Math.sin(angle) * radiusTop * 0.65 - 30
      });
    }

    // Bottom arc: N to Z (13 letters)
    for (let i = 13; i < 26; i++) {
      const angle = Math.PI * 0.75 + ((i - 13) / 12) * (Math.PI * 0.5);
      this.letterNodes.push({
        char: alphabet[i],
        x: centerX + Math.cos(angle) * radiusBottom,
        y: centerY + Math.sin(angle) * radiusBottom * 0.65 + 30
      });
    }

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height - 60,
        score: 0,
        pulseTimer: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);
    this.candleFlicker += dt * 8;

    const targetChar = this.currentWord[this.currentLetterIndex];
    const targetNode = this.letterNodes.find(n => n.char === targetChar);

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.pulseTimer > 0) {
        ps.pulseTimer -= dt;
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const pressed = this.input.isPressed(p.id);

      // Movement
      ps.x += steer * 170 * dt;
      ps.y += -throttle * 170 * dt;

      // Single button fallback: if no stick, move towards target letter when pressed
      if (Math.abs(steer) < 0.1 && Math.abs(throttle) < 0.1 && targetNode) {
        if (pressed) {
          const dx = targetNode.x - ps.x;
          const dy = targetNode.y - ps.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 10) {
            ps.x += (dx / dist) * 140 * dt;
            ps.y += (dy / dist) * 140 * dt;
          }
        }
      }

      ps.x = Math.max(30, Math.min(width - 30, ps.x));
      ps.y = Math.max(50, Math.min(height - 30, ps.y));

      // Check collision with target letter
      if (targetNode) {
        const dist = Math.hypot(ps.x - targetNode.x, ps.y - targetNode.y);
        if (dist < 26) {
          ps.score += 2;
          ps.pulseTimer = 0.4;
          this.audio.playTone(520, 0.12);
          this.particles.emit(targetNode.x, targetNode.y, 16, '#c084fc');

          // Advance letter in word
          this.currentLetterIndex++;
          if (this.currentLetterIndex >= this.currentWord.length) {
            this.currentLetterIndex = 0;
            this.currentWord = this.wordList[Math.floor(Math.random() * this.wordList.length)];
            this.audio.playScore();
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const targetChar = this.currentWord[this.currentLetterIndex];
    const targetNode = this.letterNodes.find(n => n.char === targetChar);
    if (!targetNode) return;

    const ps = this.playersState.get(botId);
    if (!ps) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.25) {
      this.input.setBotInput(botId, false, 0, 0);
      return;
    }

    let targetX = targetNode.x;
    let targetY = targetNode.y;
    if (difficulty === 'bot_easy') {
      targetX += (Math.random() - 0.5) * 35;
      targetY += (Math.random() - 0.5) * 35;
    } else if (difficulty === 'bot_normal') {
      targetX += (Math.random() - 0.5) * 12;
      targetY += (Math.random() - 0.5) * 12;
    }

    const dx = targetX - ps.x;
    const dy = targetY - ps.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 15) {
      this.input.setBotInput(botId, true, dx / dist, -dy / dist);
    } else {
      this.input.setBotInput(botId, false, 0, 0);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Polished dark mahogany Ouija spirit board
    ctx.fillStyle = '#26160c';
    ctx.fillRect(0, 0, width, height);

    // Board woodgrain & border
    ctx.strokeStyle = '#451a03';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, width - 12, height - 12);

    // Decorative inner gold line
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(16, 16, width - 32, height - 32);

    // Mystical sun & moon corners
    ctx.fillStyle = '#d97706';
    // Sun on left
    ctx.beginPath();
    ctx.arc(42, 60, 14, 0, Math.PI * 2);
    ctx.fill();
    // Moon on right
    ctx.beginPath();
    ctx.arc(width - 42, 60, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#26160c';
    ctx.beginPath();
    ctx.arc(width - 48, 56, 12, 0, Math.PI * 2);
    ctx.fill();

    // YES / NO text
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 15px serif';
    ctx.textAlign = 'center';
    ctx.fillText('YES', 85, 65);
    ctx.fillText('NO', width - 85, 65);
    ctx.fillText('GOOD BYE', width / 2, height - 20);

    const targetChar = this.currentWord[this.currentLetterIndex];

    // Render Letters
    for (const node of this.letterNodes) {
      const isTarget = node.char === targetChar;

      if (isTarget) {
        ctx.fillStyle = 'rgba(217, 119, 6, 0.35)';
        ctx.beginPath();
        ctx.arc(node.x, node.y, 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 18, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = isTarget ? '#fef08a' : '#fde68a';
      ctx.font = isTarget ? 'bold 19px serif' : '15px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.char, node.x, node.y);
    }

    // Render Candle flames in corners
    const flicker = Math.sin(this.candleFlicker) * 2;
    this.drawCandle(ctx, 30, height - 40, flicker);
    this.drawCandle(ctx, width - 30, height - 40, -flicker);

    // Render Planchettes
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);

      // Planchette heart/tear vector shape
      ctx.shadowColor = ps.pulseTimer > 0 ? '#fef08a' : 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 12;

      ctx.fillStyle = '#78350f';
      ctx.beginPath();
      ctx.moveTo(0, -26); // pointed top
      ctx.quadraticCurveTo(24, 0, 18, 22);
      ctx.quadraticCurveTo(0, 15, -18, 22);
      ctx.quadraticCurveTo(-24, 0, 0, -26);
      ctx.closePath();
      ctx.fill();

      // Border with player color
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Glass viewing lens in center
      ctx.fillStyle = 'rgba(186, 230, 253, 0.4)';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.restore();

      // Score
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, ps.x, ps.y + 36);
    }

    // Top Header: Target Word Display
    ctx.fillStyle = 'rgba(18, 10, 5, 0.9)';
    ctx.fillRect(0, 0, width, 40);

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 15px serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`WORD: ${this.currentWord} [${targetChar}]`, 16, 26);

    ctx.textAlign = 'right';
    ctx.fillStyle = this.roundTimer < 6 ? '#ef4444' : '#f8fafc';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width - 16, 26);
  }

  private drawCandle(ctx: CanvasRenderingContext2D, x: number, y: number, flicker: number): void {
    // Wax stick
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(x - 5, y - 14, 10, 24);

    // Flame
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.ellipse(x, y - 20 + flicker, 4, 7 + Math.abs(flicker), 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.ellipse(x, y - 18 + flicker, 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} commune with the spirits most accurately!` : 'The spirits have spoken!'
    };
  }
}

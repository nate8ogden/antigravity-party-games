import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Reagent {
  id: number;
  name: string;
  color: string;
  glow: string;
}

const REAGENTS: Reagent[] = [
  { id: 0, name: 'Dragon Root', color: '#E53935', glow: 'rgba(229, 57, 53, 0.4)' },
  { id: 1, name: 'Moon Lotus', color: '#1E88E5', glow: 'rgba(30, 136, 229, 0.4)' },
  { id: 2, name: 'Emerald Moss', color: '#43A047', glow: 'rgba(67, 160, 71, 0.4)' },
  { id: 3, name: 'Sun Amber', color: '#FB8C00', glow: 'rgba(251, 140, 0, 0.4)' }
];

interface AlchemistStation {
  id: PlayerId;
  x: number;
  y: number;
  targetReagentIdx: number;
  selectorPos: number; // 0 to 4 (cycles through reagents)
  selectorSpeed: number;
  score: number;
  combo: number;
  potionsBrewed: number;
  cauldronBubbleTimer: number;
  flashTimer: number;
  flashSuccess: boolean;
  smokeTimer: number;
}

export class PotionAlchemistGame extends BaseGame {
  public playersState: Map<PlayerId, AlchemistStation> = new Map();
  public currentMapName: string = 'Grand Alchemical Laboratory';

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
    this.playersState.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height * 0.52,
        targetReagentIdx: Math.floor(Math.random() * REAGENTS.length),
        selectorPos: 0,
        selectorSpeed: 2.2 + Math.random() * 0.4,
        score: 0,
        combo: 0,
        potionsBrewed: 0,
        cauldronBubbleTimer: Math.random() * 0.5,
        flashTimer: 0,
        flashSuccess: false,
        smokeTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.2 + Math.random() * 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      // Cauldron bubbles
      ps.cauldronBubbleTimer -= dt;
      if (ps.cauldronBubbleTimer <= 0) {
        ps.cauldronBubbleTimer = 0.15 + Math.random() * 0.15;
        this.particles.emit(ps.x + (Math.random() - 0.5) * 40, ps.y - 10, 2, REAGENTS[ps.targetReagentIdx].color);
      }

      if (ps.flashTimer > 0) ps.flashTimer -= dt;
      if (ps.smokeTimer > 0) ps.smokeTimer -= dt;

      // Cycle selector
      ps.selectorPos = (ps.selectorPos + ps.selectorSpeed * dt) % REAGENTS.length;

      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      if (justAction) {
        this.handleDropReagent(ps);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private handleDropReagent(ps: AlchemistStation): void {
    const currentReagentIdx = Math.floor(ps.selectorPos);
    const isCorrect = currentReagentIdx === ps.targetReagentIdx;

    if (isCorrect) {
      ps.combo++;
      const points = 10 + ps.combo * 2;
      ps.score += points;
      ps.potionsBrewed++;
      ps.flashTimer = 0.4;
      ps.flashSuccess = true;

      this.audio.playScore();
      this.particles.spawnSparks(ps.x, ps.y - 20, REAGENTS[ps.targetReagentIdx].color, 12);

      // Pick new target reagent (ensure different from current)
      let nextTarget = Math.floor(Math.random() * REAGENTS.length);
      if (nextTarget === ps.targetReagentIdx) {
        nextTarget = (nextTarget + 1) % REAGENTS.length;
      }
      ps.targetReagentIdx = nextTarget;
      ps.selectorSpeed = Math.min(3.8, 2.2 + ps.potionsBrewed * 0.12);

      if (ps.score >= 120) {
        this.isFinished = true;
      }
    } else {
      // Wrong ingredient dropped
      ps.combo = 0;
      ps.score = Math.max(0, ps.score - 5);
      ps.flashTimer = 0.4;
      ps.flashSuccess = false;
      ps.smokeTimer = 0.5;

      this.audio.playExplosion();
      this.particles.emit(ps.x, ps.y - 15, 8, '#555555');
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const currentIdx = Math.floor(ps.selectorPos);
    const isTarget = currentIdx === ps.targetReagentIdx;

    let delay = 0.25;
    let shouldPress = false;

    if (difficulty === 'bot_easy') {
      delay = 0.45;
      if (Math.random() < 0.25) {
        shouldPress = true;
      } else if (isTarget) {
        const subPos = ps.selectorPos - currentIdx;
        if (subPos > 0.2 && subPos < 0.8) {
          shouldPress = true;
        }
      }
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
      if (isTarget) {
        const subPos = ps.selectorPos - currentIdx;
        if (subPos > 0.15 && subPos < 0.85) {
          shouldPress = true;
        }
      }
    } else {
      delay = 0.25;
      if (isTarget) {
        const subPos = ps.selectorPos - currentIdx;
        if (subPos > 0.25 && subPos < 0.8) {
          shouldPress = true;
        }
      }
    }

    if (shouldPress) {
      this.input.setBotInput(botId, true, 0, 0, true);
    }

    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const ps = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: ps?.score || 0,
        potions: ps?.potionsBrewed || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topPotions = scores[0]?.potions || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} crowned Grand Court Alchemist with ${topPotions} master potions!`
      : 'The cauldrons boiled over with no master alchemist!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#12121e');
    bgGrad.addColorStop(1, '#1b1b2d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#222238';
    ctx.fillRect(0, height * 0.72, width, height * 0.28);
    ctx.strokeStyle = '#2d2d48';
    ctx.lineWidth = 2;
    for (let x = 0; x < width; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, height * 0.72);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, height * 0.72);
    ctx.lineTo(width, height * 0.72);
    ctx.stroke();

    ctx.save();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('POTION ALCHEMIST', width / 2, 38);

    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#9FA8DA';
    ctx.fillText('TAP TO ADD ACTIVE REAGENT • BREW THE ORDERED RECIPES', width / 2, 60);

    ctx.fillStyle = '#FFD54F';
    ctx.font = '900 18px monospace';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);
    ctx.restore();

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderStation(ctx, ps, p);
    }
  }

  private renderStation(ctx: CanvasRenderingContext2D, ps: AlchemistStation, p: PlayerConfig): void {
    ctx.save();

    ctx.fillStyle = '#422817';
    ctx.fillRect(ps.x - 70, ps.y + 35, 140, 75);
    ctx.fillStyle = '#5A3820';
    ctx.fillRect(ps.x - 74, ps.y + 32, 148, 8);

    ctx.fillStyle = '#212121';
    ctx.beginPath();
    ctx.arc(ps.x, ps.y + 25, 42, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#37474F';
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle = '#37474F';
    ctx.beginPath();
    ctx.ellipse(ps.x, ps.y + 25, 44, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    const targetReagent = REAGENTS[ps.targetReagentIdx];
    ctx.fillStyle = ps.smokeTimer > 0 ? '#3E2723' : targetReagent.color;
    ctx.beginPath();
    ctx.ellipse(ps.x, ps.y + 24, 38, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(ps.x - 30, ps.y + 55);
    ctx.lineTo(ps.x - 45, ps.y + 90);
    ctx.moveTo(ps.x + 30, ps.y + 55);
    ctx.lineTo(ps.x + 45, ps.y + 90);
    ctx.stroke();

    ctx.fillStyle = '#FFF8E1';
    ctx.strokeStyle = '#BCAAA4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(ps.x - 65, ps.y - 120, 130, 48, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = targetReagent.color;
    ctx.beginPath();
    ctx.arc(ps.x - 38, ps.y - 96, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#263238';
    ctx.font = '800 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('RECIPE NEEDED:', ps.x - 20, ps.y - 102);
    ctx.fillStyle = targetReagent.color;
    ctx.font = '900 13px sans-serif';
    ctx.fillText(targetReagent.name.toUpperCase(), ps.x - 20, ps.y - 88);

    const carouselY = ps.y - 45;
    const itemSpacing = 30;
    const startX = ps.x - (REAGENTS.length * itemSpacing) / 2 + itemSpacing / 2;

    for (let i = 0; i < REAGENTS.length; i++) {
      const rx = startX + i * itemSpacing;
      const r = REAGENTS[i];
      const isSelected = Math.floor(ps.selectorPos) === i;

      if (isSelected) {
        ctx.fillStyle = r.glow;
        ctx.beginPath();
        ctx.arc(rx, carouselY, 18, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.arc(rx, carouselY + 2, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(rx - 3, carouselY - 1, 3, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(rx - 13, carouselY - 12, 26, 26);

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(rx, carouselY + 16);
        ctx.lineTo(rx - 5, carouselY + 12);
        ctx.lineTo(rx + 5, carouselY + 12);
        ctx.closePath();
        ctx.fill();
      }
    }

    if (ps.flashTimer > 0) {
      ctx.fillStyle = ps.flashSuccess ? '#4CAF50' : '#E53935';
      ctx.font = '900 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        ps.flashSuccess ? `PERFECT BREW! +${10 + ps.combo * 2}` : 'BOILED OVER! -5',
        ps.x,
        ps.y - 132
      );
    }

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.roundRect(ps.x - 55, ps.y + 115, 110, 36, 6);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.name}: ${ps.score} pts`, ps.x, ps.y + 130);
    ctx.font = '700 10px monospace';
    ctx.fillText(`Brewed: ${ps.potionsBrewed} | Combo: ${ps.combo}x`, ps.x, ps.y + 144);

    ctx.restore();
  }
}

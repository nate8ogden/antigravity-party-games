import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface SushiPlate {
  id: number;
  x: number;
  type: 'salmon' | 'tuna' | 'ebi' | 'tamago' | 'wasabi';
  name: string;
  color: string;
  scoreVal: number;
  isHazard: boolean;
}

const SUSHI_TYPES: { type: SushiPlate['type']; name: string; color: string; scoreVal: number; isHazard: boolean }[] = [
  { type: 'salmon', name: 'SALMON', color: '#FF7043', scoreVal: 15, isHazard: false },
  { type: 'tuna', name: 'TUNA', color: '#D32F2F', scoreVal: 15, isHazard: false },
  { type: 'ebi', name: 'EBI SHRIMP', color: '#FFAB91', scoreVal: 15, isHazard: false },
  { type: 'tamago', name: 'TAMAGO', color: '#FFEB3B', scoreVal: 12, isHazard: false },
  { type: 'wasabi', name: 'WASABI BOMB', color: '#7CB342', scoreVal: -15, isHazard: true }
];

interface SushiChefPlayer {
  id: PlayerId;
  x: number;
  y: number;
  targetType: SushiPlate['type'];
  score: number;
  ordersFulfilled: number;
  combo: number;
  snatchAnim: number;
  stunTimer: number;
}

export class SushiExpressGame extends BaseGame {
  public playersState: Map<PlayerId, SushiChefPlayer> = new Map();
  public currentMapName: string = 'Ginza Kaiten Sushi Bar';

  private plates: SushiPlate[] = [];
  private plateIdCounter: number = 0;
  private beltY: number = 0;
  private beltSpeed: number = 140;
  private spawnTimer: number = 0.4;
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
    this.plates = [];
    this.botReactionTimers.clear();

    this.beltY = height * 0.52;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      const validTypes = SUSHI_TYPES.filter(t => !t.isHazard);
      const initialOrder = validTypes[Math.floor(Math.random() * validTypes.length)].type;

      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: this.beltY + 70,
        targetType: initialOrder,
        score: 0,
        ordersFulfilled: 0,
        combo: 0,
        snatchAnim: 0,
        stunTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Spawn sushi plates onto conveyor
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.7 + Math.random() * 0.4;
      const tmpl = SUSHI_TYPES[Math.floor(Math.random() * SUSHI_TYPES.length)];
      this.plates.push({
        id: ++this.plateIdCounter,
        x: -40,
        type: tmpl.type,
        name: tmpl.name,
        color: tmpl.color,
        scoreVal: tmpl.scoreVal,
        isHazard: tmpl.isHazard
      });
    }

    // Scroll plates along belt
    for (let i = this.plates.length - 1; i >= 0; i--) {
      const plate = this.plates[i];
      plate.x += this.beltSpeed * dt;
      if (plate.x > width + 60) {
        this.plates.splice(i, 1);
      }
    }

    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const chef = this.playersState.get(p.id);
      if (!chef) continue;

      if (chef.stunTimer > 0) {
        chef.stunTimer -= dt;
        continue;
      }
      if (chef.snatchAnim > 0) chef.snatchAnim -= dt * 4;

      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      if (justAction) {
        this.handleSnatch(chef);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private handleSnatch(chef: SushiChefPlayer): void {
    chef.snatchAnim = 1.0;

    // Find plate directly above chef station
    let snatchedIdx = -1;
    for (let i = 0; i < this.plates.length; i++) {
      if (Math.abs(this.plates[i].x - chef.x) < 32) {
        snatchedIdx = i;
        break;
      }
    }

    if (snatchedIdx !== -1) {
      const plate = this.plates[snatchedIdx];
      this.plates.splice(snatchedIdx, 1);

      if (plate.isHazard) {
        // Wasabi bomb stun!
        chef.combo = 0;
        chef.score = Math.max(0, chef.score - 15);
        chef.stunTimer = 1.2;
        this.audio.playExplosion();
        this.particles.emit(chef.x, this.beltY, 10, '#7CB342');
      } else if (plate.type === chef.targetType) {
        // Correct order match!
        chef.combo++;
        chef.ordersFulfilled++;
        chef.score += plate.scoreVal + chef.combo * 2;
        this.audio.playScore();
        this.particles.spawnSparks(chef.x, this.beltY, plate.color, 10);

        // New order
        const validTypes = SUSHI_TYPES.filter(t => !t.isHazard);
        chef.targetType = validTypes[Math.floor(Math.random() * validTypes.length)].type;
      } else {
        // Wrong dish grabbed!
        chef.combo = 0;
        chef.score = Math.max(0, chef.score - 5);
        this.audio.playBounce();
        this.particles.emit(chef.x, this.beltY, 6, '#B0BEC5');
      }
    } else {
      // Empty grab / whiff
      this.audio.playTap();
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const chef = this.playersState.get(botId);
    if (!chef || chef.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    // Check if matching plate is over bot station
    const targetPlate = this.plates.find(
      p => Math.abs(p.x - chef.x) < 26 && p.type === chef.targetType
    );

    let snatch = false;
    let delay = 0.25;

    if (difficulty === 'bot_easy') {
      delay = 0.45;
      if (targetPlate && Math.random() < 0.6) snatch = true;
      else if (Math.random() < 0.15) snatch = true; // accidental grab
    } else if (difficulty === 'bot_hard') {
      delay = 0.10;
      if (targetPlate) snatch = true;
    } else {
      delay = 0.25;
      if (targetPlate) snatch = true;
    }

    if (snatch) {
      this.input.setBotInput(botId, true, 0, 0, true);
    }

    this.botReactionTimers.set(botId, delay);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const c = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: c?.score || 0,
        orders: c?.ordersFulfilled || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topOrders = scores[0]?.orders || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} served ${topOrders} nigiri plates to become Master Sushi Chef!`
      : 'The conveyor belt cleared with empty orders!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // Japanese Sushi Bar Wood Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1a110a');
    bgGrad.addColorStop(1, '#3e2723');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Header
    ctx.save();
    ctx.fillStyle = '#FFD54F';
    ctx.font = '900 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SUSHI EXPRESS', width / 2, 38);

    ctx.font = '700 13px sans-serif';
    ctx.fillStyle = '#FFE082';
    ctx.fillText('SNATCH REQUESTED SUSHI OFF CONVEYOR • EVADE WASABI BOMBS', width / 2, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 18px monospace';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 85);
    ctx.restore();

    // Conveyor Belt
    ctx.fillStyle = '#212121';
    ctx.fillRect(0, this.beltY - 18, width, 36);
    ctx.strokeStyle = '#424242';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, this.beltY - 18);
    ctx.lineTo(width, this.beltY - 18);
    ctx.moveTo(0, this.beltY + 18);
    ctx.lineTo(width, this.beltY + 18);
    ctx.stroke();

    // Moving belt slats
    const slatOffset = (Date.now() * 0.14) % 30;
    ctx.strokeStyle = '#37474F';
    ctx.lineWidth = 1.5;
    for (let x = -30 + slatOffset; x < width + 30; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, this.beltY - 18);
      ctx.lineTo(x, this.beltY + 18);
      ctx.stroke();
    }

    // Render Plates on Belt
    for (const plate of this.plates) {
      ctx.save();
      ctx.translate(plate.x, this.beltY);

      // Ceramic plate
      ctx.fillStyle = '#ECEFF1';
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#CFD8DC';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Sushi topping
      ctx.fillStyle = plate.color;
      ctx.beginPath();
      ctx.roundRect(-14, -6, 28, 12, 3);
      ctx.fill();

      // Nori belt / garnish
      if (!plate.isHazard) {
        ctx.fillStyle = '#1B5E20';
        ctx.fillRect(-3, -6, 6, 12);
      } else {
        // Skull mark on wasabi
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!', 0, 3);
      }

      ctx.restore();
    }

    // Render Player Stations & Chopsticks
    for (const p of this.getActivePlayers()) {
      const chef = this.playersState.get(p.id);
      if (!chef) continue;

      ctx.save();

      // Station Mat
      ctx.fillStyle = '#4E342E';
      ctx.beginPath();
      ctx.roundRect(chef.x - 45, chef.y, 90, 80, 8);
      ctx.fill();

      // Order Ticket Parchment
      const targetObj = SUSHI_TYPES.find(t => t.type === chef.targetType);
      ctx.fillStyle = '#FFF8E1';
      ctx.beginPath();
      ctx.roundRect(chef.x - 40, chef.y + 10, 80, 32, 4);
      ctx.fill();

      ctx.fillStyle = '#212121';
      ctx.font = '800 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ORDER:', chef.x, chef.y + 22);
      ctx.fillStyle = targetObj ? targetObj.color : '#FF7043';
      ctx.font = '900 11px sans-serif';
      ctx.fillText(targetObj?.name || '', chef.x, chef.y + 35);

      // Chopsticks pointing up to belt
      const reach = chef.snatchAnim * 35;
      ctx.strokeStyle = '#D7CCC8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(chef.x - 8, chef.y + 5);
      ctx.lineTo(chef.x - 2, this.beltY + 12 - reach);
      ctx.moveTo(chef.x + 8, chef.y + 5);
      ctx.lineTo(chef.x + 2, this.beltY + 12 - reach);
      ctx.stroke();

      // Player Score Banner
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.roundRect(chef.x - 40, chef.y + 50, 80, 24, 4);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${chef.score}`, chef.x, chef.y + 66);

      if (chef.stunTimer > 0) {
        ctx.fillStyle = '#FFEB3B';
        ctx.font = '900 12px monospace';
        ctx.fillText('WASABI STUN!', chef.x, chef.y - 12);
      }

      ctx.restore();
    }
  }
}

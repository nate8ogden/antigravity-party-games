import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface Searchlight {
  x: number;
  y: number;
  vx: number;
  radius: number;
}

interface SmokeCloud {
  x: number;
  y: number;
  timer: number;
}

export class SmokeBombEscapeGame extends BaseGame {
  private scores: Map<PlayerId, number> = new Map();
  private playerProgress: Map<PlayerId, number> = new Map(); // 0 to 1
  private smokeCanisters: Map<PlayerId, number> = new Map(); // canisters left
  private clouds: SmokeCloud[] = [];
  private lights: Searchlight[] = [];

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.scores.clear();
    this.playerProgress.clear();
    this.smokeCanisters.clear();
    this.clouds = [];
    this.roundTimer = 25.0;
    this.isFinished = false;

    this.lights = [
      { x: width * 0.2, y: height * 0.45, vx: 180, radius: 45 },
      { x: width * 0.8, y: height * 0.45, vx: -160, radius: 50 },
      { x: width * 0.5, y: height * 0.65, vx: 140, radius: 45 }
    ];

    for (const p of this.getActivePlayers()) {
      this.scores.set(p.id, 0);
      this.playerProgress.set(p.id, 0.05);
      this.smokeCanisters.set(p.id, 3);
    }
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

    // Update searchlights
    for (const light of this.lights) {
      light.x += light.vx * dt;
      if (light.x < 50) { light.x = 50; light.vx = Math.abs(light.vx); }
      if (light.x > width - 50) { light.x = width - 50; light.vx = -Math.abs(light.vx); }
    }

    // Update smoke clouds
    for (const cloud of this.clouds) {
      cloud.timer -= dt;
    }
    this.clouds = this.clouds.filter(c => c.timer > 0);

    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      let prog = this.playerProgress.get(p.id) || 0;
      let cans = this.smokeCanisters.get(p.id) || 0;

      // Steady forward movement
      prog = Math.min(1.0, prog + 0.18 * dt);

      const px = this.getPlayerX(i, width, active.length);
      const py = height - 60 - prog * (height - 140);

      // Tap deploys smoke canister
      if (this.input.justPressed(p.id) && cans > 0) {
        cans--;
        this.smokeCanisters.set(p.id, cans);
        this.clouds.push({ x: px, y: py, timer: 1.8 });
        this.particles.emit(px, py, 14, '#94A3B8');
        this.audio.playTone(280, 0.1, 'triangle');
      }

      // Check if inside smoke
      const inSmoke = this.clouds.some(c => Math.hypot(c.x - px, c.y - py) < 55);

      // Check if spotted by searchlight
      if (!inSmoke) {
        for (const light of this.lights) {
          if (Math.hypot(light.x - px, light.y - py) < light.radius) {
            // Spotted! Knocked back
            prog = Math.max(0.05, prog - 0.2);
            this.scores.set(p.id, Math.max(0, (this.scores.get(p.id) || 0) - 5));
            this.particles.emit(px, py, 10, '#EF4444');
            this.audio.playTone(180, 0.15, 'sawtooth');
            break;
          }
        }
      }

      // Reached extraction helipad at top
      if (prog >= 0.95) {
        prog = 0.05;
        this.smokeCanisters.set(p.id, 3);
        this.scores.set(p.id, (this.scores.get(p.id) || 0) + 25);
        this.particles.emit(px, height * 0.15, 18, '#22C55E');
        this.audio.playTone(920, 0.15, 'sine');
      }

      this.playerProgress.set(p.id, prog);
    }
  }

  protected updateBotAI(_dt: number, botId: PlayerId, difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard', width: number, height: number): void {
    const active = this.getActivePlayers();
    const i = active.findIndex(p => p.id === botId);
    if (i === -1) return;

    const prog = this.playerProgress.get(botId) || 0;
    const px = this.getPlayerX(i, width, active.length);
    const py = height - 60 - prog * (height - 140);
    const cans = this.smokeCanisters.get(botId) || 0;

    if (cans <= 0) return;

    if (difficulty === 'bot_easy' && Math.random() < 0.22) {
      this.input.setBotInput(botId, false);
      return;
    }

    const margin = difficulty === 'bot_easy' ? 18 : difficulty === 'bot_normal' ? 36 : 48;
    const canDeploy = difficulty === 'bot_easy' ? Math.random() < 0.70 : true;

    // Check if searchlight is approaching
    const danger = this.lights.some(l => Math.hypot(l.x - px, l.y - py) < l.radius + margin);
    const inSmoke = this.clouds.some(c => Math.hypot(c.x - px, c.y - py) < 50);

    if (danger && !inSmoke && canDeploy) {
      this.input.setBotInput(botId, true);
    } else {
      this.input.setBotInput(botId, false);
    }
  }

  private getPlayerX(index: number, width: number, total: number): number {
    const laneWidth = width / Math.max(1, total);
    return laneWidth * index + laneWidth / 2;
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.fillStyle = '#0B132B';
    ctx.fillRect(0, 0, width, height);

    // Extraction zone at top
    ctx.fillStyle = '#1C2541';
    ctx.fillRect(20, 20, width - 40, height * 0.15);
    ctx.fillStyle = '#22C55E';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HELICOPTER EXTRACTION (+25)', width / 2, 45);

    // Searchlights
    for (const light of this.lights) {
      ctx.fillStyle = 'rgba(254, 240, 138, 0.25)';
      ctx.beginPath();
      ctx.arc(light.x, light.y, light.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Smoke Clouds
    for (const cloud of this.clouds) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
      ctx.beginPath();
      ctx.arc(cloud.x, cloud.y, 45, 0, Math.PI * 2);
      ctx.fill();
    }

    // Players
    const active = this.getActivePlayers();
    for (let i = 0; i < active.length; i++) {
      const p = active[i];
      const prog = this.playerProgress.get(p.id) || 0;
      const cans = this.smokeCanisters.get(p.id) || 0;
      const px = this.getPlayerX(i, width, active.length);
      const py = height - 60 - prog * (height - 140);

      ctx.save();
      ctx.translate(px, py);

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();

      // Smoke canisters icons
      ctx.fillStyle = '#94A3B8';
      for (let c = 0; c < cans; c++) {
        ctx.fillRect(-10 + c * 8, 18, 5, 8);
      }

      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${this.scores.get(p.id) || 0}`, px, height - 15);
    }

    ctx.fillStyle = '#F8FAFC';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`SMOKE BOMB ESCAPE: ${Math.ceil(this.roundTimer)}s`, width / 2, 75);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = this.getActivePlayers()
      .map(p => ({
        playerId: p.id,
        score: this.scores.get(p.id) || 0,
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
      mvpHighlight: winnerId !== null ? `${this.getPlayer(winnerId)?.name} vanished into the smoke to extraction!` : 'All agents surrounded by searchlights!'
    };
  }
}

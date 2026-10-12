import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface JoustPlayer {
  id: PlayerId;
  team: 'LEFT' | 'RIGHT';
  x: number;
  y: number;
  speed: number;
  laneOffset: number; // Vertical offset from tilt rail
  lanceElevation: number; // Height of lance tip (-1 low, 0 mid, 1 high)
  isLanceLowered: boolean;
  score: number;
  unhorses: number;
  lanceBreaks: number;
  isUnhorsed: boolean;
  unhorseAnim: number;
}

export class JoustingKnightsGame extends BaseGame {
  public playersState: Map<PlayerId, JoustPlayer> = new Map();
  public currentMapName: string = 'Royal Tournament Tiltyard';

  private passNumber: number = 1;
  private maxPasses: number = 4;
  private passResetTimer: number = 0;
  private tiltRailY: number = 300;
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
    this.passNumber = 1;
    this.passResetTimer = 0;
    this.tiltRailY = height * 0.52;
    this.playersState.clear();
    this.botReactionTimers.clear();

    this.setupPass(width);
  }

  private setupPass(width: number): void {
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const team = (idx % 2 === 0) ? 'LEFT' : 'RIGHT';
      const startX = team === 'LEFT' ? width * 0.08 : width * 0.92;
      const initialY = team === 'LEFT' ? this.tiltRailY - 55 : this.tiltRailY + 55;

      const prevScore = this.playersState.get(p.id)?.score || 0;
      const prevUnhorses = this.playersState.get(p.id)?.unhorses || 0;
      const prevBreaks = this.playersState.get(p.id)?.lanceBreaks || 0;

      this.playersState.set(p.id, {
        id: p.id,
        team,
        x: startX,
        y: initialY,
        speed: 380,
        laneOffset: 0,
        lanceElevation: 0,
        isLanceLowered: false,
        score: prevScore,
        unhorses: prevUnhorses,
        lanceBreaks: prevBreaks,
        isUnhorsed: false,
        unhorseAnim: 0
      });
      this.botReactionTimers.set(p.id, 0.25 + Math.random() * 0.25);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // If reset timer active between passes
    if (this.passResetTimer > 0) {
      this.passResetTimer -= dt;
      if (this.passResetTimer <= 0) {
        if (this.passNumber >= this.maxPasses) {
          this.isFinished = true;
          return;
        }
        this.passNumber++;
        this.setupPass(width);
      }
      return;
    }

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Update players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.isUnhorsed) {
        ps.unhorseAnim += dt * 4;
        continue;
      }

      const throttle = this.input.getThrottle(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

      // Lane micro-elevation steering (aiming up/down toward rival shield crest)
      if (throttle !== 0) {
        ps.laneOffset += -throttle * 140 * dt;
        ps.laneOffset = Math.max(-25, Math.min(25, ps.laneOffset));
      }

      // Lance elevation / lowering
      ps.isLanceLowered = isAction;
      if (throttle > 0.3) ps.lanceElevation = 1; // High aim
      else if (throttle < -0.3) ps.lanceElevation = -1; // Low aim
      else ps.lanceElevation = 0; // Center chest aim

      // Gallop forward down the tiltyard toward opposite side
      const dir = ps.team === 'LEFT' ? 1 : -1;
      ps.x += dir * ps.speed * dt;
      ps.y = (ps.team === 'LEFT' ? this.tiltRailY - 55 : this.tiltRailY + 55) + ps.laneOffset;
    }

    // Check collision / clash moment when steeds cross in center
    const leftKnights = Array.from(this.playersState.values()).filter((p) => p.team === 'LEFT' && !p.isUnhorsed);
    const rightKnights = Array.from(this.playersState.values()).filter((p) => p.team === 'RIGHT' && !p.isUnhorsed);

    for (const lk of leftKnights) {
      for (const rk of rightKnights) {
        const dist = Math.abs(lk.x - rk.x);
        // Clash zone (when within 45px of each other along the rail)
        if (dist < 42 && this.passResetTimer <= 0) {
          const lkHasLance = lk.isLanceLowered;
          const rkHasLance = rk.isLanceLowered;

          // Check aim accuracy (lane alignment)
          const alignmentDiff = Math.abs(lk.lanceElevation - rk.lanceElevation);

          if (lkHasLance && rkHasLance) {
            // Mutual solid lance clash!
            this.audio.playExplosion();
            this.particles.shake(6);
            this.particles.spawnExplosion((lk.x + rk.x) / 2, this.tiltRailY, '#F59E0B', 24);

            if (alignmentDiff === 0) {
              // Both broke lances!
              lk.score += 200;
              rk.score += 200;
              lk.lanceBreaks += 1;
              rk.lanceBreaks += 1;
            } else if (lk.lanceElevation > rk.lanceElevation) {
              // Left knight struck shield crest unhorsing Right!
              rk.isUnhorsed = true;
              lk.score += 350;
              lk.unhorses += 1;
            } else {
              // Right knight unhorsed Left!
              lk.isUnhorsed = true;
              rk.score += 350;
              rk.unhorses += 1;
            }
          } else if (lkHasLance && !rkHasLance) {
            // Left knight unhorses undefended right knight!
            rk.isUnhorsed = true;
            lk.score += 400;
            lk.unhorses += 1;
            this.audio.playBounce();
            this.particles.shake(7);
            this.particles.spawnSparks(rk.x, rk.y, '#EF4444', 16);
          } else if (!lkHasLance && rkHasLance) {
            // Right knight unhorses undefended left knight!
            lk.isUnhorsed = true;
            rk.score += 400;
            rk.unhorses += 1;
            this.audio.playBounce();
            this.particles.shake(7);
            this.particles.spawnSparks(lk.x, lk.y, '#EF4444', 16);
          } else {
            // Neither lowered lances - clean pass without hits
            this.audio.playTap();
          }

          this.passResetTimer = 1.4;
          break;
        }
      }
    }

    // Check pass completion (steeds galloped past ends)
    const allPassed = Array.from(this.playersState.values()).every(
      (p) => (p.team === 'LEFT' && p.x > width * 0.94) || (p.team === 'RIGHT' && p.x < width * 0.06) || p.isUnhorsed
    );

    if (allPassed && this.passResetTimer <= 0) {
      this.passResetTimer = 1.2;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    _height: number
  ): void {
    const bot = this.playersState.get(botId);
    if (!bot || bot.isUnhorsed) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;

    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const interval =
      difficulty === 'bot_easy'
        ? 0.40 + Math.random() * 0.25
        : difficulty === 'bot_normal'
        ? 0.20 + Math.random() * 0.15
        : 0.08 + Math.random() * 0.06;
    this.botReactionTimers.set(botId, interval);

    // Distance to center clash
    const distToCenter = Math.abs(bot.x - width * 0.5);

    // Lower lance when approaching clash zone
    let action = false;
    let throttle = 0;

    if (distToCenter < 180) {
      action = true; // Lower lance!

      if (difficulty === 'bot_hard') {
        // Counter rival's elevation
        const rival = Array.from(this.playersState.values()).find((p) => p.team !== bot.team && !p.isUnhorsed);
        if (rival) {
          throttle = rival.lanceElevation;
        }
      } else if (difficulty === 'bot_normal') {
        throttle = Math.random() > 0.5 ? 1 : 0;
      }
    }

    this.input.setBotInput(botId, action, 0, throttle, action);
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
        unhorses: ps?.unhorses || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topUnhorses = scores[0]?.unhorses || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} scored ${topUnhorses} royal tourney unhorses!`
      : 'Draw! Both knights rode with equal heraldic valor!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Tiltyard Arena Dirt & Banners
    ctx.fillStyle = '#78350F'; // Sandy dirt ground
    ctx.fillRect(0, 0, width, height);

    // Green grass borders
    ctx.fillStyle = '#15803D';
    ctx.fillRect(0, 0, width, 60);
    ctx.fillRect(0, height - 60, width, 60);

    // 2. Wooden Tilt Barrier dividing left and right lanes
    ctx.fillStyle = '#451A03';
    ctx.fillRect(0, this.tiltRailY - 8, width, 16);

    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, this.tiltRailY);
    ctx.lineTo(width, this.tiltRailY);
    ctx.stroke();

    // 3. Render Knights & Galloping Steeds
    for (const ps of this.playersState.values()) {
      const cfg = this.players.find((x) => x.id === ps.id);
      const color = cfg ? cfg.color : '#FFFFFF';

      ctx.save();
      ctx.translate(ps.x, ps.y);

      if (ps.isUnhorsed) {
        ctx.rotate(ps.unhorseAnim * 1.5);
      }

      // Horse body
      const isLeft = ps.team === 'LEFT';
      ctx.fillStyle = isLeft ? '#D97706' : '#E2E8F0'; // Chestnut vs White Stallion
      ctx.beginPath();
      ctx.ellipse(0, 0, 24, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Horse Head
      const hDir = isLeft ? 1 : -1;
      ctx.beginPath();
      ctx.ellipse(hDir * 20, -6, 10, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Knight Armored Torso
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, -14, 10, 0, Math.PI * 2);
      ctx.fill();

      // Heraldic Shield
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(hDir * 4, -20, 10, 14);
      ctx.fillStyle = color;
      ctx.fillRect(hDir * 6, -18, 6, 10);

      // Jouster Lance
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 4;
      ctx.beginPath();

      const lanceAngle = ps.isLanceLowered
        ? ps.lanceElevation * 0.12
        : isLeft
        ? -Math.PI / 4
        : -Math.PI * 0.75;

      ctx.moveTo(0, -12);
      ctx.lineTo(hDir * Math.cos(lanceAngle) * 48, -12 + Math.sin(lanceAngle) * 48);
      ctx.stroke();

      // Lance tip spearhead
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.arc(hDir * Math.cos(lanceAngle) * 48, -12 + Math.sin(lanceAngle) * 48, 4, 0, Math.PI * 2);
      ctx.fill();

      // Player Label
      ctx.fillStyle = color;
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${ps.id + 1}`, 0, 24);

      ctx.restore();
    }

    // 4. Draw HUD
    this.renderHUD(ctx, width);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number): void {
    ctx.save();
    // Pass Counter Badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 65, 12, 130, 36, 10);
    ctx.fill();
    ctx.strokeStyle = '#EAB308';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`PASS ${this.passNumber} / ${this.maxPasses}`, width * 0.5, 30);

    // Score bar
    const active = this.getActivePlayers();
    const itemW = 95;
    const subBarW = active.length * itemW;
    const subBarX = width * 0.5 - subBarW * 0.5;

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      const px = subBarX + idx * itemW;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.beginPath();
      ctx.roundRect(px + 4, 52, itemW - 8, 26, 6);
      ctx.fill();

      ctx.fillStyle = p.color;
      ctx.font = 'bold 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`P${p.id + 1}: ${ps?.score || 0}`, px + itemW * 0.5, 68);
    });
    ctx.restore();
  }
}

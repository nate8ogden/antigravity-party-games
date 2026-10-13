import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type FeastThemeId = 'grand_hall' | 'cyber_diner' | 'pirate_galley';

interface FeastTheme {
  id: FeastThemeId;
  name: string;
  icon: string;
  bgTop: string;
  bgBottom: string;
  floorColor: string;
  floorTrim: string;
  platterColor: string;
  accentGlow: string;
  sparkColor: string;
}

const THEMES: Record<FeastThemeId, FeastTheme> = {
  grand_hall: {
    id: 'grand_hall',
    name: 'Grand Banquet Hall',
    icon: '🏰',
    bgTop: '#451A03',
    bgBottom: '#1C1917',
    floorColor: '#29180C',
    floorTrim: '#F59E0B',
    platterColor: '#FDE047',
    accentGlow: '#F59E0B',
    sparkColor: '#FEF08A'
  },
  cyber_diner: {
    id: 'cyber_diner',
    name: 'Cyber Neon Diner',
    icon: '⚡',
    bgTop: '#090D16',
    bgBottom: '#020617',
    floorColor: '#0F172A',
    floorTrim: '#06B6D4',
    platterColor: '#38BDF8',
    accentGlow: '#06B6D4',
    sparkColor: '#67E8F9'
  },
  pirate_galley: {
    id: 'pirate_galley',
    name: 'Pirate Galleon Galley',
    icon: '🏴‍☠️',
    bgTop: '#292524',
    bgBottom: '#18181B',
    floorColor: '#1C1917',
    floorTrim: '#B45309',
    platterColor: '#E2E8F0',
    accentGlow: '#EA580C',
    sparkColor: '#FBBF24'
  }
};

const THEME_ORDER: FeastThemeId[] = ['grand_hall', 'cyber_diner', 'pirate_galley'];

type FoodType = 'turkey' | 'goblet' | 'pie' | 'golden_roast' | 'rotten_fish' | 'poison_cabbage';

interface FallingDelicacy {
  id: number;
  x: number;
  y: number;
  vy: number;
  type: FoodType;
  scoreValue: number;
  isHazard: boolean;
  size: number;
  color: string;
  rotation: number;
  vRot: number;
}

interface ButlerPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  dir: number;
  platterWidth: number;
  chargeTime: number; // 0 to 1
  isCharging: boolean;
  score: number;
  combo: number;
  itemsCaught: number;
  stunTimer: number;
  catchAnim: number;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  moodTimer: number;
}

export class RoyalFeastGame extends BaseGame {
  public playersState: Map<PlayerId, ButlerPlayer> = new Map();
  public currentTheme: FeastThemeId = 'grand_hall';

  public get currentMapName(): string {
    return THEMES[this.currentTheme].name;
  }

  private delicacies: FallingDelicacy[] = [];
  private delicacyIdCounter: number = 0;
  private spawnTimer: number = 0.4;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private lastHeight: number = 600;
  private keydownHandler?: (e: KeyboardEvent) => void;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 35.0;

    if (typeof window !== 'undefined') {
      this.keydownHandler = (e: KeyboardEvent) => {
        if (e.key === 't' || e.key === 'T') {
          this.cycleTheme();
        } else if (e.key === '1') {
          this.setTheme('grand_hall');
        } else if (e.key === '2') {
          this.setTheme('cyber_diner');
        } else if (e.key === '3') {
          this.setTheme('pirate_galley');
        }
      };
      window.addEventListener('keydown', this.keydownHandler);
    }
  }

  public cycleTheme(): void {
    const curIdx = THEME_ORDER.indexOf(this.currentTheme);
    const nextIdx = (curIdx + 1) % THEME_ORDER.length;
    this.setTheme(THEME_ORDER[nextIdx]);
  }

  public setTheme(theme: FeastThemeId): void {
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnSparks(105, 556, THEMES[theme].accentGlow, 16);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.delicacies = [];
    this.delicacyIdCounter = 0;
    this.spawnTimer = 0.3;
    this.playersState.clear();
    this.botReactionTimers.clear();
    this.lastHeight = height;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height * 0.74,
        vx: 0,
        dir: idx % 2 === 0 ? 1 : -1,
        platterWidth: 54,
        chargeTime: 0,
        isCharging: false,
        score: 0,
        combo: 0,
        itemsCaught: 0,
        stunTimer: 0,
        catchAnim: 0,
        isUnderdog: false,
        currentMood: 'idle',
        moodTimer: 2.0
      });
      this.botReactionTimers.set(p.id, 0.2);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.lastHeight = height;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    const isSuddenDeath = this.roundTimer <= 15.0;

    // Check underdog
    let maxScore = 0;
    let minScore = Infinity;
    this.playersState.forEach((ps) => {
      if (ps.score > maxScore) maxScore = ps.score;
      if (ps.score < minScore) minScore = ps.score;
    });
    this.playersState.forEach((ps) => {
      ps.isUnderdog = maxScore - ps.score >= 250 && maxScore > 0;
      ps.platterWidth = ps.isUnderdog ? 72 : 54;
    });

    // Spawn falling delicacies
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = (isSuddenDeath ? 0.24 : 0.38) + Math.random() * 0.2;
      this.spawnFoodItem(width, isSuddenDeath);
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();

    // Update player movement and charging
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        continue;
      }
      if (ps.catchAnim > 0) {
        ps.catchAnim = Math.max(0, ps.catchAnim - dt * 4.5);
      }
      if (ps.moodTimer > 0) {
        ps.moodTimer -= dt;
        if (ps.moodTimer <= 0) ps.currentMood = 'idle';
      }

      const steer = this.input.getSteer(p.id);
      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
      const justReleased = this.input.justReleased(p.id);

      // Hold-to-Charge Platter Spin / Turbo Dash
      if (isAction) {
        ps.isCharging = true;
        ps.chargeTime = Math.min(1.0, ps.chargeTime + dt * 2.0);

        if (ps.chargeTime >= 0.7 && Math.random() < 0.25) {
          this.particles.spawnSparks(ps.x, ps.y - 14, '#F59E0B', 1);
        }
      } else if (ps.isCharging || justReleased) {
        const isTurbo = ps.chargeTime >= 0.7;
        ps.isCharging = false;
        ps.chargeTime = 0;

        if (isTurbo) {
          this.audio.playWhoosh();
          this.particles.shake(3);
          this.particles.spawnSparks(ps.x, ps.y - 14, '#FDE047', 12);
          ps.vx = ps.dir * 420; // Turbo sprint burst!
        }
      }

      // Movement
      const baseSpd = ps.isUnderdog ? 280 : 250;
      if (Math.abs(steer) > 0.15) {
        ps.dir = Math.sign(steer);
        ps.vx = steer * (ps.chargeTime > 0 ? baseSpd * 1.3 : baseSpd);
      } else {
        ps.vx *= 0.88;
      }

      ps.x += ps.vx * dt;
      ps.x = Math.max(45, Math.min(width - 45, ps.x));
    }

    // Inter-player bumping collisions
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const p1 = this.playersState.get(active[i].id);
        const p2 = this.playersState.get(active[j].id);
        if (!p1 || !p2 || p1.stunTimer > 0 || p2.stunTimer > 0) continue;

        const dist = Math.abs(p1.x - p2.x);
        if (dist < 38) {
          // Bumping collision!
          const knockDir = p1.x < p2.x ? -1 : 1;
          p1.x += knockDir * 12;
          p2.x -= knockDir * 12;
          p1.vx = knockDir * 180;
          p2.vx = -knockDir * 180;

          this.audio.playBounce();
          this.particles.spawnSparks((p1.x + p2.x) * 0.5, p1.y - 14, '#F59E0B', 8);
        }
      }
    }

    // Update Falling items
    for (let i = this.delicacies.length - 1; i >= 0; i--) {
      const item = this.delicacies[i];
      item.y += item.vy * dt;
      item.rotation += item.vRot * dt;

      let caught = false;
      for (const p of active) {
        const ps = this.playersState.get(p.id);
        if (!ps || ps.stunTimer > 0) continue;

        const platterY = ps.y - 16;
        const dx = Math.abs(item.x - ps.x);
        const dy = Math.abs(item.y - platterY);

        if (dx < ps.platterWidth * 0.5 + item.size * 0.5 && dy < 18) {
          caught = true;
          this.handleCatch(ps, item, isSuddenDeath);
          break;
        }
      }

      if (caught || item.y > height * 0.82) {
        if (!caught && item.isHazard) {
          this.particles.spawnSparks(item.x, height * 0.81, item.color, 4);
        }
        this.delicacies.splice(i, 1);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private spawnFoodItem(width: number, isSuddenDeath: boolean): void {
    const roll = Math.random();
    let type: FoodType = 'turkey';
    let scoreValue = 120;
    let isHazard = false;
    let color = '#8D6E63';
    let size = 18;
    let spd = isSuddenDeath ? 210 : 160;

    if (roll < 0.12) {
      type = 'golden_roast';
      scoreValue = 350;
      color = '#F59E0B';
      size = 22;
      spd += 20;
    } else if (roll < 0.35) {
      type = 'goblet';
      scoreValue = 180;
      color = '#FFD700';
      size = 15;
    } else if (roll < 0.55) {
      type = 'pie';
      scoreValue = 100;
      color = '#FF7043';
      size = 16;
    } else if (roll < 0.75) {
      type = 'turkey';
      scoreValue = 120;
      color = '#8D6E63';
      size = 18;
    } else if (roll < 0.88) {
      type = 'rotten_fish';
      scoreValue = -80;
      isHazard = true;
      color = '#558B2F';
      size = 16;
    } else {
      type = 'poison_cabbage';
      scoreValue = -120;
      isHazard = true;
      color = '#7CB342';
      size = 17;
    }

    this.delicacies.push({
      id: ++this.delicacyIdCounter,
      x: 60 + Math.random() * (width - 120),
      y: 90,
      vy: spd + Math.random() * 60,
      type,
      scoreValue,
      isHazard,
      size,
      color,
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 3
    });
  }

  private handleCatch(ps: ButlerPlayer, item: FallingDelicacy, isSuddenDeath: boolean): void {
    ps.catchAnim = 1.0;

    if (item.isHazard) {
      if (!ps.isUnderdog) {
        ps.combo = 0;
        ps.score = Math.max(0, ps.score + item.scoreValue);
        ps.stunTimer = 0.9;
      }
      ps.currentMood = 'shocked';
      ps.moodTimer = 1.5;

      this.audio.playExplosion();
      this.particles.shake(5);
      this.particles.spawnSparks(ps.x, ps.y - 14, '#EF4444', 12);
    } else {
      ps.combo++;
      const comboMult = Math.min(4, 1 + Math.floor(ps.combo / 3));
      const mult = isSuddenDeath ? 2 : 1;
      const pts = item.scoreValue * comboMult * mult;

      ps.score += pts;
      ps.itemsCaught++;
      ps.currentMood = 'happy';
      ps.moodTimer = 1.5;

      if (item.type === 'golden_roast') {
        this.audio.playExplosion();
        this.particles.shake(6);
        this.particles.spawnExplosion(ps.x, ps.y - 16, '#F59E0B', 24);
      } else {
        this.audio.playScore();
        this.particles.shake(3);
        this.particles.spawnSparks(ps.x, ps.y - 14, item.color, 12);
      }
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
    if (!ps || ps.stunTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const nearbyItems = this.delicacies
      .filter((d) => d.y < ps.y && Math.abs(d.x - ps.x) < 220)
      .sort((a, b) => b.y - a.y);

    let targetX = ps.x;
    let action = false;

    if (nearbyItems.length > 0) {
      const item = nearbyItems[0];
      if (item.isHazard) {
        if (difficulty === 'bot_easy' && Math.random() < 0.20) {
          targetX = item.x; // Mistake on easy
        } else {
          targetX = item.x > ps.x ? ps.x - 60 : ps.x + 60; // Evade hazard
        }
      } else {
        targetX = item.x;
        if (difficulty === 'bot_hard' && item.type === 'golden_roast' && Math.abs(item.x - ps.x) > 60) {
          action = true; // Turbo charge towards golden roast
        }
      }
    }

    const dx = targetX - ps.x;
    let steer = 0;
    if (Math.abs(dx) > 12) {
      steer = Math.sign(dx);
    }

    this.input.setBotInput(botId, action, steer, 0, action);

    const interval =
      difficulty === 'bot_easy'
        ? 0.38 + Math.random() * 0.20
        : difficulty === 'bot_normal'
        ? 0.18 + Math.random() * 0.10
        : 0.08 + Math.random() * 0.05;
    this.botReactionTimers.set(botId, interval);
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
        caught: ps?.itemsCaught || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topScore = scores[0]?.score || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} served the Grand Banquet with highest chivalry (${topScore} pts)!`
      : 'The feast ended in a chaotic banquet brawl!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastHeight = height;
    const theme = THEMES[this.currentTheme];

    // 1. Banquet Hall Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgTop);
    bgGrad.addColorStop(0.7, theme.bgBottom);
    bgGrad.addColorStop(1, '#000000');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Banquet Floor & Trim
    ctx.fillStyle = theme.floorColor;
    ctx.fillRect(0, height * 0.72, width, height * 0.28);
    ctx.strokeStyle = theme.floorTrim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.72);
    ctx.lineTo(width, height * 0.72);
    ctx.stroke();

    // 2. Render Falling Delicacies
    for (const item of this.delicacies) {
      this.renderDelicacy(ctx, item);
    }

    // 3. Render Butler Players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderButler(ctx, ps, p, theme);
    }

    // 4. Safe UI & Theme Pill
    this.renderSafeUI(ctx, width, height);
  }

  private renderDelicacy(ctx: CanvasRenderingContext2D, item: FallingDelicacy): void {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rotation);

    if (item.type === 'golden_roast') {
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.ellipse(0, 0, item.size, item.size * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FEF08A';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (item.type === 'turkey') {
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, item.size, item.size * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(item.size * 0.6, -3, 8, 6);
    } else if (item.type === 'goblet') {
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.moveTo(-8, -10);
      ctx.lineTo(8, -10);
      ctx.lineTo(6, 2);
      ctx.lineTo(-6, 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(-2, 2, 4, 8);
      ctx.fillRect(-6, 10, 12, 3);
    } else if (item.type === 'pie') {
      ctx.fillStyle = '#D7CCC8';
      ctx.beginPath();
      ctx.arc(0, 2, item.size * 0.8, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = '#D32F2F';
      ctx.beginPath();
      ctx.ellipse(0, 2, item.size * 0.75, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.type === 'rotten_fish') {
      ctx.fillStyle = '#78909C';
      ctx.beginPath();
      ctx.ellipse(0, 0, item.size, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7CB342';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-6, -8);
      ctx.lineTo(-4, -14);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#558B2F';
      ctx.beginPath();
      ctx.arc(0, 0, item.size * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  private renderButler(
    ctx: CanvasRenderingContext2D,
    ps: ButlerPlayer,
    p: PlayerConfig,
    theme: FeastTheme
  ): void {
    ctx.save();
    const isBot = p.type !== 'human';
    const isStunned = ps.stunTimer > 0;
    const bounceOffset = ps.catchAnim * 5;

    ctx.translate(ps.x, ps.y);

    // Butler Mascot
    ctx.save();
    ctx.translate(0, 8);
    drawCharacter(
      ctx,
      0,
      0,
      15,
      p.id,
      isBot,
      ps.currentMood,
      ps.chargeTime * 4,
      undefined
    );
    ctx.restore();

    // Golden / Cyber Platter Tray
    const platterY = -16 + bounceOffset;
    ctx.fillStyle = theme.platterColor;
    ctx.beginPath();
    ctx.ellipse(0, platterY, ps.platterWidth * 0.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Kinetic Turbo Glow on Platter
    if (ps.chargeTime > 0) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2 + ps.chargeTime * 3;
      ctx.beginPath();
      ctx.ellipse(0, platterY, ps.platterWidth * 0.5 + ps.chargeTime * 8, 10, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (isStunned) {
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('★ SLIPPED ★', 0, -32);
    } else if (ps.isUnderdog) {
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑 SURGE', 0, -32);
    } else if (ps.combo > 1) {
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 11px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${ps.combo}x COMBO`, 0, -32);
    }

    ctx.restore();
  }

  private renderSafeUI(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    // 1. Minigame Header Badge at y: 56 (PRESERVING GLOBAL TIMER AT y: 12-44!)
    const isSuddenDeath = this.roundTimer <= 15.0;
    const badgeW = 270;
    const badgeH = 28;
    const badgeX = (width - badgeW) * 0.5;
    const badgeY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 8);
    ctx.fill();
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : '#F59E0B';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#EF4444' : '#FFFFFF';
    ctx.font = 'bold 12px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const statusText = isSuddenDeath
      ? '🔥 FOOD FRENZY! 2X SCORE & GOLDEN ROASTS'
      : 'CATCH FALLING FOOD • HOLD FOR TURBO SPRINT';
    ctx.fillText(statusText, width * 0.5, badgeY + badgeH * 0.5);

    // 2. Corner Player Cards (Offset to y: height - 128)
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      let cardX = 20;
      let cardY = height - 128;

      if (idx === 0) {
        cardX = 20;
        cardY = height - 128;
      } else if (idx === 1) {
        cardX = width - 150;
        cardY = height - 128;
      } else if (idx === 2) {
        cardX = 20;
        cardY = 92;
      } else {
        cardX = width - 150;
        cardY = 92;
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, 130, 48, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Mini Mascot Icon
      ctx.save();
      ctx.translate(cardX + 22, cardY + 24);
      drawCharacter(
        ctx,
        0,
        0,
        14,
        p.id,
        p.type !== 'human',
        ps?.currentMood || 'idle',
        0,
        undefined
      );
      ctx.restore();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`P${p.id + 1} (${p.type === 'human' ? 'YOU' : 'BOT'})`, cardX + 44, cardY + 8);

      ctx.fillStyle = p.color;
      ctx.font = 'bold 13px "Chakra Petch", monospace';
      ctx.fillText(`${ps?.score || 0} pts`, cardX + 44, cardY + 26);
    });

    // 3. Theme Pill at bottom-left (x: 20, y: height - 44, w: 170, h: 32)
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;
    const theme = THEMES[this.currentTheme];

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();
    ctx.strokeStyle = theme.floorTrim;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name.substring(0, 14)} [T]`, pillX + pillW * 0.5, pillY + pillH * 0.5);

    // 4. Control Hints
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '11px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Hold [Space/Action]: Turbo Dash | [A/D]: Glide & Catch', width - 20, height - 14);

    ctx.restore();
  }

  public handleClick(x: number, y: number): boolean {
    const pillX = 20;
    const pillY = (this.lastHeight || 600) - 44;
    const pillW = 170;
    const pillH = 32;

    if (x >= pillX && x <= pillX + pillW && y >= pillY && y <= pillY + pillH) {
      this.cycleTheme();
      return true;
    }
    return false;
  }

  public syncDebug(): Record<string, any> {
    return {
      theme: this.currentTheme,
      delicaciesCount: this.delicacies.length,
      roundTimer: this.roundTimer,
      players: Array.from(this.playersState.values()).map((p) => ({
        id: p.id,
        score: p.score,
        caught: p.itemsCaught,
        combo: p.combo,
        isUnderdog: p.isUnderdog,
        x: Math.round(p.x)
      }))
    };
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = undefined;
    }
    this.delicacies = [];
    this.playersState.clear();
  }
}

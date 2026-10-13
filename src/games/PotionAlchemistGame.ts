import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type AlchemistThemeId = 'grand_lab' | 'witch_hollow' | 'celestial';

interface AlchemistTheme {
  id: AlchemistThemeId;
  name: string;
  icon: string;
  bgTop: string;
  bgBottom: string;
  tableWood: string;
  cauldronSteel: string;
  floorTrim: string;
  accentGlow: string;
  sparkColor: string;
}

const THEMES: Record<AlchemistThemeId, AlchemistTheme> = {
  grand_lab: {
    id: 'grand_lab',
    name: 'Grand Alchemical Laboratory',
    icon: '🧪',
    bgTop: '#1E1B4B',
    bgBottom: '#0F172A',
    tableWood: '#422817',
    cauldronSteel: '#334155',
    floorTrim: '#6366F1',
    accentGlow: '#F59E0B',
    sparkColor: '#FDE047'
  },
  witch_hollow: {
    id: 'witch_hollow',
    name: 'Witch Hollow Cauldron',
    icon: '🧙‍♀️',
    bgTop: '#064E3B',
    bgBottom: '#022C22',
    tableWood: '#2E1065',
    cauldronSteel: '#1E293B',
    floorTrim: '#10B981',
    accentGlow: '#34D399',
    sparkColor: '#A7F3D0'
  },
  celestial: {
    id: 'celestial',
    name: 'Celestial Star Alembic',
    icon: '✨',
    bgTop: '#090D16',
    bgBottom: '#020617',
    tableWood: '#1E1B4B',
    cauldronSteel: '#1E293B',
    floorTrim: '#8B5CF6',
    accentGlow: '#38BDF8',
    sparkColor: '#C084FC'
  }
};

const THEME_ORDER: AlchemistThemeId[] = ['grand_lab', 'witch_hollow', 'celestial'];

interface Reagent {
  id: number;
  name: string;
  color: string;
  glow: string;
}

const REAGENTS: Reagent[] = [
  { id: 0, name: 'Dragon Root', color: '#EF4444', glow: 'rgba(239, 68, 68, 0.4)' },
  { id: 1, name: 'Moon Lotus', color: '#38BDF8', glow: 'rgba(56, 189, 248, 0.4)' },
  { id: 2, name: 'Emerald Moss', color: '#10B981', glow: 'rgba(16, 185, 129, 0.4)' },
  { id: 3, name: 'Sun Amber', color: '#F59E0B', glow: 'rgba(245, 158, 11, 0.4)' }
];

interface AlchemistStation {
  id: PlayerId;
  x: number;
  y: number;
  targetReagentIdx: number;
  selectorPos: number; // 0 to 4
  selectorSpeed: number;
  chargeTime: number; // 0 to 1
  isCharging: boolean;
  score: number;
  combo: number;
  potionsBrewed: number;
  cauldronBubbleTimer: number;
  flashTimer: number;
  flashSuccess: boolean;
  smokeTimer: number;
  sabotageTimer: number;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  moodTimer: number;
}

export class PotionAlchemistGame extends BaseGame {
  public playersState: Map<PlayerId, AlchemistStation> = new Map();
  public currentTheme: AlchemistThemeId = 'grand_lab';

  public get currentMapName(): string {
    return THEMES[this.currentTheme].name;
  }

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
          this.setTheme('grand_lab');
        } else if (e.key === '2') {
          this.setTheme('witch_hollow');
        } else if (e.key === '3') {
          this.setTheme('celestial');
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

  public setTheme(theme: AlchemistThemeId): void {
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
        y: height * 0.54,
        targetReagentIdx: Math.floor(Math.random() * REAGENTS.length),
        selectorPos: 0,
        selectorSpeed: 2.2 + Math.random() * 0.3,
        chargeTime: 0,
        isCharging: false,
        score: 0,
        combo: 0,
        potionsBrewed: 0,
        cauldronBubbleTimer: Math.random() * 0.4,
        flashTimer: 0,
        flashSuccess: false,
        smokeTimer: 0,
        sabotageTimer: 0,
        isUnderdog: false,
        currentMood: 'idle',
        moodTimer: 2.0
      });
      this.botReactionTimers.set(p.id, 0.2 + Math.random() * 0.2);
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
      ps.isUnderdog = maxScore - ps.score >= 200 && maxScore > 0;
    });

    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.flashTimer > 0) ps.flashTimer -= dt;
      if (ps.smokeTimer > 0) ps.smokeTimer -= dt;
      if (ps.sabotageTimer > 0) ps.sabotageTimer -= dt;

      if (ps.moodTimer > 0) {
        ps.moodTimer -= dt;
        if (ps.moodTimer <= 0) ps.currentMood = 'idle';
      }

      // Cauldron bubble effect
      ps.cauldronBubbleTimer -= dt;
      if (ps.cauldronBubbleTimer <= 0) {
        ps.cauldronBubbleTimer = 0.16 + Math.random() * 0.16;
        const col = REAGENTS[ps.targetReagentIdx].color;
        this.particles.spawnSparks(ps.x + (Math.random() - 0.5) * 36, ps.y - 12, col, 2);
      }

      // Cycle selector
      let spd = ps.selectorSpeed;
      if (ps.isUnderdog) spd *= 0.75; // Slower for trailing player
      if (isSuddenDeath) spd *= 1.35; // Faster during sudden death
      if (ps.sabotageTimer > 0) spd = -spd * 1.3; // Reversed and erratic under sabotage!

      ps.selectorPos = (ps.selectorPos + spd * dt + REAGENTS.length) % REAGENTS.length;

      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
      const justReleased = this.input.justReleased(p.id);

      // Hold-to-Charge Catalyst Infusion
      if (isAction) {
        ps.isCharging = true;
        ps.chargeTime = Math.min(1.0, ps.chargeTime + dt * 2.2);

        if (ps.chargeTime >= 0.75 && Math.random() < 0.25) {
          this.particles.spawnSparks(ps.x, ps.y - 20, '#F59E0B', 1);
        }
      } else if (ps.isCharging || justReleased) {
        // Drop reagent into cauldron
        const isCatalyzed = ps.chargeTime >= 0.75;
        ps.isCharging = false;
        ps.chargeTime = 0;
        this.handleDropReagent(ps, isCatalyzed, isSuddenDeath);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private handleDropReagent(ps: AlchemistStation, isCatalyzed: boolean, isSuddenDeath: boolean): void {
    const currentReagentIdx = Math.floor(ps.selectorPos);
    const isCorrect = currentReagentIdx === ps.targetReagentIdx;

    if (isCorrect) {
      ps.combo++;
      const basePts = isCatalyzed ? 150 : 80;
      const comboMult = Math.min(4, 1 + Math.floor(ps.combo / 2));
      const mult = isSuddenDeath ? 2 : 1;
      const underdogBonus = ps.isUnderdog ? 1.3 : 1.0;
      const pts = Math.round(basePts * comboMult * mult * underdogBonus);

      ps.score += pts;
      ps.potionsBrewed++;
      ps.flashTimer = 0.45;
      ps.flashSuccess = true;
      ps.currentMood = 'happy';
      ps.moodTimer = 1.6;

      if (isCatalyzed) {
        this.audio.playExplosion();
        this.particles.shake(6);
        this.particles.spawnExplosion(ps.x, ps.y - 24, '#F59E0B', 24);
        this.triggerFumeSabotage(ps.id);
      } else {
        this.audio.playScore();
        this.particles.shake(3);
        this.particles.spawnSparks(ps.x, ps.y - 20, REAGENTS[ps.targetReagentIdx].color, 14);
      }

      // Pick new target reagent
      let nextTarget = Math.floor(Math.random() * REAGENTS.length);
      if (nextTarget === ps.targetReagentIdx) {
        nextTarget = (nextTarget + 1) % REAGENTS.length;
      }
      ps.targetReagentIdx = nextTarget;
      ps.selectorSpeed = Math.min(3.6, 2.2 + ps.potionsBrewed * 0.1);
    } else {
      // Wrong ingredient dropped
      if (!ps.isUnderdog) {
        ps.combo = 0;
        ps.score = Math.max(0, ps.score - 40);
      }
      ps.flashTimer = 0.45;
      ps.flashSuccess = false;
      ps.smokeTimer = 0.6;
      ps.currentMood = 'shocked';
      ps.moodTimer = 1.5;

      this.audio.playBounce();
      this.particles.shake(5);
      this.particles.spawnSparks(ps.x, ps.y - 15, '#EF4444', 12);
    }
  }

  private triggerFumeSabotage(leaderId: PlayerId): void {
    for (const p of this.getActivePlayers()) {
      if (p.id === leaderId) continue;
      const ps = this.playersState.get(p.id);
      if (ps) {
        ps.sabotageTimer = 0.7;
        ps.smokeTimer = 0.7;
        ps.currentMood = 'shocked';
        this.particles.spawnSparks(ps.x, ps.y - 20, '#A855F7', 10);
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
      if (Math.random() < 0.20) {
        shouldPress = true; // Error
      } else if (isTarget) {
        const subPos = ps.selectorPos - currentIdx;
        if (subPos > 0.25 && subPos < 0.75) {
          shouldPress = true;
        }
      }
    } else if (difficulty === 'bot_hard') {
      delay = 0.08;
      if (isTarget) {
        const subPos = ps.selectorPos - currentIdx;
        if (subPos > 0.15 && subPos < 0.85) {
          shouldPress = true;
        }
      }
    } else {
      delay = 0.20;
      if (isTarget) {
        const subPos = ps.selectorPos - currentIdx;
        if (subPos > 0.20 && subPos < 0.80) {
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
      ? `Player ${winnerId + 1} crowned Grand Court Alchemist with ${topPotions} master potions brewed!`
      : 'The cauldrons boiled over with equal mystical vigor!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastHeight = height;
    const theme = THEMES[this.currentTheme];

    // 1. Alchemical Laboratory Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgTop);
    bgGrad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Stone laboratory floor
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, height * 0.72, width, height * 0.28);
    ctx.strokeStyle = theme.floorTrim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.72);
    ctx.lineTo(width, height * 0.72);
    ctx.stroke();

    // 2. Render Alchemist Stations
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderStation(ctx, ps, p, theme);
    }

    // 3. Safe UI & Theme Pill
    this.renderSafeUI(ctx, width, height);
  }

  private renderStation(
    ctx: CanvasRenderingContext2D,
    ps: AlchemistStation,
    p: PlayerConfig,
    theme: AlchemistTheme
  ): void {
    ctx.save();
    const isBot = p.type !== 'human';

    // Wooden table
    ctx.fillStyle = theme.tableWood;
    ctx.fillRect(ps.x - 70, ps.y + 35, 140, 75);
    ctx.fillStyle = '#1E140A';
    ctx.fillRect(ps.x - 74, ps.y + 32, 148, 8);

    // Cast Iron Cauldron Body
    ctx.fillStyle = theme.cauldronSteel;
    ctx.beginPath();
    ctx.arc(ps.x, ps.y + 25, 42, 0, Math.PI);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Cauldron Rim
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.ellipse(ps.x, ps.y + 25, 44, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bubbling Potion Liquid Surface
    const targetReagent = REAGENTS[ps.targetReagentIdx];
    ctx.fillStyle = ps.smokeTimer > 0 ? '#450A0A' : targetReagent.color;
    ctx.beginPath();
    ctx.ellipse(ps.x, ps.y + 24, 38, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Catalyst Infusion Swirl
    if (ps.chargeTime > 0) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2 + ps.chargeTime * 3;
      ctx.beginPath();
      ctx.ellipse(ps.x, ps.y + 24, 28 + ps.chargeTime * 10, 6 + ps.chargeTime * 3, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Cauldron Tripod Legs
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(ps.x - 30, ps.y + 55);
    ctx.lineTo(ps.x - 45, ps.y + 90);
    ctx.moveTo(ps.x + 30, ps.y + 55);
    ctx.lineTo(ps.x + 45, ps.y + 90);
    ctx.stroke();

    // Alchemist Mascot (Standing beside cauldron at x: -44, y: 15)
    ctx.save();
    ctx.translate(ps.x - 42, ps.y + 10);
    drawCharacter(
      ctx,
      0,
      0,
      14,
      p.id,
      isBot,
      ps.currentMood,
      ps.chargeTime * 4,
      undefined
    );
    ctx.restore();

    // Recipe Scroll (at y: -128)
    ctx.fillStyle = '#FFF8E1';
    ctx.strokeStyle = '#BCAAA4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(ps.x - 65, ps.y - 128, 130, 48, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = targetReagent.color;
    ctx.beginPath();
    ctx.arc(ps.x - 38, ps.y - 104, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#263238';
    ctx.font = 'bold 10px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('RECIPE NEEDED:', ps.x - 20, ps.y - 110);
    ctx.fillStyle = targetReagent.color;
    ctx.font = 'bold 12px Montserrat, sans-serif';
    ctx.fillText(targetReagent.name.toUpperCase(), ps.x - 20, ps.y - 96);

    // Reagent Carousel (at y: -50)
    const carouselY = ps.y - 50;
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

    // Flash Feedback Text
    if (ps.flashTimer > 0) {
      ctx.fillStyle = ps.flashSuccess ? '#10B981' : '#EF4444';
      ctx.font = 'bold 13px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        ps.flashSuccess ? `PERFECT BREW! +${ps.combo * 80}` : 'BOILED OVER! -40',
        ps.x,
        ps.y - 138
      );
    }

    // Combo or Underdog Badge
    if (ps.isUnderdog) {
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑 SURGE', ps.x, ps.y - 150);
    } else if (ps.combo > 1) {
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 11px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${ps.combo}x COMBO`, ps.x, ps.y - 150);
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
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : '#6366F1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#EF4444' : '#FFFFFF';
    ctx.font = 'bold 12px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const statusText = isSuddenDeath
      ? '🔥 BOILING POINT! 2X SCORE & REAGENT FEVER'
      : 'TIME REAGENT DROP • HOLD FOR CATALYST BREW';
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
    ctx.fillText('Tap [Space/Action]: Drop Reagent | Hold: Catalyst Infusion', width - 20, height - 14);

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
      roundTimer: this.roundTimer,
      players: Array.from(this.playersState.values()).map((p) => ({
        id: p.id,
        score: p.score,
        potions: p.potionsBrewed,
        combo: p.combo,
        targetReagent: p.targetReagentIdx,
        isUnderdog: p.isUnderdog,
        selectorPos: Math.round(p.selectorPos * 100)
      }))
    };
  }

  public destroy(): void {
    if (typeof window !== 'undefined' && this.keydownHandler) {
      window.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = undefined;
    }
    this.playersState.clear();
  }
}

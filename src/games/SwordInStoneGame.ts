import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type SwordThemeId = 'avalon' | 'cyber_core' | 'volcano';

interface SwordTheme {
  id: SwordThemeId;
  name: string;
  icon: string;
  bgTop: string;
  bgBottom: string;
  stoneColor: string;
  stoneTrim: string;
  floorColor: string;
  accentGlow: string;
  sparkColor: string;
}

const THEMES: Record<SwordThemeId, SwordTheme> = {
  avalon: {
    id: 'avalon',
    name: 'Sanctuary of Avalon',
    icon: '🗡️',
    bgTop: '#0D1B1E',
    bgBottom: '#1B3B35',
    stoneColor: '#455A64',
    stoneTrim: '#37474F',
    floorColor: '#1E382B',
    accentGlow: '#F59E0B',
    sparkColor: '#FDE047'
  },
  cyber_core: {
    id: 'cyber_core',
    name: 'Cyber Titan Pedestal',
    icon: '⚡',
    bgTop: '#090D16',
    bgBottom: '#020617',
    stoneColor: '#1E1B4B',
    stoneTrim: '#06B6D4',
    floorColor: '#0F172A',
    accentGlow: '#06B6D4',
    sparkColor: '#38BDF8'
  },
  volcano: {
    id: 'volcano',
    name: 'Obsidian Dragon Peak',
    icon: '🔥',
    bgTop: '#260A0A',
    bgBottom: '#180808',
    stoneColor: '#292524',
    stoneTrim: '#EF4444',
    floorColor: '#1C1917',
    accentGlow: '#F97316',
    sparkColor: '#FCA5A5'
  }
};

const THEME_ORDER: SwordThemeId[] = ['avalon', 'cyber_core', 'volcano'];

interface ArthurianKnight {
  id: PlayerId;
  x: number;
  y: number;
  pullProgress: number; // 0 to 100%
  meterPos: number; // 0 to 1
  meterDir: number;
  meterSpeed: number;
  chargeTime: number; // 0 to 1
  isCharging: boolean;
  pullAnimTimer: number;
  slipTimer: number;
  pullCount: number;
  perfectStrikes: number;
  quakeOffset: number;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  moodTimer: number;
}

export class SwordInStoneGame extends BaseGame {
  public playersState: Map<PlayerId, ArthurianKnight> = new Map();
  public currentTheme: SwordThemeId = 'avalon';

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
          this.setTheme('avalon');
        } else if (e.key === '2') {
          this.setTheme('cyber_core');
        } else if (e.key === '3') {
          this.setTheme('volcano');
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

  public setTheme(theme: SwordThemeId): void {
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
        pullProgress: 0,
        meterPos: 0.1,
        meterDir: 1,
        meterSpeed: 2.1 + Math.random() * 0.3,
        chargeTime: 0,
        isCharging: false,
        pullAnimTimer: 0,
        slipTimer: 0,
        pullCount: 0,
        perfectStrikes: 0,
        quakeOffset: 0,
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
    let maxProgress = 0;
    let minProgress = Infinity;
    this.playersState.forEach((ps) => {
      if (ps.pullProgress > maxProgress) maxProgress = ps.pullProgress;
      if (ps.pullProgress < minProgress) minProgress = ps.pullProgress;
    });
    this.playersState.forEach((ps) => {
      ps.isUnderdog = maxProgress - ps.pullProgress >= 25 && maxProgress > 0;
    });

    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.pullAnimTimer > 0) ps.pullAnimTimer -= dt;
      if (ps.slipTimer > 0) ps.slipTimer -= dt;
      if (ps.quakeOffset !== 0) ps.quakeOffset *= 0.88;

      if (ps.moodTimer > 0) {
        ps.moodTimer -= dt;
        if (ps.moodTimer <= 0) ps.currentMood = 'idle';
      }

      // Oscillate power needle
      const speedMult = isSuddenDeath ? 1.35 : 1.0;
      ps.meterPos += ps.meterDir * ps.meterSpeed * speedMult * dt;
      if (ps.meterPos >= 1.0) {
        ps.meterPos = 1.0;
        ps.meterDir = -1;
      } else if (ps.meterPos <= 0.0) {
        ps.meterPos = 0.0;
        ps.meterDir = 1;
      }

      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
      const justReleased = this.input.justReleased(p.id);

      // Hold-to-Charge Heavy Heave
      if (isAction && ps.slipTimer <= 0) {
        ps.isCharging = true;
        ps.chargeTime = Math.min(1.0, ps.chargeTime + dt * 2.2);

        if (ps.chargeTime >= 0.7 && Math.random() < 0.25) {
          this.particles.spawnSparks(ps.x, ps.y - 20, '#F59E0B', 1);
        }
      } else if (ps.isCharging || justReleased) {
        const isCharged = ps.chargeTime >= 0.7;
        ps.isCharging = false;
        ps.chargeTime = 0;
        this.handleTug(ps, isCharged, isSuddenDeath);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private handleTug(ps: ArthurianKnight, isCharged: boolean, isSuddenDeath: boolean): void {
    ps.pullCount++;
    ps.pullAnimTimer = 0.35;

    const centerDist = Math.abs(ps.meterPos - 0.5);
    const sweetHalf = ps.isUnderdog ? 0.18 : 0.12;

    if (centerDist < 0.06) {
      // CRITICAL AWAKENING TUG!
      ps.perfectStrikes++;
      const baseBoost = isCharged ? 28 : 18;
      const boost = baseBoost * (isSuddenDeath ? 1.5 : 1.0) * (ps.isUnderdog ? 1.25 : 1.0);
      ps.pullProgress = Math.min(100, ps.pullProgress + boost);
      ps.currentMood = 'triumph';
      ps.moodTimer = 1.8;

      this.audio.playScore();
      this.particles.shake(isCharged ? 7 : 4);
      this.particles.spawnExplosion(ps.x, ps.y - 30, '#F59E0B', isCharged ? 28 : 20);

      if (isCharged) {
        this.triggerStonequake(ps.id);
      }
    } else if (centerDist < sweetHalf) {
      // GOOD TUG
      const baseBoost = isCharged ? 14 : 9;
      const boost = baseBoost * (isSuddenDeath ? 1.5 : 1.0);
      ps.pullProgress = Math.min(100, ps.pullProgress + boost);
      ps.currentMood = 'happy';
      ps.moodTimer = 1.2;

      this.audio.playTap();
      this.particles.spawnSparks(ps.x, ps.y - 20, '#38BDF8', 10);
    } else {
      // SLIP / LOSS OF TRACTION!
      if (!ps.isUnderdog) {
        ps.slipTimer = 0.45;
        ps.pullProgress = Math.max(0, ps.pullProgress - 5);
      }
      ps.currentMood = 'shocked';
      ps.moodTimer = 1.2;

      this.audio.playBounce();
      this.particles.spawnSparks(ps.x, ps.y - 10, '#94A3B8', 8);
    }

    if (ps.pullProgress >= 100) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private triggerStonequake(leaderId: PlayerId): void {
    for (const p of this.getActivePlayers()) {
      if (p.id === leaderId) continue;
      const ps = this.playersState.get(p.id);
      if (ps) {
        ps.quakeOffset = (Math.random() - 0.5) * 10;
        ps.meterPos = Math.max(0, Math.min(1, ps.meterPos + (Math.random() - 0.5) * 0.15));
        this.particles.spawnSparks(ps.x, ps.y + 40, '#EF4444', 8);
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
    if (!ps || ps.slipTimer > 0) return;

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const centerDist = Math.abs(ps.meterPos - 0.5);
    let shouldTap = false;

    if (difficulty === 'bot_easy') {
      if (centerDist < 0.22 || Math.random() < 0.20) {
        shouldTap = true;
      }
    } else if (difficulty === 'bot_hard') {
      if (centerDist < 0.05) {
        shouldTap = true;
      }
    } else {
      if (centerDist < 0.11) {
        shouldTap = true;
      }
    }

    if (shouldTap) {
      this.input.setBotInput(botId, true, 0, 0, true);
    }

    const interval =
      difficulty === 'bot_easy'
        ? 0.38 + Math.random() * 0.20
        : difficulty === 'bot_normal'
        ? 0.18 + Math.random() * 0.10
        : 0.06 + Math.random() * 0.04;
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
        score: Math.floor(ps?.pullProgress || 0),
        perfect: ps?.perfectStrikes || 0
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
      ? `Player ${winnerId + 1} drew Excalibur from the Stone (${topScore}%) and was crowned High King!`
      : 'None were worthy to draw Excalibur from the sacred rock!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastHeight = height;
    const theme = THEMES[this.currentTheme];

    // 1. Ancient Shrine Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgTop);
    bgGrad.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Stone shrine floor
    ctx.fillStyle = theme.floorColor;
    ctx.fillRect(0, height * 0.72, width, height * 0.28);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, height * 0.72);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // 2. Render Player Shrines & Knights
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderShrine(ctx, ps, p, theme);
    }

    // 3. Safe UI & Theme Pill
    this.renderSafeUI(ctx, width, height);
  }

  private renderShrine(
    ctx: CanvasRenderingContext2D,
    ps: ArthurianKnight,
    p: PlayerConfig,
    theme: SwordTheme
  ): void {
    ctx.save();
    const isBot = p.type !== 'human';

    ctx.translate(ps.x + ps.quakeOffset, ps.y);

    // Ancient Boulder Stone
    const boulderW = 110;
    const boulderH = 65;
    ctx.fillStyle = theme.stoneColor;
    ctx.beginPath();
    ctx.ellipse(0, 40, boulderW / 2, boulderH / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.stoneTrim;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Glowing Runes on Stone
    const runeGlow = ps.pullProgress / 100;
    ctx.strokeStyle = `rgba(245, 158, 11, ${0.2 + runeGlow * 0.8})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-25, 35);
    ctx.lineTo(-15, 45);
    ctx.lineTo(-20, 55);
    ctx.moveTo(25, 35);
    ctx.lineTo(15, 45);
    ctx.lineTo(20, 55);
    ctx.stroke();

    // Excalibur Blade (Lifting upwards from stone)
    const liftOffset = (ps.pullProgress / 100) * 45;
    const swordBaseY = 20 - liftOffset;

    // Glowing Blade
    ctx.fillStyle = '#ECEFF1';
    ctx.fillRect(-4, swordBaseY - 60, 8, 60);

    // Golden Crossguard
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(-20, swordBaseY - 65, 40, 8);

    // Leather Hilt
    ctx.fillStyle = '#78350F';
    ctx.fillRect(-3, swordBaseY - 85, 6, 20);

    // Golden Pommel
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(0, swordBaseY - 88, 6, 0, Math.PI * 2);
    ctx.fill();

    // Knight Mascot (Standing beside the stone heaving Excalibur)
    ctx.save();
    ctx.translate(-28, swordBaseY - 55);
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

    // Kinetic Power Charge Ring around hilt
    if (ps.chargeTime > 0) {
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2 + ps.chargeTime * 3;
      ctx.beginPath();
      ctx.arc(0, swordBaseY - 75, 16 + ps.chargeTime * 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Oscillating Power Meter (Above at y: -128)
    const meterW = 120;
    const meterH = 14;
    const meterY = -128;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(-meterW / 2, meterY, meterW, meterH, 4);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Golden Sweet Spot in Center
    const sweetHalf = ps.isUnderdog ? 0.18 : 0.12;
    const sweetW = meterW * (sweetHalf * 2);
    ctx.fillStyle = theme.accentGlow;
    ctx.fillRect(-sweetW / 2, meterY, sweetW, meterH);

    // Bullseye Center Line
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-3, meterY, 6, meterH);

    // Moving Needle Indicator
    const needleX = -meterW / 2 + ps.meterPos * meterW;
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(needleX - 3, meterY - 4, 6, meterH + 8);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(needleX - 3, meterY - 4, 6, meterH + 8);

    // Pull Progress Fill Bar (Right side: x: 62)
    const progH = 80;
    const progW = 10;
    const progX = 62;
    const progY = -70;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fillRect(progX, progY, progW, progH);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(progX, progY, progW, progH);

    const filledH = (ps.pullProgress / 100) * progH;
    ctx.fillStyle = theme.sparkColor;
    ctx.fillRect(progX + 1, progY + progH - filledH, progW - 2, filledH);

    if (ps.slipTimer > 0) {
      ctx.fillStyle = '#EF4444';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SLIPPED!', 0, meterY - 10);
    } else if (ps.isUnderdog) {
      ctx.fillStyle = '#F59E0B';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑 SURGE', 0, meterY - 10);
    } else if (ps.perfectStrikes > 0) {
      ctx.fillStyle = '#38BDF8';
      ctx.font = 'bold 11px "Chakra Petch", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${ps.perfectStrikes} PERFECT`, 0, meterY - 10);
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
      ? '🔥 PROPHECY SURGE! 2X HEAVE POWER'
      : 'TIME TUG IN GOLDEN APEX • HOLD TO CHARGE HEAVE';
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
      ctx.fillText(`${Math.floor(ps?.pullProgress || 0)}% drawn`, cardX + 44, cardY + 26);
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
    ctx.strokeStyle = theme.accentGlow;
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
    ctx.fillText('Hold [Space/Action]: Charge Heave | Release: Power Tug', width - 20, height - 14);

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
        pullProgress: Math.round(p.pullProgress),
        perfectStrikes: p.perfectStrikes,
        isUnderdog: p.isUnderdog,
        meterPos: Math.round(p.meterPos * 100)
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

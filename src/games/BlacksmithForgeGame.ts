import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type ForgeThemeId = 'royal' | 'cyber' | 'volcano';

interface ForgeTheme {
  id: ForgeThemeId;
  name: string;
  icon: string;
  bgTop: string;
  bgBottom: string;
  hearthGlow: string;
  anvilSteel: string;
  bladeHeat: string;
  accentColor: string;
  sparkColor: string;
}

const THEMES: Record<ForgeThemeId, ForgeTheme> = {
  royal: {
    id: 'royal',
    name: 'Royal Armoury Forge',
    icon: '🏰',
    bgTop: '#1C1917',
    bgBottom: '#451A03',
    hearthGlow: '#F59E0B',
    anvilSteel: '#475569',
    bladeHeat: '#F97316',
    accentColor: '#F59E0B',
    sparkColor: '#FDE047'
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Plasma Anvil',
    icon: '⚡',
    bgTop: '#0B0F24',
    bgBottom: '#030712',
    hearthGlow: '#06B6D4',
    anvilSteel: '#1E1B4B',
    bladeHeat: '#38BDF8',
    accentColor: '#06B6D4',
    sparkColor: '#67E8F9'
  },
  volcano: {
    id: 'volcano',
    name: 'Magma Core Smithy',
    icon: '🔥',
    bgTop: '#260A0A',
    bgBottom: '#180808',
    hearthGlow: '#EF4444',
    anvilSteel: '#292524',
    bladeHeat: '#DC2626',
    accentColor: '#EA580C',
    sparkColor: '#FCA5A5'
  }
};

const THEME_ORDER: ForgeThemeId[] = ['royal', 'cyber', 'volcano'];

interface ForgePlayer {
  id: PlayerId;
  anvilX: number;
  anvilY: number;
  indicatorPos: number; // 0 to 1
  indicatorSpeed: number;
  indicatorDir: number;
  chargeTime: number; // 0 to 1
  isCharging: boolean;
  score: number;
  combo: number;
  swordsCompleted: number;
  swordProgress: number; // 0 to 100
  hammerSwingAnim: number;
  sparksTimer: number;
  cooldown: number;
  rattleOffset: number;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  moodTimer: number;
}

export class BlacksmithForgeGame extends BaseGame {
  public playersState: Map<PlayerId, ForgePlayer> = new Map();
  public currentTheme: ForgeThemeId = 'royal';

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
          this.setTheme('royal');
        } else if (e.key === '2') {
          this.setTheme('cyber');
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

  public setTheme(theme: ForgeThemeId): void {
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnSparks(105, 556, THEMES[theme].accentColor, 16);
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
    const spacing = width / (active.length + 1);

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        anvilX: spacing * (idx + 1),
        anvilY: height * 0.56,
        indicatorPos: 0.1,
        indicatorSpeed: 1.3 + Math.random() * 0.3,
        indicatorDir: 1,
        chargeTime: 0,
        isCharging: false,
        score: 0,
        combo: 0,
        swordsCompleted: 0,
        swordProgress: 0,
        hammerSwingAnim: 0,
        sparksTimer: 0,
        cooldown: 0,
        rattleOffset: 0,
        isUnderdog: false,
        currentMood: 'idle',
        moodTimer: 2.0
      });
      this.botReactionTimers.set(p.id, 0.25 + Math.random() * 0.2);
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
    });

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Update players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.cooldown > 0) ps.cooldown -= dt;
      if (ps.hammerSwingAnim > 0) {
        ps.hammerSwingAnim = Math.max(0, ps.hammerSwingAnim - dt * 5.5);
      }
      if (ps.sparksTimer > 0) ps.sparksTimer -= dt;
      if (ps.rattleOffset !== 0) ps.rattleOffset *= 0.9;

      if (ps.moodTimer > 0) {
        ps.moodTimer -= dt;
        if (ps.moodTimer <= 0) ps.currentMood = 'idle';
      }

      // Oscillate rhythm indicator
      const speedMult = isSuddenDeath ? 1.4 : 1.0;
      ps.indicatorPos += ps.indicatorDir * ps.indicatorSpeed * speedMult * dt;
      if (ps.indicatorPos >= 1.0) {
        ps.indicatorPos = 1.0;
        ps.indicatorDir = -1;
      } else if (ps.indicatorPos <= 0.0) {
        ps.indicatorPos = 0.0;
        ps.indicatorDir = 1;
      }

      const isAction = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
      const justReleased = this.input.justReleased(p.id);

      // Hold-to-Charge Sledgehammer Strike
      if (isAction && ps.cooldown <= 0) {
        ps.isCharging = true;
        ps.chargeTime = Math.min(1.0, ps.chargeTime + dt * 2.2);

        if (ps.chargeTime >= 0.7 && Math.random() < 0.25) {
          this.particles.spawnSparks(ps.anvilX, ps.anvilY - 24, '#F59E0B', 1);
        }
      } else if (ps.isCharging || justReleased) {
        // Unleash hammer strike!
        const isCharged = ps.chargeTime >= 0.7;
        ps.isCharging = false;
        ps.chargeTime = 0;
        ps.cooldown = 0.20;
        ps.hammerSwingAnim = 1.0;

        // Sweet spot is centered at 0.5
        const sweetHalf = ps.isUnderdog ? 0.16 : 0.11;
        const distFromCenter = Math.abs(ps.indicatorPos - 0.5);

        if (distFromCenter < 0.06) {
          // PERFECT BULLSEYE STRIKE!
          ps.combo += 1;
          const comboMult = Math.min(4, 1 + Math.floor(ps.combo / 2));
          const basePts = isCharged ? 200 : 120;
          const pts = basePts * comboMult * (isSuddenDeath ? 2 : 1);
          ps.score += pts;
          ps.swordProgress += isCharged ? 35 : 25;
          ps.currentMood = 'happy';
          ps.moodTimer = 1.6;

          this.audio.playScore();
          this.particles.shake(isCharged ? 6 : 4);
          this.particles.spawnExplosion(ps.anvilX, ps.anvilY - 14, '#F59E0B', isCharged ? 28 : 20);

          // Trigger shockwave on charged perfect strike
          if (isCharged) {
            this.triggerSmithyShockwave(ps.id);
          }

          if (ps.swordProgress >= 100) {
            // Masterwork Sword completed!
            ps.swordProgress = 0;
            ps.swordsCompleted += 1;
            ps.score += 450;
            ps.currentMood = 'triumph';
            ps.moodTimer = 2.2;

            this.audio.playFanfare();
            this.particles.shake(8);
            this.particles.spawnSparks(ps.anvilX, ps.anvilY - 30, '#38BDF8', 30);
          }
        } else if (distFromCenter < sweetHalf) {
          // GOOD STRIKE
          const pts = (isCharged ? 90 : 60) * (isSuddenDeath ? 2 : 1);
          ps.score += pts;
          ps.swordProgress += isCharged ? 20 : 15;
          this.audio.playTap();
          this.particles.spawnSparks(ps.anvilX, ps.anvilY - 14, '#FBBF24', 10);
        } else {
          // CLANG / MISS!
          if (!ps.isUnderdog) {
            ps.combo = 0;
          }
          ps.currentMood = 'shocked';
          ps.moodTimer = 1.0;
          this.audio.playBounce();
          this.particles.spawnSparks(ps.anvilX, ps.anvilY - 14, '#94A3B8', 8);
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  private triggerSmithyShockwave(leaderId: PlayerId): void {
    for (const p of this.getActivePlayers()) {
      if (p.id === leaderId) continue;
      const ps = this.playersState.get(p.id);
      if (ps) {
        ps.rattleOffset = (Math.random() - 0.5) * 8;
        ps.indicatorPos = Math.max(0, Math.min(1, ps.indicatorPos + (Math.random() - 0.5) * 0.12));
        this.particles.spawnSparks(ps.anvilX, ps.anvilY, '#EF4444', 8);
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
    const bot = this.playersState.get(botId);
    if (!bot) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;

    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const interval =
      difficulty === 'bot_easy'
        ? 0.35 + Math.random() * 0.20
        : difficulty === 'bot_normal'
        ? 0.15 + Math.random() * 0.10
        : 0.05 + Math.random() * 0.04;
    this.botReactionTimers.set(botId, interval);

    const distFromCenter = Math.abs(bot.indicatorPos - 0.5);
    const targetDist =
      difficulty === 'bot_hard' ? 0.04 : difficulty === 'bot_normal' ? 0.08 : 0.14;

    let action = false;
    if (distFromCenter <= targetDist && bot.cooldown <= 0) {
      action = true; // Strike!
    }

    this.input.setBotInput(botId, action, 0, 0, action);
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
        swords: ps?.swordsCompleted || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topSwords = scores[0]?.swords || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} forged ${topSwords} masterwork royal blades!`
      : 'All forge hammers rang with equal chivalric honor!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastHeight = height;
    const theme = THEMES[this.currentTheme];

    // 1. Forge Stone Wall & Hearth Glow
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgTop);
    bgGrad.addColorStop(0.65, theme.bgBottom);
    bgGrad.addColorStop(1, '#000000');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Stone forge brick outlines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let by = 0; by < height; by += 40) {
      ctx.beginPath();
      ctx.moveTo(0, by);
      ctx.lineTo(width, by);
      ctx.stroke();
    }

    // 2. Render Anvils, Blacksmiths, and Meters
    for (const ps of this.playersState.values()) {
      const cfg = this.players.find((x) => x.id === ps.id);
      const color = cfg ? cfg.color : '#FFFFFF';
      const isBot = cfg ? cfg.type !== 'human' : false;

      ctx.save();
      ctx.translate(ps.anvilX + ps.rattleOffset, ps.anvilY);

      // Shadow beneath anvil
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.ellipse(0, 42, 38, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      // Heavy Iron Anvil
      ctx.fillStyle = theme.anvilSteel;
      ctx.beginPath();
      ctx.moveTo(-36, 0);
      ctx.lineTo(36, 0);
      ctx.lineTo(24, 38);
      ctx.lineTo(-24, 38);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Glowing Hot Steel Blade atop anvil
      const heatProgress = ps.swordProgress / 100;
      ctx.fillStyle = heatProgress > 0.6 ? '#F59E0B' : theme.bladeHeat;
      ctx.fillRect(-22, -8, 44, 8);

      // Sword progress glow outline
      ctx.strokeStyle = theme.sparkColor;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-22, -8, 44 * heatProgress, 8);

      // Blacksmith Mascot (Standing behind anvil: x: -28, y: -26)
      ctx.save();
      ctx.translate(-26, -26);
      drawCharacter(
        ctx,
        0,
        0,
        15,
        ps.id,
        isBot,
        ps.currentMood,
        ps.chargeTime * 3,
        undefined
      );
      ctx.restore();

      // Sledgehammer Swing & Glow
      ctx.save();
      ctx.translate(24, -14);
      const swingAngle = ps.hammerSwingAnim > 0 ? -Math.PI / 3 : 0.25;
      ctx.rotate(swingAngle);

      // Sledgehammer handle
      ctx.fillStyle = '#78350F';
      ctx.fillRect(-3, -32, 6, 32);

      // Sledgehammer Head
      ctx.fillStyle = ps.isUnderdog ? '#F59E0B' : color;
      ctx.fillRect(-14, -42, 28, 14);

      // Kinetic charge aura on hammer
      if (ps.chargeTime > 0) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2 + ps.chargeTime * 3;
        ctx.strokeRect(-14, -42, 28, 14);
      }

      ctx.restore();

      // Rhythm Meter Bar (Above anvil at y: -80)
      const barW = 120;
      const barH = 14;
      const barX = -barW / 2;
      const barY = -80;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 4);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Sweet Spot Zone in Center
      const sweetHalf = ps.isUnderdog ? 0.16 : 0.11;
      const sweetW = barW * (sweetHalf * 2);
      ctx.fillStyle = theme.accentColor;
      ctx.fillRect(-sweetW / 2, barY, sweetW, barH);

      // Perfect Bullseye Line (Center 6%)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-3, barY, 6, barH);

      // Oscillating Indicator Bar
      const indX = barX + ps.indicatorPos * barW;
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(indX - 3, barY - 4, 6, barH + 8);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.strokeRect(indX - 3, barY - 4, 6, barH + 8);

      // Sword Progress Fill Bar (Beneath anvil at y: 52)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.fillRect(-32, 52, 64, 7);
      ctx.fillStyle = theme.sparkColor;
      ctx.fillRect(-32, 52, (ps.swordProgress / 100) * 64, 7);

      // Combo or Underdog text
      if (ps.isUnderdog) {
        ctx.fillStyle = '#F59E0B';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👑 SURGE', 0, barY - 10);
      } else if (ps.combo >= 2) {
        ctx.fillStyle = '#FBBF24';
        ctx.font = 'bold 12px "Chakra Petch", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${ps.combo}x COMBO!`, 0, barY - 10);
      }

      ctx.restore();
    }

    // 3. Safe UI & Theme Pill
    this.renderSafeUI(ctx, width, height);
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
      ? '🔥 HYPER HEAT WAVE! 2X SCORE & SPEED SURGE'
      : 'TIME STRIKE IN SWEET SPOT • HOLD FOR CHARGE';
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
    ctx.strokeStyle = theme.accentColor;
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
    ctx.fillText('Hold [Space/Action]: Charge Sledgehammer | Release: Strike', width - 20, height - 14);

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
        combo: p.combo,
        swords: p.swordsCompleted,
        swordProgress: p.swordProgress,
        isUnderdog: p.isUnderdog,
        indicatorPos: Math.round(p.indicatorPos * 100)
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

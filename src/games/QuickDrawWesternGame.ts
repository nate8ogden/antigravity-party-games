import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';
import { AchievementManager } from '../core/AchievementManager';
import { CharacterMood } from '../core/CharacterRenderer';

export interface WesternTheme {
  name: string;
  skyTop: string;
  skyMid: string;
  skyBot: string;
  sunColorA: string;
  sunColorB: string;
  mesaColorA: string;
  mesaColorB: string;
  groundColorA: string;
  groundColorB: string;
  badgeBorder: string;
}

export const WESTERN_THEMES: WesternTheme[] = [
  {
    name: 'High Noon Sunset 🌅',
    skyTop: '#4A0404',
    skyMid: '#EA580C',
    skyBot: '#FBBF24',
    sunColorA: '#FEF08A',
    sunColorB: '#F59E0B',
    mesaColorA: '#7C2D12',
    mesaColorB: '#451A03',
    groundColorA: '#78350F',
    groundColorB: '#291205',
    badgeBorder: '#F59E0B'
  },
  {
    name: 'Ghost Town Midnight 🌌',
    skyTop: '#0B0F19',
    skyMid: '#1E1B4B',
    skyBot: '#312E81',
    sunColorA: '#E0E7FF',
    sunColorB: '#818CF8',
    mesaColorA: '#1E293B',
    mesaColorB: '#0F172A',
    groundColorA: '#1E1E24',
    groundColorB: '#0A0A0F',
    badgeBorder: '#818CF8'
  },
  {
    name: 'Dust Bowl Sirocco 🏜️',
    skyTop: '#3D200A',
    skyMid: '#854D0E',
    skyBot: '#D97706',
    sunColorA: '#FEF3C7',
    sunColorB: '#D97706',
    mesaColorA: '#582A0C',
    mesaColorB: '#351605',
    groundColorA: '#653110',
    groundColorB: '#240F04',
    badgeBorder: '#D97706'
  }
];

interface Gunslinger {
  id: PlayerId;
  x: number;
  y: number;
  score: number;
  reactionTime: number | null; // in ms
  misfired: boolean;
  shotFired: boolean;
}

interface Tumbleweed {
  x: number;
  y: number;
  vx: number;
  rot: number;
  rotSpeed: number;
  radius: number;
  bounceOffset: number;
}

export class QuickDrawWesternGame extends BaseGame {
  public static readonly THEMES = WESTERN_THEMES;
  private currentThemeIndex: number = 0;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private pointerdownListener: ((e: PointerEvent) => void) | null = null;

  private slingers: Map<PlayerId, Gunslinger> = new Map();
  private tumbleweeds: Tumbleweed[] = [];
  private heartbeatTimer: number = 0;
  private dustSpawnTimer: number = 0;
  private state: 'WAITING' | 'DRAW_SIGNAL' | 'ROUND_RESOLVED' = 'WAITING';
  private drawSignalTime: number = 0;
  private signalTimestamp: number = 0;
  private roundWinnerId: PlayerId | null = null;
  private interRoundTimer: number = 0;
  private currentDuelRound: number = 1;
  private targetWins: number = 3;
  private botTargetDelays: Map<PlayerId, number> = new Map();
  private botEarlyMisfires: Map<PlayerId, number> = new Map();

  // Decoy bait mechanic
  private decoyWord: string | null = null;
  private decoyTimer: number = 0;
  private decoyTriggered: boolean = false;

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  public destroy(): void {
    this.removeListeners();
    super.destroy();
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isFinished) return;
      if (e.code === 'KeyT') {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % WESTERN_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.pointerdownListener = (e: PointerEvent) => {
      if (this.isFinished) return;
      const canvas = e.target as HTMLCanvasElement;
      if (!canvas || !canvas.getBoundingClientRect) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // Theme pill is at x: 20, y: canvas.height - 44, w: 180, h: 32
      if (clickX >= 20 && clickX <= 200 && clickY >= canvas.height - 44 && clickY <= canvas.height - 12) {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % WESTERN_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('pointerdown', this.pointerdownListener);
  }

  private removeListeners(): void {
    if (typeof window === 'undefined') return;
    if (this.keydownListener) {
      window.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
    if (this.pointerdownListener) {
      window.removeEventListener('pointerdown', this.pointerdownListener);
      this.pointerdownListener = null;
    }
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 75;
    this.isFinished = false;
    this.slingers.clear();
    this.tumbleweeds = [];
    this.heartbeatTimer = 0;
    this.dustSpawnTimer = 0;
    this.botTargetDelays.clear();
    this.botEarlyMisfires.clear();
    this.currentDuelRound = 1;

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    active.forEach((p, idx) => {
      this.slingers.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: height - 120,
        score: 0,
        reactionTime: null,
        misfired: false,
        shotFired: false
      });
    });

    this.startNewDuelRound();
  }

  private startNewDuelRound() {
    this.state = 'WAITING';
    this.roundWinnerId = null;
    this.interRoundTimer = 0;
    this.botTargetDelays.clear();
    this.botEarlyMisfires.clear();
    this.decoyWord = null;
    this.decoyTimer = 0;
    this.decoyTriggered = false;

    // Unpredictable delay between 2.0s and 4.8s
    this.drawSignalTime = 2.0 + Math.random() * 2.8;

    for (const s of this.slingers.values()) {
      s.reactionTime = null;
      s.misfired = false;
      s.shotFired = false;
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Update Tumbleweeds
    for (let i = this.tumbleweeds.length - 1; i >= 0; i--) {
      const tw = this.tumbleweeds[i];
      tw.x += tw.vx * dt;
      tw.rot += tw.rotSpeed * dt;
      tw.bounceOffset = Math.abs(Math.sin(tw.x * 0.04)) * 9;
      if (tw.x > width + 60) {
        this.tumbleweeds.splice(i, 1);
      }
    }
    if (Math.random() < 0.015 && this.tumbleweeds.length < 2) {
      this.tumbleweeds.push({
        x: -40,
        y: height - 110 + Math.random() * 25,
        vx: 85 + Math.random() * 55,
        rot: 0,
        rotSpeed: 3 + Math.random() * 3,
        radius: 12 + Math.random() * 6,
        bounceOffset: 0
      });
    }

    // Atmospheric high-noon dust
    this.dustSpawnTimer -= dt;
    if (this.dustSpawnTimer <= 0) {
      this.dustSpawnTimer = 0.25;
      this.particles.spawnDust(Math.random() * width, height - 120 + Math.random() * 40, 2);
    }

    // Calculate leader score for Underdog Dead-Eye Surge
    let maxWins = 0;
    for (const sl of this.slingers.values()) {
      if (sl.score > maxWins) maxWins = sl.score;
    }

    if (this.state === 'WAITING') {
      this.drawSignalTime -= dt;

      // Decoy Bait Mind-Games: 40% chance to flash a false word
      if (!this.decoyTriggered && this.drawSignalTime <= 1.2 && this.drawSignalTime > 0.55 && Math.random() < 0.35) {
        this.decoyTriggered = true;
        this.decoyWord = ['DRINK!', 'DANCE!', 'DROP!', 'DODGE!'][Math.floor(Math.random() * 4)];
        this.decoyTimer = 0.55;
        this.audio.playTap();
      }

      if (this.decoyTimer > 0) {
        this.decoyTimer -= dt;
        if (this.decoyTimer <= 0) {
          this.decoyWord = null;
        }
      }

      // Tension heartbeat audio
      this.heartbeatTimer -= dt;
      if (this.heartbeatTimer <= 0) {
        this.heartbeatTimer = Math.max(0.35, this.drawSignalTime * 0.35);
        this.audio.playTap();
      }

      // Check for early trigger false starts
      for (const s of this.slingers.values()) {
        const justPressed = this.input.justPressed(s.id);
        if (justPressed && !s.misfired) {
          s.misfired = true;
          this.audio.playExplosion();
          this.particles.showFloatingText(this.decoyWord ? 'BAITED! FOUL!' : 'FOUL! EARLY DRAW!', s.x, s.y - 40, '#EF4444', 20);
        }
      }

      if (this.drawSignalTime <= 0) {
        // DRAW SIGNAL FIRES!
        this.state = 'DRAW_SIGNAL';
        this.decoyWord = null;
        this.signalTimestamp = performance.now();
        this.audio.playLaser();
        this.particles.addTrauma(0.2);
      }
    } else if (this.state === 'DRAW_SIGNAL') {
      // Waiting for fastest valid tap
      const now = performance.now();

      for (const s of this.slingers.values()) {
        if (s.misfired || s.shotFired) continue;

        const justPressed = this.input.justPressed(s.id);
        if (justPressed) {
          let latency = Math.round(now - this.signalTimestamp);
          const isUnderdog = maxWins >= 2 && s.score <= maxWins - 2;
          if (isUnderdog) {
            latency = Math.max(145, latency - 28); // Dead-Eye focus perk!
          }

          s.reactionTime = latency;
          s.shotFired = true;
          this.audio.playFanfare();
          this.particles.spawnSparks(s.x, s.y - 20, '#F59E0B', 15);

          // First valid shot wins this duel round!
          if (this.roundWinnerId === null) {
            this.roundWinnerId = s.id;
            s.score++;
            this.state = 'ROUND_RESOLVED';
            this.interRoundTimer = 2.2;
            this.audio.playHitStopThud();
            this.particles.addTrauma(0.25);
            this.particles.showFloatingText(`${latency}ms! WINNER!`, s.x, s.y - 50, '#10B981', 24);

            if (s.id === 0 && latency < 220) {
              AchievementManager.getInstance().unlock('speed_demon');
            }

            if (s.score >= this.targetWins) {
              this.isFinished = true;
            }
          }
          break;
        }
      }
    } else if (this.state === 'ROUND_RESOLVED') {
      this.interRoundTimer -= dt;
      if (this.interRoundTimer <= 0) {
        if (!this.isFinished) {
          this.currentDuelRound++;
          this.startNewDuelRound();
        }
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const s = this.slingers.get(botId);
    if (!s || s.misfired || s.shotFired) return;

    if (this.state === 'DRAW_SIGNAL') {
      const elapsedMs = performance.now() - this.signalTimestamp;
      if (!this.botTargetDelays.has(botId)) {
        const delay = difficulty === 'bot_hard'
          ? 210 + Math.random() * 40
          : difficulty === 'bot_normal'
          ? 310 + Math.random() * 80
          : 480 + Math.random() * 160;
        this.botTargetDelays.set(botId, delay);
      }

      const targetDelay = this.botTargetDelays.get(botId) || 350;
      if (elapsedMs >= targetDelay) {
        this.input.setBotInput(botId, true, 0, 0, false);
      }
    } else if (this.state === 'WAITING') {
      // If decoy word is flashing, Easy and Normal bots have a chance to fall for the bait!
      if (this.decoyWord) {
        const baitChance = difficulty === 'bot_easy' ? 0.35 : difficulty === 'bot_normal' ? 0.18 : 0.04;
        if (Math.random() < baitChance * dt * 4) {
          this.input.setBotInput(botId, true, 0, 0, false);
          return;
        }
      }

      // Normal misfire chance on easy
      if (difficulty === 'bot_easy') {
        if (!this.botEarlyMisfires.has(botId)) {
          const willMisfire = Math.random() < 0.15;
          const misfireTime = willMisfire ? 0.6 + Math.random() * 1.2 : -1;
          this.botEarlyMisfires.set(botId, misfireTime);
        }
        const misfireAt = this.botEarlyMisfires.get(botId) || -1;
        if (misfireAt > 0 && this.drawSignalTime <= misfireAt) {
          this.input.setBotInput(botId, true, 0, 0, false);
        }
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const sorted = Array.from(this.slingers.values()).sort((a, b) => b.score - a.score);
    const winnerId = sorted.length > 0 ? sorted[0].id : null;

    if (winnerId === 0 && sorted.length > 1 && sorted[1].score === 0) {
      AchievementManager.getInstance().unlock('perfectionist');
    }

    return {
      winnerId,
      rankings: sorted.map((s, idx) => ({
        playerId: s.id,
        score: s.score,
        place: idx + 1
      })),
      mvpHighlight: winnerId !== null ? `${this.players[winnerId].name} IS THE FASTEST GUN IN THE WEST!` : 'DUEL DRAW!'
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();

    const theme = WESTERN_THEMES[this.currentThemeIndex];

    // 1. Dynamic Western Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height * 0.75);
    skyGrad.addColorStop(0, theme.skyTop);
    skyGrad.addColorStop(0.5, theme.skyMid);
    skyGrad.addColorStop(1, theme.skyBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Low Sun / Moon on Horizon
    const sunX = width / 2;
    const sunY = height * 0.62;
    const sunRad = 70;
    const sunGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, sunRad);
    sunGrad.addColorStop(0, theme.sunColorA);
    sunGrad.addColorStop(0.5, theme.sunColorB);
    sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunRad, 0, Math.PI * 2);
    ctx.fill();

    // 3. Layered Canyon Mesas and Buttes
    ctx.fillStyle = theme.mesaColorA;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.68);
    ctx.lineTo(width * 0.12, height * 0.68);
    ctx.lineTo(width * 0.15, height * 0.58);
    ctx.lineTo(width * 0.28, height * 0.58);
    ctx.lineTo(width * 0.31, height * 0.68);
    ctx.lineTo(width * 0.68, height * 0.68);
    ctx.lineTo(width * 0.72, height * 0.55);
    ctx.lineTo(width * 0.88, height * 0.55);
    ctx.lineTo(width * 0.92, height * 0.68);
    ctx.lineTo(width, height * 0.68);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // Midground mesas
    ctx.fillStyle = theme.mesaColorB;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.72);
    ctx.lineTo(width * 0.08, height * 0.72);
    ctx.lineTo(width * 0.10, height * 0.64);
    ctx.lineTo(width * 0.22, height * 0.64);
    ctx.lineTo(width * 0.24, height * 0.72);
    ctx.lineTo(width * 0.78, height * 0.72);
    ctx.lineTo(width * 0.82, height * 0.62);
    ctx.lineTo(width * 0.95, height * 0.62);
    ctx.lineTo(width, height * 0.72);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    // 4. Dusty Frontier Street Ground
    const groundY = height - 130;
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, height);
    groundGrad.addColorStop(0, theme.groundColorA);
    groundGrad.addColorStop(1, theme.groundColorB);
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, width, height - groundY);

    // Wagon wheel ruts in the dirt road
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, height - 70);
    ctx.lineTo(width, height - 70);
    ctx.moveTo(0, height - 45);
    ctx.lineTo(width, height - 45);
    ctx.stroke();

    // 5. Frontier Town Storefronts on Left and Right Edges
    ctx.fillStyle = '#26160E';
    ctx.fillRect(0, groundY - 140, 110, 140);
    ctx.fillRect(0, groundY - 150, 118, 12);
    ctx.fillStyle = '#422415';
    ctx.fillRect(0, groundY - 10, 125, 12);
    ctx.fillStyle = '#5A321E';
    ctx.fillRect(105, groundY - 130, 8, 120);

    ctx.fillStyle = '#26160E';
    ctx.fillRect(width - 110, groundY - 150, 110, 150);
    ctx.fillRect(width - 115, groundY - 162, 115, 14);
    ctx.fillStyle = '#422415';
    ctx.fillRect(width - 125, groundY - 10, 125, 12);
    ctx.fillStyle = '#5A321E';
    ctx.fillRect(width - 113, groundY - 140, 8, 130);

    // Saguaro Cacti Silhouettes
    ctx.fillStyle = '#1C1917';
    const c1x = 145;
    const c1y = groundY + 10;
    ctx.fillRect(c1x, c1y - 65, 8, 65);
    ctx.fillRect(c1x - 14, c1y - 48, 14, 6);
    ctx.fillRect(c1x - 14, c1y - 62, 6, 20);
    ctx.fillRect(c1x + 8, c1y - 38, 14, 6);
    ctx.fillRect(c1x + 16, c1y - 52, 6, 20);

    const c2x = width - 155;
    const c2y = groundY + 15;
    ctx.fillRect(c2x, c2y - 55, 8, 55);
    ctx.fillRect(c2x - 12, c2y - 40, 12, 5);
    ctx.fillRect(c2x - 12, c2y - 52, 5, 16);

    // Draw Procedural Tumbleweeds
    for (const tw of this.tumbleweeds) {
      ctx.save();
      ctx.translate(tw.x, tw.y - tw.bounceOffset);
      ctx.rotate(tw.rot);
      ctx.strokeStyle = '#92400E';
      ctx.lineWidth = 1.6;
      ctx.fillStyle = 'rgba(180, 83, 9, 0.2)';
      ctx.beginPath();
      ctx.arc(0, 0, tw.radius, 0, Math.PI * 2);
      ctx.fill();
      for (let b = 0; b < 6; b++) {
        const ang = (b * Math.PI) / 3;
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * (tw.radius * 0.4), Math.sin(ang) * (tw.radius * 0.4), tw.radius * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 6. Duelists (Gunslingers facing each other)
    let maxWins = 0;
    for (const sl of this.slingers.values()) {
      if (sl.score > maxWins) maxWins = sl.score;
    }

    const slingerList = Array.from(this.slingers.values());
    for (let i = 0; i < slingerList.length; i++) {
      const s = slingerList[i];
      const pColor = this.players[s.id]?.color || '#FFFFFF';
      const facing = s.x < width / 2 ? 1 : -1;
      const isUnderdog = maxWins >= 2 && s.score <= maxWins - 2;

      // Mood calculation
      const mood: CharacterMood = s.misfired
        ? 'shocked'
        : this.state === 'ROUND_RESOLVED' && this.roundWinnerId === s.id
        ? 'triumph'
        : this.state === 'ROUND_RESOLVED' && this.roundWinnerId !== null
        ? 'shocked'
        : 'focused';

      // DUELIST BODY & PROPS
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.scale(facing, 1);

      // Contact shadow
      ctx.fillStyle = 'rgba(20, 10, 5, 0.6)';
      ctx.beginPath();
      ctx.ellipse(0, 22, 26, 7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Boots & Legs
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-9, 5, 6, 12);
      ctx.fillStyle = '#2A1810';
      ctx.beginPath();
      ctx.moveTo(-10, 15);
      ctx.lineTo(-4, 15);
      ctx.lineTo(-3, 22);
      ctx.lineTo(2, 22);
      ctx.lineTo(1, 18);
      ctx.lineTo(-5, 17);
      ctx.lineTo(-10, 17);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(-7, 18, 3, 2);

      ctx.fillStyle = '#334155';
      ctx.fillRect(2, 5, 7, 13);
      ctx.fillStyle = '#452A18';
      ctx.beginPath();
      ctx.moveTo(1, 15);
      ctx.lineTo(8, 15);
      ctx.lineTo(9, 23);
      ctx.lineTo(16, 23);
      ctx.lineTo(14, 19);
      ctx.lineTo(8, 18);
      ctx.lineTo(1, 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath();
      ctx.arc(4, 21, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Duster Coat & Torso
      ctx.fillStyle = '#5A3825';
      ctx.beginPath();
      ctx.moveTo(-16, 15);
      ctx.lineTo(-11, -8);
      ctx.lineTo(-15, -28);
      ctx.lineTo(14, -28);
      ctx.lineTo(15, -6);
      ctx.lineTo(11, 13);
      ctx.lineTo(-4, 14);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#2E190E';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#1E140C';
      ctx.fillRect(-3, -26, 11, 28);
      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(-2, -26);
      ctx.lineTo(6, -26);
      ctx.lineTo(2, -20);
      ctx.closePath();
      ctx.fill();

      // Slung Gunbelt & Ammo Loops
      ctx.fillStyle = '#291810';
      ctx.beginPath();
      ctx.moveTo(-13, 3);
      ctx.lineTo(11, 7);
      ctx.lineTo(10, 11);
      ctx.lineTo(-14, 7);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(0, 4, 5, 6);
      ctx.strokeStyle = '#B45309';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 4, 5, 6);

      ctx.fillStyle = '#FBBF24';
      for (let b = 0; b < 3; b++) {
        ctx.fillRect(-11 + b * 4, 3 + b * 0.8, 2, 5);
      }

      ctx.fillStyle = '#3E2415';
      ctx.beginPath();
      ctx.moveTo(6, 9);
      ctx.lineTo(13, 10);
      ctx.lineTo(11, 20);
      ctx.lineTo(6, 19);
      ctx.closePath();
      ctx.fill();

      // Bandana
      ctx.fillStyle = pColor;
      ctx.beginPath();
      ctx.moveTo(-8, -28);
      ctx.lineTo(9, -28);
      ctx.lineTo(5, -16);
      ctx.lineTo(-2, -18);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // Mascot Face & Head
      this.drawPlayerMascot(ctx, s.id, 0, -38, 12, mood, performance.now() * 0.001);

      // Stetson Cowboy Hat
      ctx.fillStyle = '#261710';
      ctx.beginPath();
      ctx.ellipse(0, -48, 23, 6, 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#150B06';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#331F16';
      ctx.beginPath();
      ctx.moveTo(-11, -48);
      ctx.lineTo(-9, -64);
      ctx.quadraticCurveTo(-4, -68, 0, -65);
      ctx.quadraticCurveTo(4, -68, 9, -64);
      ctx.lineTo(11, -48);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#150B06';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = pColor;
      ctx.fillRect(-11, -52, 22, 4);

      // Revolver Arm aiming at opponent
      ctx.fillStyle = '#5A3825';
      ctx.fillRect(4, -24, 18, 8);
      ctx.strokeStyle = '#2E190E';
      ctx.lineWidth = 1;
      ctx.strokeRect(4, -24, 18, 8);
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(20, -23, 3, 6);
      ctx.fillStyle = '#E0A97E';
      ctx.fillRect(22, -22, 4, 4);

      // Six-Shooter Revolver
      ctx.fillStyle = '#78350F';
      ctx.fillRect(23, -19, 4, 7);
      ctx.fillStyle = '#475569';
      ctx.fillRect(25, -23, 7, 6);
      ctx.fillStyle = '#94A3B8';
      ctx.fillRect(32, -22, 14, 4);
      ctx.fillStyle = '#334155';
      ctx.fillRect(24, -25, 2, 3);
      ctx.fillRect(44, -24, 2, 2);

      // Gun muzzle flash & smoke puff
      if (s.shotFired) {
        ctx.save();
        ctx.fillStyle = '#FEF08A';
        ctx.shadowColor = '#F59E0B';
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(48, -20, 11, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        for (let sp = 0; sp < 8; sp++) {
          const sa = (sp * Math.PI) / 4;
          const sr = sp % 2 === 0 ? 15 : 6;
          if (sp === 0) ctx.moveTo(48 + Math.cos(sa) * sr, -20 + Math.sin(sa) * sr);
          else ctx.lineTo(48 + Math.cos(sa) * sr, -20 + Math.sin(sa) * sr);
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = 'rgba(226, 232, 240, 0.65)';
        ctx.beginPath();
        ctx.arc(58, -24, 8, 0, Math.PI * 2);
        ctx.arc(66, -30, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore(); // Restore local transform

      // Underdog Dead-Eye Aura
      if (isUnderdog) {
        ctx.save();
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(s.x, s.y - 20, 38, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#FBBF24';
        ctx.font = 'bold 9px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡ DEAD-EYE', s.x, s.y - 66);
        ctx.restore();
      }

      // WORLD SPACE HUD OVERLAYS
      if (s.misfired) {
        ctx.save();
        ctx.fillStyle = '#EF4444';
        ctx.font = '900 15px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('FOUL - TOO EARLY!', s.x, s.y - 74);
        ctx.restore();
      }

      // Player Name Pill
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(s.x - 48, s.y - 88, 96, 20, 10);
      else ctx.rect(s.x - 48, s.y - 88, 96, 20);
      ctx.fill();
      ctx.strokeStyle = isUnderdog ? '#FBBF24' : pColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = isUnderdog ? '#FBBF24' : '#FFFFFF';
      ctx.font = '800 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.players[s.id].name.toUpperCase(), s.x, s.y - 78);
      ctx.restore();

      // Score Sheriff Stars
      for (let w = 0; w < this.targetWins; w++) {
        const starX = s.x - 20 + w * 20;
        const starY = s.y + 24;
        ctx.save();
        if (w < s.score) {
          ctx.fillStyle = '#F59E0B';
          ctx.strokeStyle = '#B45309';
          ctx.lineWidth = 1;
          ctx.beginPath();
          const rOuter = 6.5;
          const rInner = 3.2;
          for (let pt = 0; pt < 10; pt++) {
            const rad = pt % 2 === 0 ? rOuter : rInner;
            const a = -Math.PI / 2 + (pt * Math.PI) / 5;
            if (pt === 0) ctx.moveTo(starX + Math.cos(a) * rad, starY + Math.sin(a) * rad);
            else ctx.lineTo(starX + Math.cos(a) * rad, starY + Math.sin(a) * rad);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillStyle = '#475569';
          ctx.beginPath();
          ctx.arc(starX, starY, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Reaction time display
      if (s.reactionTime !== null) {
        ctx.save();
        ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(s.x - 40, s.y + 38, 80, 20, 8);
        else ctx.rect(s.x - 40, s.y + 38, 80, 20);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 12px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${s.reactionTime}ms`, s.x, s.y + 48);
        ctx.restore();
      }
    }

    // 7. Duel State Banner (Positioned cleanly below timer at y=72)
    ctx.textAlign = 'center';
    const signalY = 72;
    if (this.state === 'WAITING') {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(width / 2 - 170, signalY - 18, 340, 48, 24);
      else ctx.rect(width / 2 - 170, signalY - 18, 340, 48);
      ctx.fill();
      ctx.strokeStyle = this.decoyWord ? '#EF4444' : theme.badgeBorder;
      ctx.lineWidth = 2;
      ctx.stroke();

      if (this.decoyWord) {
        // BAIT DECOY WORD
        ctx.fillStyle = '#EF4444';
        ctx.font = '900 24px Montserrat, sans-serif';
        ctx.fillText(`⚠️ ${this.decoyWord} ⚠️`, width / 2, signalY + 8);
        ctx.fillStyle = '#FEF08A';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('DO NOT SHOOT! THAT WAS A BAIT!', width / 2, signalY + 23);
      } else {
        ctx.fillStyle = '#FEF08A';
        ctx.font = '900 17px Montserrat, sans-serif';
        ctx.fillText('STEADY... HOLD YOUR FIRE!', width / 2, signalY + 4);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('DO NOT DRAW EARLY OR YOU FOUL', width / 2, signalY + 22);
      }
      ctx.restore();
    } else if (this.state === 'DRAW_SIGNAL') {
      ctx.save();
      ctx.shadowColor = '#DC2626';
      ctx.shadowBlur = 28;
      ctx.fillStyle = '#DC2626';
      ctx.font = '900 58px Montserrat, sans-serif';
      ctx.fillText('DRAW!', width / 2, signalY + 22);
      ctx.restore();
    } else if (this.state === 'ROUND_RESOLVED' && this.roundWinnerId !== null) {
      const winner = this.players[this.roundWinnerId];
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(width / 2 - 180, signalY - 18, 360, 44, 22);
      else ctx.rect(width / 2 - 180, signalY - 18, 360, 44);
      ctx.fill();
      ctx.strokeStyle = winner.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = winner.color;
      ctx.font = '900 18px Montserrat, sans-serif';
      ctx.fillText(`${winner.name.toUpperCase()} WINS DUEL!`, width / 2, signalY + 10);
      ctx.restore();
    }

    // 8. Interactive Bottom-Left Theme Pill (x: 20, y: height - 44, w: 180, h: 32)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, height - 44, 180, 32, 16);
    else ctx.rect(20, height - 44, 180, 32);
    ctx.fill();
    ctx.strokeStyle = theme.badgeBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.badgeBorder;
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.name} [T]`, 20 + 90, height - 44 + 16);
    ctx.restore();

    ctx.restore();
  }
}

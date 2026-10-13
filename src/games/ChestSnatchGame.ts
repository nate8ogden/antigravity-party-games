import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type ChestThemeId = 'pirate' | 'pharaoh' | 'cyber';

interface ChestTheme {
  id: ChestThemeId;
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  floorDetailColor: string;
  chestWood: string;
  chestWoodDark: string;
  chestTrim: string;
  teethColor: string;
  eyeColorNormal: string;
  eyeColorWarning: string;
  accentColor: string;
}

const THEMES: Record<ChestThemeId, ChestTheme> = {
  pirate: {
    id: 'pirate',
    name: 'Pirate Mimic Vault',
    icon: '🏴‍☠️',
    bgGradTop: '#1E1B18',
    bgGradBottom: '#0B0A09',
    floorDetailColor: '#2D2824',
    chestWood: '#78350F',
    chestWoodDark: '#451A03',
    chestTrim: '#F59E0B',
    teethColor: '#F8FAFC',
    eyeColorNormal: '#F59E0B',
    eyeColorWarning: '#EF4444',
    accentColor: '#F59E0B'
  },
  pharaoh: {
    id: 'pharaoh',
    name: 'Gilded Pharaoh Crypt',
    icon: '🏺',
    bgGradTop: '#291804',
    bgGradBottom: '#100A02',
    floorDetailColor: '#3D2508',
    chestWood: '#D97706',
    chestWoodDark: '#78350F',
    chestTrim: '#FBBF24',
    teethColor: '#FEF3C7',
    eyeColorNormal: '#06B6D4',
    eyeColorWarning: '#F43F5E',
    accentColor: '#FBBF24'
  },
  cyber: {
    id: 'cyber',
    name: 'Cyberpunk Data Vault',
    icon: '⚡',
    bgGradTop: '#0F172A',
    bgGradBottom: '#020617',
    floorDetailColor: '#1E293B',
    chestWood: '#1E293B',
    chestWoodDark: '#0F172A',
    chestTrim: '#06B6D4',
    teethColor: '#38BDF8',
    eyeColorNormal: '#22D3EE',
    eyeColorWarning: '#EF4444',
    accentColor: '#38BDF8'
  }
};

type GemType = 'RUBY' | 'EMERALD' | 'DIAMOND' | 'CROWN' | 'HEART';

interface TreasureGem {
  id: number;
  x: number;
  y: number;
  type: GemType;
  points: number;
  color: string;
  radius: number;
  isTaken: boolean;
}

interface PlayerHand {
  id: PlayerId;
  baseX: number;
  baseY: number;
  handX: number;
  handY: number;
  vx: number;
  vy: number;
  isReaching: boolean;
  lives: number;
  maxLives: number;
  score: number;
  gemsGrabbed: number;
  heldGem: TreasureGem | null;
  stunTimer: number;
  hasShieldArmor: boolean;
  mood: CharacterMood;
  moodTimer: number;
  botReactionTimer: number;
}

export class ChestSnatchGame extends BaseGame {
  private currentThemeId: ChestThemeId = 'pirate';
  private playersState: Map<PlayerId, PlayerHand> = new Map();
  private gems: TreasureGem[] = [];
  private chestState: 'OPENING' | 'OPEN' | 'WARNING' | 'SHUT' = 'OPENING';
  private chestTimer: number = 1.2;
  private chestJawOpen: number = 0;
  private gemCounter: number = 0;
  private animTimer: number = 0;
  private screenShake: number = 0;
  private freezeFrames: number = 0;
  private suddenDeathTriggered: boolean = false;
  private heartSpawned: boolean = false;

  private onKeyDownBound: (e: KeyboardEvent) => void;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.onKeyDownBound = this.handleKeyDown.bind(this);
    window.addEventListener('keydown', this.onKeyDownBound);
  }

  public init(width: number, height: number): void {
    this.roundTimer = 50.0;
    this.isFinished = false;
    this.animTimer = 0;
    this.screenShake = 0;
    this.freezeFrames = 0;
    this.suddenDeathTriggered = false;
    this.heartSpawned = false;

    const themeKeys: ChestThemeId[] = ['pirate', 'pharaoh', 'cyber'];
    this.currentThemeId = themeKeys[Math.floor(Math.random() * themeKeys.length)];

    this.chestState = 'OPENING';
    this.chestTimer = 1.0;
    this.chestJawOpen = 0;

    this.setupPlayers(width, height);
    this.spawnTreasureGems(width, height);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 't' || e.key === 'T') {
      this.cycleTheme();
    } else if (e.key === '1') {
      this.setTheme('pirate');
    } else if (e.key === '2') {
      this.setTheme('pharaoh');
    } else if (e.key === '3') {
      this.setTheme('cyber');
    }
  }

  public cycleTheme(): void {
    const list: ChestThemeId[] = ['pirate', 'pharaoh', 'cyber'];
    const curIdx = list.indexOf(this.currentThemeId);
    this.setTheme(list[(curIdx + 1) % list.length]);
  }

  public setTheme(id: ChestThemeId): void {
    if (this.currentThemeId !== id) {
      this.currentThemeId = id;
      this.audio.playTap();
      this.particles.emit(100, 300, 15, THEMES[id].accentColor);
    }
  }

  private setupPlayers(width: number, height: number): void {
    this.playersState.clear();
    const active = this.getActivePlayers();

    const spawnCorners = [
      { x: 70, y: 110 },
      { x: width - 70, y: 110 },
      { x: 70, y: height - 100 },
      { x: width - 70, y: height - 100 }
    ];

    active.forEach((p, idx) => {
      const sp = spawnCorners[idx % spawnCorners.length];
      this.playersState.set(p.id, {
        id: p.id,
        baseX: sp.x,
        baseY: sp.y,
        handX: sp.x,
        handY: sp.y,
        vx: 0,
        vy: 0,
        isReaching: false,
        lives: 3,
        maxLives: 3,
        score: 0,
        gemsGrabbed: 0,
        heldGem: null,
        stunTimer: 0,
        hasShieldArmor: false,
        mood: 'idle',
        moodTimer: 0,
        botReactionTimer: 0.12 + Math.random() * 0.15
      });
    });
  }

  private spawnTreasureGems(width: number, height: number): void {
    this.gems = [];
    const cx = width / 2;
    const cy = height / 2 + 10;

    // 1 Center Cursed Crown
    this.gems.push({
      id: ++this.gemCounter,
      x: cx,
      y: cy,
      type: 'CROWN',
      points: 150,
      color: '#FBBF24',
      radius: 11,
      isTaken: false
    });

    const pool: { type: GemType; pts: number; col: string; r: number }[] = [
      { type: 'DIAMOND', pts: 75, col: '#38BDF8', r: 8 },
      { type: 'DIAMOND', pts: 75, col: '#38BDF8', r: 8 },
      { type: 'EMERALD', pts: 40, col: '#10B981', r: 7.5 },
      { type: 'EMERALD', pts: 40, col: '#10B981', r: 7.5 },
      { type: 'EMERALD', pts: 40, col: '#10B981', r: 7.5 },
      { type: 'RUBY', pts: 20, col: '#EF4444', r: 7 },
      { type: 'RUBY', pts: 20, col: '#EF4444', r: 7 },
      { type: 'RUBY', pts: 20, col: '#EF4444', r: 7 },
      { type: 'RUBY', pts: 20, col: '#EF4444', r: 7 },
      { type: 'RUBY', pts: 20, col: '#EF4444', r: 7 }
    ];

    pool.forEach((gemDef) => {
      const a = Math.random() * Math.PI * 2;
      const r = 16 + Math.random() * 44;
      this.gems.push({
        id: ++this.gemCounter,
        x: cx + Math.cos(a) * r,
        y: cy + Math.sin(a) * r * 0.7,
        type: gemDef.type,
        points: gemDef.pts,
        color: gemDef.col,
        radius: gemDef.r,
        isTaken: false
      });
    });
  }

  private spawnHeartOfTheOcean(width: number, height: number): void {
    if (this.heartSpawned) return;
    this.heartSpawned = true;
    const cx = width / 2;
    const cy = height / 2 + 10;

    this.gems.push({
      id: 9999,
      type: 'HEART',
      x: cx,
      y: cy,
      points: 300,
      color: '#EC4899',
      radius: 13,
      isTaken: false
    });
    this.audio.playChime();
    this.particles.emit(cx, cy, 30, '#EC4899');
    this.screenShake = 6;
  }

  private isUnderdog(playerId: PlayerId): boolean {
    const scores = Array.from(this.playersState.values()).map((p) => p.score);
    const maxScore = Math.max(...scores, 0);
    const p = this.playersState.get(playerId);
    return !!p && (p.lives <= 1 || (maxScore >= 150 && maxScore - p.score >= 120));
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.freezeFrames > 0) {
      this.freezeFrames--;
      return;
    }

    this.animTimer += dt;
    this.roundTimer -= dt;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 14);
    }

    // Sudden death at <= 15s
    if (this.roundTimer <= 15.0 && !this.suddenDeathTriggered) {
      this.suddenDeathTriggered = true;
      this.spawnHeartOfTheOcean(width, height);
      this.audio.playWhoosh();
    }

    if (this.roundTimer <= 0) {
      this.roundTimer = 0;
      this.isFinished = true;
      this.audio.playFanfare();
      return;
    }

    const cx = width / 2;
    const cy = height / 2 + 10;

    // Chest State Machine
    this.chestTimer -= dt;

    if (this.chestState === 'OPENING') {
      this.chestJawOpen = Math.min(1.0, this.chestJawOpen + dt * 2.5);
      if (this.chestTimer <= 0) {
        this.chestState = 'OPEN';
        const openDuration = this.suddenDeathTriggered ? 1.0 + Math.random() * 1.0 : 1.6 + Math.random() * 1.8;
        this.chestTimer = openDuration;
      }
    } else if (this.chestState === 'OPEN') {
      this.chestJawOpen = 1.0;
      if (this.chestTimer <= 0) {
        this.chestState = 'WARNING';
        const warnDuration = this.suddenDeathTriggered ? 0.35 : 0.52;
        this.chestTimer = warnDuration;
        this.audio.playTap();
      }
    } else if (this.chestState === 'WARNING') {
      // Chatter teeth animation
      this.chestJawOpen = 0.82 + Math.sin(this.animTimer * 30) * 0.18;
      if (this.chestTimer <= 0) {
        // CHOMP! Clamp shut!
        this.chestState = 'SHUT';
        this.chestJawOpen = 0;
        this.chestTimer = this.suddenDeathTriggered ? 0.7 : 1.1;
        this.audio.playBounce();
        this.screenShake = 7;
        this.freezeFrames = 3;

        // Check who got chomped
        for (const ps of this.playersState.values()) {
          if (ps.lives > 0) {
            const d = Math.hypot(ps.handX - cx, ps.handY - cy);
            if (d < 72) {
              if (this.isUnderdog(ps.id) && !ps.hasShieldArmor) {
                // Underdog shield absorbs 1 chomp!
                ps.hasShieldArmor = true;
                ps.stunTimer = 0.8;
                ps.isReaching = false;
                ps.mood = 'shocked';
                ps.moodTimer = 1.0;
                this.audio.playBounce();
                this.particles.emit(ps.handX, ps.handY, 12, '#FBBF24');
              } else {
                ps.lives--;
                ps.stunTimer = 1.8;
                ps.isReaching = false;
                ps.mood = 'shocked';
                ps.moodTimer = 1.5;
                if (ps.heldGem) {
                  ps.heldGem.isTaken = false;
                  ps.heldGem = null;
                }
                this.audio.playLaser();
                this.particles.emit(ps.handX, ps.handY, 18, '#EF4444');
              }
            }
          }
        }
      }
    } else if (this.chestState === 'SHUT') {
      this.chestJawOpen = 0;
      if (this.chestTimer <= 0) {
        this.chestState = 'OPENING';
        this.chestTimer = 0.6;
        // Refill taken gems
        if (this.gems.filter((g) => !g.isTaken).length < 5) {
          this.spawnTreasureGems(width, height);
        }
      }
    }

    // Update Bot AI
    this.updateBots(dt, width, height);

    // Update Player Hands
    const active = this.getActivePlayers();
    for (const p of active) {
      const ps = this.playersState.get(p.id);
      if (!ps || ps.lives <= 0) continue;

      if (ps.moodTimer > 0) {
        ps.moodTimer -= dt;
        if (ps.moodTimer <= 0) ps.mood = 'idle';
      }

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        ps.isReaching = false;
      }

      const underdog = this.isUnderdog(p.id);
      const reachSpeed = underdog ? 13 : 10;
      const retractSpeed = underdog ? 16 : 12;

      if (!p.type.startsWith('bot_')) {
        const isPressed = this.input.isPressed(p.id) || this.input.isActionPressed(p.id);
        const wasJustReleased = this.input.justReleased(p.id);

        if (isPressed && ps.stunTimer <= 0 && !ps.heldGem) {
          ps.isReaching = true;
          ps.mood = 'focused';
        } else if (wasJustReleased || ps.heldGem) {
          ps.isReaching = false;
        }
      }

      // Extension toward chest center or nearest high-value gem
      if (ps.isReaching && ps.stunTimer <= 0 && !ps.heldGem) {
        // Find targeted untaken gem
        let targetX = cx;
        let targetY = cy;
        let bestScore = -999;
        for (const g of this.gems) {
          if (g.isTaken) continue;
          const dist = Math.hypot(g.x - ps.handX, g.y - ps.handY);
          const score = g.points * 2 - dist;
          if (score > bestScore) {
            bestScore = score;
            targetX = g.x;
            targetY = g.y;
          }
        }

        ps.handX += (targetX - ps.handX) * Math.min(1, dt * reachSpeed);
        ps.handY += (targetY - ps.handY) * Math.min(1, dt * reachSpeed);

        // Check grabbing nearest gem if chest is open enough
        if (this.chestJawOpen > 0.35) {
          for (const g of this.gems) {
            if (g.isTaken) continue;
            const dist = Math.hypot(ps.handX - g.x, ps.handY - g.y);
            if (dist < 22) {
              g.isTaken = true;
              ps.heldGem = g;
              ps.isReaching = false; // Auto-retract with prize!
              ps.mood = 'triumph';
              ps.moodTimer = 0.8;
              this.audio.playTap();
              this.particles.emit(g.x, g.y, 8, g.color);
              break;
            }
          }
        }
      } else {
        // Retract back to base corner
        ps.handX += (ps.baseX - ps.handX) * Math.min(1, dt * retractSpeed);
        ps.handY += (ps.baseY - ps.handY) * Math.min(1, dt * retractSpeed);

        // Bank gem when hand returns safely to corner base!
        if (ps.heldGem) {
          const distBase = Math.hypot(ps.handX - ps.baseX, ps.handY - ps.baseY);
          if (distBase < 22) {
            ps.gemsGrabbed++;
            const multi = this.suddenDeathTriggered ? 2 : 1;
            const pts = ps.heldGem.points * multi;
            ps.score += pts;
            this.audio.playScore();
            this.particles.emit(ps.baseX, ps.baseY, 14, ps.heldGem.color);
            ps.heldGem = null;
            ps.mood = 'triumph';
            ps.moodTimer = 1.0;
          }
        }
      }
    }

    // Mid-air claw collisions: clack together and knock loose gems!
    for (let i = 0; i < active.length; i++) {
      const pA = this.playersState.get(active[i].id);
      if (!pA || pA.lives <= 0) continue;

      for (let j = i + 1; j < active.length; j++) {
        const pB = this.playersState.get(active[j].id);
        if (!pB || pB.lives <= 0) continue;

        const dx = pB.handX - pA.handX;
        const dy = pB.handY - pA.handY;
        const dist = Math.hypot(dx, dy);

        if (dist < 26 && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          pA.handX -= nx * 14;
          pA.handY -= ny * 14;
          pB.handX += nx * 14;
          pB.handY += ny * 14;

          this.audio.playBounce();
          this.particles.emit((pA.handX + pB.handX) / 2, (pA.handY + pB.handY) / 2, 6, '#F59E0B');

          // Chance to dislodge rival's held gem!
          if (pA.heldGem && Math.random() < 0.35) {
            pA.heldGem.isTaken = false;
            pA.heldGem = null;
            pA.mood = 'shocked';
            pA.moodTimer = 0.6;
          }
          if (pB.heldGem && Math.random() < 0.35) {
            pB.heldGem.isTaken = false;
            pB.heldGem = null;
            pB.mood = 'shocked';
            pB.moodTimer = 0.6;
          }
        }
      }
    }

    // Check last player standing
    const alive = Array.from(this.playersState.values()).filter((p) => p.lives > 0);
    if (alive.length <= 1 && active.length > 1) {
      if (alive.length === 1) alive[0].score += 150;
      this.isFinished = true;
      this.audio.playFanfare();
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
    if (!ps || ps.lives <= 0 || ps.stunTimer > 0) return;

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    const baseDelay =
      difficulty === 'bot_easy' ? 0.32 : difficulty === 'bot_normal' ? 0.18 : 0.08;
    ps.botReactionTimer = baseDelay;

    if (ps.heldGem) {
      ps.isReaching = false; // Retract to bank
      return;
    }

    if (this.chestState === 'OPEN') {
      ps.isReaching = true;
    } else if (this.chestState === 'WARNING') {
      // Pull back right before snap!
      if (difficulty === 'bot_hard') {
        ps.isReaching = false;
      } else if (difficulty === 'bot_normal') {
        ps.isReaching = Math.random() < 0.22; // 22% greedy risk
      } else {
        ps.isReaching = Math.random() < 0.55; // Easy gets greedy and chomped
      }
    } else {
      ps.isReaching = false;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentThemeId];

    ctx.save();
    if (this.screenShake > 0) {
      const shakeX = (Math.random() - 0.5) * this.screenShake;
      const shakeY = (Math.random() - 0.5) * this.screenShake;
      ctx.translate(shakeX, shakeY);
    }

    // 1. Vault Floor with Dynamic Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradTop);
    bgGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Floor stone pavers / cyber grid details
    ctx.fillStyle = theme.floorDetailColor;
    for (let i = 0; i < 35; i++) {
      const gx = (i * 103) % width;
      const gy = 80 + ((i * 73) % (height - 110));
      ctx.fillRect(gx, gy, 8, 4);
    }

    const cx = width / 2;
    const cy = height / 2 + 10;

    // Outer mimic perimeter circle
    ctx.strokeStyle = theme.floorDetailColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 85, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Giant Treasure Chest (Mimic)
    const chestW = 154;
    const chestH = 112;

    // Chest Body (Lower base)
    ctx.fillStyle = theme.chestWood;
    ctx.fillRect(cx - chestW / 2, cy - 20, chestW, chestH / 2 + 20);
    ctx.strokeStyle = theme.chestTrim;
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - chestW / 2, cy - 20, chestW, chestH / 2 + 20);

    // Gold trim straps
    ctx.fillStyle = theme.chestTrim;
    ctx.fillRect(cx - chestW / 2 + 24, cy - 20, 10, chestH / 2 + 20);
    ctx.fillRect(cx + chestW / 2 - 34, cy - 20, 10, chestH / 2 + 20);

    // Treasure Gems inside chest
    for (const g of this.gems) {
      if (g.isTaken) continue;

      ctx.save();
      ctx.translate(g.x, g.y);

      // Gem drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.arc(0, 3, g.radius * 0.9, 0, Math.PI * 2);
      ctx.fill();

      // Gem Body
      ctx.fillStyle = g.color;
      ctx.beginPath();
      if (g.type === 'CROWN') {
        // Crown shape
        ctx.moveTo(-9, 5);
        ctx.lineTo(-9, -4);
        ctx.lineTo(-4, -1);
        ctx.lineTo(0, -6);
        ctx.lineTo(4, -1);
        ctx.lineTo(9, -4);
        ctx.lineTo(9, 5);
        ctx.closePath();
      } else {
        ctx.arc(0, 0, g.radius, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();
    }

    // Razor sharp teeth
    const toothCount = 7;
    const toothW = chestW / toothCount;
    ctx.fillStyle = theme.teethColor;
    for (let t = 0; t < toothCount; t++) {
      const tx = cx - chestW / 2 + t * toothW;
      ctx.beginPath();
      ctx.moveTo(tx, cy - 20);
      ctx.lineTo(tx + toothW / 2, cy - 5);
      ctx.lineTo(tx + toothW, cy - 20);
      ctx.fill();
    }

    // Hinged Upper Chest Lid
    const lidLift = this.chestJawOpen * 66;
    ctx.fillStyle = theme.chestWoodDark;
    ctx.fillRect(cx - chestW / 2, cy - 40 - lidLift, chestW, 26);
    ctx.strokeStyle = theme.chestTrim;
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - chestW / 2, cy - 40 - lidLift, chestW, 26);

    // Glowing Mimic Eye on Lid
    const eyeColor =
      this.chestState === 'WARNING'
        ? theme.eyeColorWarning
        : this.chestState === 'SHUT'
        ? '#64748B'
        : theme.eyeColorNormal;

    ctx.fillStyle = eyeColor;
    ctx.beginPath();
    ctx.arc(cx, cy - 27 - lidLift, 7.5, 0, Math.PI * 2);
    ctx.fill();

    // Eye slit pupil
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(cx - 1.5, cy - 32 - lidLift, 3, 10);

    // 3. Player Mechanical Grabber Arms
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      const isDead = ps.lives <= 0;

      // Arm segment line with segmented joints
      ctx.strokeStyle = isDead ? '#64748B' : p.color;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(ps.baseX, ps.baseY);
      ctx.lineTo(ps.handX, ps.handY);
      ctx.stroke();

      // Arm joint pivot in center
      const midX = (ps.baseX + ps.handX) / 2;
      const midY = (ps.baseY + ps.handY) / 2;
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(midX, midY, 5, 0, Math.PI * 2);
      ctx.fill();

      // Hand claw
      ctx.fillStyle = isDead ? '#334155' : p.colorDark;
      ctx.beginPath();
      ctx.arc(ps.handX, ps.handY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Held Gem in claw
      if (ps.heldGem) {
        ctx.fillStyle = ps.heldGem.color;
        ctx.beginPath();
        ctx.arc(ps.handX, ps.handY, ps.heldGem.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Base stand
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(ps.baseX, ps.baseY, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    ctx.restore(); // Undo screen shake

    // 4. Header & Instruction Badge (Safe-zone: y: 56, h: 26)
    const headerW = 340;
    const headerH = 26;
    const headerX = width / 2 - headerW / 2;
    const headerY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(headerX, headerY, headerW, headerH, 6);
    else ctx.rect(headerX, headerY, headerW, headerH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle =
      this.chestState === 'WARNING'
        ? '#EF4444'
        : this.chestState === 'SHUT'
        ? '#FBBF24'
        : '#F8FAFC';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';

    const headerText =
      this.chestState === 'WARNING'
        ? '⚠️ TEETH CHATTERING! PULL BACK!'
        : this.chestState === 'SHUT'
        ? '💥 CHOMP! JAW CLAMPED SHUT!'
        : `${theme.icon} ${theme.name.toUpperCase()} • SNATCH JEWELS`;
    ctx.fillText(headerText, width / 2, headerY + 17);

    // 5. Corner Player HUD Cards with CharacterRenderer Mascots
    // Offset bottom-left card above Theme Pill (y: height - 128)
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      let cx = 16;
      let cy = 72;
      const cardW = 124;
      const cardH = 66;

      if (p.corner === 'top-right') {
        cx = width - cardW - 16;
        cy = 72;
      } else if (p.corner === 'bottom-left') {
        cx = 16;
        cy = height - cardH - 52;
      } else if (p.corner === 'bottom-right') {
        cx = width - cardW - 16;
        cy = height - cardH - 52;
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = ps.lives > 0 ? p.color : '#64748B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx, cy, cardW, cardH, 8);
      else ctx.rect(cx, cy, cardW, cardH);
      ctx.fill();
      ctx.stroke();

      // Underdog aura
      if (this.isUnderdog(p.id)) {
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(cx - 2, cy - 2, cardW + 4, cardH + 4);
        ctx.setLineDash([]);
      }

      // Mascot Avatar
      const isBot = p.type !== 'human';
      drawCharacter(ctx, cx + 22, cy + 33, 16, p.id, isBot, ps.mood, this.animTimer);

      // Name & Score
      ctx.fillStyle = ps.lives > 0 ? p.color : '#94A3B8';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, cx + 46, cy + 22);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`${ps.score} pts`, cx + 46, cy + 40);

      // Lives Hearts
      ctx.font = 'bold 12px sans-serif';
      for (let l = 0; l < 3; l++) {
        ctx.fillStyle = l < ps.lives ? '#EF4444' : '#475569';
        ctx.fillText('❤', cx + 46 + l * 14, cy + 56);
      }

      if (ps.stunTimer > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('STUNNED', cx + 88, cy + 56);
      }
    }

    // 6. Interactive Theme Pill (Bottom-left: x: 20, y: height - 44, w: 170, h: 32)
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '600 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${theme.icon} ${theme.name} [T]`, pillX + 10, pillY + 20);

    // 7. Control hints (Bottom-right: x: width - 20, y: height - 28)
    ctx.fillStyle = '#94A3B8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Hold: Reach & Grab | Release: Pull Hand Back', width - 20, height - 24);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const sorted = [...active].sort((a, b) => {
      const sa = this.playersState.get(a.id);
      const sb = this.playersState.get(b.id);
      if (!sa || !sb) return 0;
      if (sa.lives !== sb.lives) {
        return sb.lives - sa.lives;
      }
      return sb.score - sa.score;
    });

    const winnerId = sorted.length > 0 ? sorted[0].id : null;
    const topScore = this.playersState.get(winnerId ?? 0)?.score || 0;

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      score: this.playersState.get(p.id)?.score || 0,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: `Loot master! Snitched ${topScore} pts in jewels right out of the jaws of the mimic!`
    };
  }

  public reset(width: number, height: number): void {
    this.init(width, height);
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.onKeyDownBound);
  }

  public syncDebug(): Record<string, unknown> {
    return {
      theme: this.currentThemeId,
      chestState: this.chestState,
      chestTimer: this.chestTimer,
      roundTimer: this.roundTimer,
      suddenDeath: this.suddenDeathTriggered,
      gemsLeft: this.gems.filter((g) => !g.isTaken).length,
      players: Array.from(this.playersState.entries()).map(([id, p]) => ({
        id,
        score: p.score,
        lives: p.lives,
        isUnderdog: this.isUnderdog(id)
      }))
    };
  }
}

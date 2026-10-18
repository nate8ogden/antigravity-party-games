import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type MoleTheme = 'carnival' | 'cyber' | 'mushroom';

interface ThemeConfig {
  id: MoleTheme;
  name: string;
  badge: string;
  bgGradient: [string, string];
  boardBorder: string;
  burrowRim: string;
  burrowHole: string;
  burrowHighlight: string;
  accentGlow: string;
  dustColor: string;
}

const THEME_CONFIGS: ThemeConfig[] = [
  {
    id: 'carnival',
    name: 'Carnival Fairground',
    badge: '🎪 CARNIVAL FAIR',
    bgGradient: ['#78350F', '#451A03'],
    boardBorder: '#F59E0B',
    burrowRim: '#292524',
    burrowHole: '#0C0A09',
    burrowHighlight: '#D97706',
    accentGlow: '#FBBF24',
    dustColor: '#A16207'
  },
  {
    id: 'cyber',
    name: 'Cyberpunk Glade',
    badge: '⚡ CYBER GLADE',
    bgGradient: ['#0B132B', '#050814'],
    boardBorder: '#06B6D4',
    burrowRim: '#1E293B',
    burrowHole: '#030712',
    burrowHighlight: '#38BDF8',
    accentGlow: '#EC4899',
    dustColor: '#06B6D4'
  },
  {
    id: 'mushroom',
    name: 'Mystic Hollow',
    badge: '🍄 MYSTIC HOLLOW',
    bgGradient: ['#064E3B', '#022C22'],
    boardBorder: '#10B981',
    burrowRim: '#14532D',
    burrowHole: '#052E16',
    burrowHighlight: '#34D399',
    accentGlow: '#8B5CF6',
    dustColor: '#10B981'
  }
];

type MoleType = 'standard' | 'king' | 'star' | 'tnt' | 'emperor';

interface MoleBurrow {
  id: number;
  x: number;
  y: number;
  radius: number;
  moleType: MoleType | null;
  peekTimer: number;
  peekHeight: number; // 0 to 1
  isWhacked: boolean;
  whackAnim: number;
  wobblePhase: number;
}

interface MolePlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  slamAnim: number; // 0 to 1
  chargeTimer: number; // 0 to 1 (hold to charge mega slam)
  isCharging: boolean;
  stunTimer: number;
  shoveCooldown: number;
  score: number;
  molesWhacked: number;
  whackCount: number;
  botReactionTimer: number;
  botTargetOffset: { x: number; y: number };
  patrolIndex: number;
  patrolTimer: number;
  mood: CharacterMood;
  moodTimer: number;
  isUnderdog: boolean;
}

export class MolePanicGame extends BaseGame {
  private playersState: Map<PlayerId, MolePlayer> = new Map();
  private burrows: MoleBurrow[] = [];
  public currentTheme: MoleTheme = 'carnival';
  public get currentMapName(): string {
    const cfg = THEME_CONFIGS.find((t) => t.id === this.currentTheme);
    return cfg ? cfg.name : 'Carnival Fairground';
  }
  private spawnInterval: number = 0.7;
  private spawnTimer: number = 0;
  private suddenDeathAnnounced: boolean = false;
  private animTimer: number = 0;

  private lastWidth: number = 960;
  private lastHeight: number = 540;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.bindKeyboardShortcuts();
    this.bindCanvasPointer();
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 40;
    this.spawnTimer = 0.4;
    this.suddenDeathAnnounced = false;
    this.animTimer = 0;

    this.generateProceduralMap(width, height);
    this.initPlayers(width, height);
    this.syncDebug();
  }

  public syncDebug(): void {
    if (typeof window !== 'undefined') {
      const self = this;
      (window as any).__MOLE_PANIC_DEBUG__ = {
        get players() { return Array.from(self.playersState.values()); },
        get burrows() { return self.burrows; },
        get roundTimer() { return self.roundTimer; },
        get isFinished() { return self.isFinished; },
        get theme() { return self.currentTheme; },
        setTheme: (t: MoleTheme) => self.setMoleTheme(t),
        cycleTheme: () => self.cycleTheme(),
        spawnEmperor: () => self.spawnEmperorMole()
      };
    }
  }

  private bindKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;
    this.keydownListener = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === '1') {
        this.setMoleTheme('carnival');
      } else if (e.key === '2') {
        this.setMoleTheme('cyber');
      } else if (e.key === '3') {
        this.setMoleTheme('mushroom');
      }
    };
    window.addEventListener('keydown', this.keydownListener);
  }

  private bindCanvasPointer(): void {
    if (typeof window === 'undefined') return;
    const canvas = this.input.getCanvas();
    if (!canvas) return;

    this.boundPointerDown = (e: PointerEvent) => {
      this.handlePointerDown(e);
    };
    canvas.addEventListener('pointerdown', this.boundPointerDown);
  }

  private handlePointerDown(e: PointerEvent): void {
    const canvas = this.input.getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * this.lastWidth;
    const clickY = ((e.clientY - rect.top) / rect.height) * this.lastHeight;

    // Check Theme Pill click at (20, height - 44, 170, 32)
    if (
      clickX >= 20 &&
      clickX <= 190 &&
      clickY >= this.lastHeight - 44 &&
      clickY <= this.lastHeight - 12
    ) {
      this.cycleTheme();
    }
  }

  public cycleTheme(): void {
    const curIdx = THEME_CONFIGS.findIndex((t) => t.id === this.currentTheme);
    const nextIdx = (curIdx + 1) % THEME_CONFIGS.length;
    this.setMoleTheme(THEME_CONFIGS[nextIdx].id);
  }

  public setMoleTheme(theme: MoleTheme): void {
    if (this.currentTheme === theme) return;
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnExplosion(100, this.lastHeight - 28, '#F59E0B', 12);
  }

  public destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownListener) {
        window.removeEventListener('keydown', this.keydownListener);
        this.keydownListener = null;
      }
      const canvas = this.input.getCanvas();
      if (canvas && this.boundPointerDown) {
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
        this.boundPointerDown = null;
      }
      delete (window as any).__MOLE_PANIC_DEBUG__;
    }
  }

  private generateProceduralMap(width: number, height: number): void {
    // 4 columns x 3 rows = 12 burrows
    this.burrows = [];
    const cols = 4;
    const rows = 3;
    const startX = width * 0.18;
    const endX = width * 0.82;
    const startY = height * 0.32;
    const endY = height * 0.82;

    const stepX = (endX - startX) / (cols - 1);
    const stepY = (endY - startY) / (rows - 1);

    let id = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.burrows.push({
          id: ++id,
          x: startX + c * stepX,
          y: startY + r * stepY,
          radius: 28,
          moleType: null,
          peekTimer: 0,
          peekHeight: 0,
          isWhacked: false,
          whackAnim: 0,
          wobblePhase: Math.random() * Math.PI * 2
        });
      }
    }
  }

  private initPlayers(width: number, height: number): void {
    this.playersState.clear();
    const active = this.getActivePlayers();
    const corners = [
      { x: width * 0.22, y: height * 0.32 },
      { x: width * 0.78, y: height * 0.32 },
      { x: width * 0.22, y: height * 0.82 },
      { x: width * 0.78, y: height * 0.82 }
    ];

    active.forEach((p, idx) => {
      const c = corners[idx % corners.length];
      this.playersState.set(p.id, {
        id: p.id,
        x: c.x,
        y: c.y,
        vx: 0,
        vy: 0,
        targetX: c.x,
        targetY: c.y,
        slamAnim: 0,
        chargeTimer: 0,
        isCharging: false,
        stunTimer: 0,
        shoveCooldown: 0,
        score: 0,
        molesWhacked: 0,
        whackCount: 0,
        botReactionTimer: 0.15 + idx * 0.08,
        botTargetOffset: { x: 0, y: 0 },
        patrolIndex: idx % Math.max(1, this.burrows.length),
        patrolTimer: 0,
        mood: 'idle',
        moodTimer: 0,
        isUnderdog: false
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastWidth = width;
    this.lastHeight = height;
    this.animTimer += dt;
    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update Underdog status (trailing by >= 250 pts)
    this.updateUnderdogStatus();

    // Sudden Death Stampede Frenzy at 15s remaining
    if (this.roundTimer <= 15 && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.spawnEmperorMole();
      this.audio.playFanfare();
      this.particles.shake(0.4);
      this.particles.showFloatingText('STAMPEDE FRENZY! 🌟 2X MOLES', width / 2, height * 0.26, '#F59E0B', 28);
    }

    // Update bot inputs via BaseGame
    this.updateBots(dt, width, height);

    // Mole spawn maintenance (accelerated during sudden death)
    this.spawnTimer -= dt;
    const interval = this.roundTimer <= 15 ? 0.35 : 0.65;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = interval + Math.random() * 0.3;
      this.spawnRandomMole();
      if (this.roundTimer <= 15 && Math.random() < 0.5) {
        this.spawnRandomMole(); // Spawn dual moles in sudden death
      }
    }

    // Update Burrows & Emerging Moles
    for (const b of this.burrows) {
      if (b.whackAnim > 0) b.whackAnim = Math.max(0, b.whackAnim - dt * 4.5);

      if (b.moleType !== null) {
        b.peekTimer -= dt;
        if (b.peekTimer <= 0) {
          // Retreat back into burrow
          b.peekHeight -= dt * 4.5;
          if (b.peekHeight <= 0) {
            b.moleType = null;
            b.peekHeight = 0;
            b.isWhacked = false;
          }
        } else {
          // Pop up smoothly
          b.peekHeight = Math.min(1.0, b.peekHeight + dt * 6.5);
        }
      }
    }

    // Update Players & Mallets
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.moodTimer > 0) {
        ps.moodTimer = Math.max(0, ps.moodTimer - dt);
        if (ps.moodTimer <= 0) ps.mood = 'idle';
      }

      if (ps.shoveCooldown > 0) ps.shoveCooldown = Math.max(0, ps.shoveCooldown - dt);

      if (ps.stunTimer > 0) {
        ps.stunTimer = Math.max(0, ps.stunTimer - dt);
        ps.mood = 'shocked';
        continue;
      }

      if (ps.slamAnim > 0) ps.slamAnim = Math.max(0, ps.slamAnim - dt * 6.5);

      // Read Input
      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const actionHeld = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);
      const actionJust = this.input.justAction(p.id) || this.input.justPressed(p.id);

      // Hold to charge Mega Hammer
      if (actionHeld) {
        ps.isCharging = true;
        ps.chargeTimer = Math.min(1.0, ps.chargeTimer + dt * 1.8);
        if (ps.mood !== 'triumph' && ps.mood !== 'shocked') ps.mood = 'focused';
      } else {
        if (ps.isCharging) {
          // Release Slam
          const isMegaSlam = ps.chargeTimer >= 0.7;
          ps.slamAnim = 1.0;
          this.executeMalletSlam(ps, p.color, isMegaSlam);
          ps.isCharging = false;
          ps.chargeTimer = 0;
        } else if (actionJust && ps.slamAnim <= 0.1) {
          ps.slamAnim = 1.0;
          this.executeMalletSlam(ps, p.color, false);
        }
      }

      // Movement
      let moveSpeed = 370;
      if (ps.isUnderdog) moveSpeed *= 1.25; // Underdog speed boost
      if (ps.isCharging) moveSpeed *= 0.65; // Slowed while charging heavy hammer

      if (steer !== 0 || throttle !== 0) {
        ps.vx = steer * moveSpeed;
        ps.vy = -throttle * moveSpeed;
        ps.x += ps.vx * dt;
        ps.y += ps.vy * dt;
      } else {
        // Fallback smooth patrol across burrows
        ps.patrolTimer += dt;
        if (ps.patrolTimer >= 0.7) {
          ps.patrolTimer = 0;
          ps.patrolIndex = (ps.patrolIndex + 1) % this.burrows.length;
        }
        const targetBurrow = this.burrows[ps.patrolIndex];
        if (targetBurrow) {
          ps.x += (targetBurrow.x - ps.x) * Math.min(1, dt * 8.0);
          ps.y += (targetBurrow.y - ps.y) * Math.min(1, dt * 8.0);
        }
      }

      // Arena boundary limits
      ps.x = Math.max(width * 0.1, Math.min(width * 0.9, ps.x));
      ps.y = Math.max(height * 0.24, Math.min(height * 0.88, ps.y));
    }

    // Inter-Player Bumping & Mallet Shoving (Couch Chaos)
    this.handlePlayerCollisions(dt);

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private handlePlayerCollisions(dt: number): void {
    const players = Array.from(this.playersState.values());
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const p1 = players[i];
        const p2 = players[j];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = 42;

        if (dist < minDist && dist > 0) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          // Push apart
          p1.x -= nx * overlap * 0.5;
          p1.y -= ny * overlap * 0.5;
          p2.x += nx * overlap * 0.5;
          p2.y += ny * overlap * 0.5;

          if (p1.shoveCooldown <= 0 && p2.shoveCooldown <= 0) {
            p1.shoveCooldown = 0.4;
            p2.shoveCooldown = 0.4;
            this.audio.playBounce();
            this.particles.spawnDust((p1.x + p2.x) / 2, (p1.y + p2.y) / 2, 8);
          }
        }
      }
    }
  }

  private updateUnderdogStatus(): void {
    const players = Array.from(this.playersState.values());
    if (players.length < 2) return;

    let maxScore = -1;
    for (const p of players) {
      if (p.score > maxScore) maxScore = p.score;
    }

    for (const p of players) {
      p.isUnderdog = maxScore - p.score >= 250;
    }
  }

  private spawnRandomMole(): void {
    const emptyBurrows = this.burrows.filter((b) => b.moleType === null);
    if (emptyBurrows.length === 0) return;

    const chosen = emptyBurrows[Math.floor(Math.random() * emptyBurrows.length)];
    const roll = Math.random();

    let type: MoleType = 'standard';
    let duration = 1.6;

    if (roll < 0.40) {
      type = 'standard';
      duration = 1.5;
    } else if (roll < 0.68) {
      type = 'king';
      duration = 1.3;
    } else if (roll < 0.84) {
      type = 'star';
      duration = 0.95; // Fast peek!
    } else {
      type = 'tnt';
      duration = 1.7;
    }

    chosen.moleType = type;
    chosen.peekTimer = duration;
    chosen.peekHeight = 0;
    chosen.isWhacked = false;
  }

  private spawnEmperorMole(): void {
    // Pick center burrow (e.g. burrow index 5 or 6)
    const centerBurrow = this.burrows[5] || this.burrows[0];
    centerBurrow.moleType = 'emperor';
    centerBurrow.peekTimer = 3.5;
    centerBurrow.peekHeight = 0;
    centerBurrow.isWhacked = false;
    this.particles.spawnExplosion(centerBurrow.x, centerBurrow.y, '#F59E0B', 20);
  }

  private executeMalletSlam(ps: MolePlayer, color: string, isMegaSlam: boolean): void {
    ps.whackCount++;
    this.audio.playSqueak();

    const hitRadius = (ps.isUnderdog ? 36 : 28) * (isMegaSlam ? 2.2 : 1.0);

    if (isMegaSlam) {
      this.audio.playExplosion();
      this.particles.shake(0.35);
      this.particles.spawnExplosion(ps.x, ps.y, '#F59E0B', 20);
      this.particles.showFloatingText('MEGA SLAM! 💥', ps.x, ps.y - 30, '#F59E0B', 20);

      // Knock away adjacent rivals
      for (const p of this.getActivePlayers()) {
        const rival = this.playersState.get(p.id);
        if (!rival || rival.id === ps.id) continue;
        const d = Math.hypot(rival.x - ps.x, rival.y - ps.y);
        if (d < 85 && d > 0) {
          const nx = (rival.x - ps.x) / d;
          const ny = (rival.y - ps.y) / d;
          rival.x += nx * 50;
          rival.y += ny * 50;
          rival.stunTimer = 0.4;
          rival.mood = 'shocked';
          this.particles.showFloatingText('REPELLED!', rival.x, rival.y - 15, '#EF4444', 14);
        }
      }
    }

    // Check if any burrow is within mallet range
    let hitAnyMole = false;
    for (const b of this.burrows) {
      if (b.moleType === null || b.isWhacked || b.peekHeight < 0.25) continue;

      const d = Math.hypot(ps.x - b.x, ps.y - b.y);
      if (d <= b.radius + hitRadius) {
        b.isWhacked = true;
        b.whackAnim = 1.0;
        b.peekTimer = 0.22; // drop down quickly
        hitAnyMole = true;

        if (b.moleType === 'tnt') {
          // Whacked a TNT Mole!
          if (ps.isUnderdog) {
            // Underdog takes reduced penalty and NO stun!
            ps.score = Math.max(0, ps.score - 50);
            this.particles.showFloatingText('SHIELDED! -50', b.x, b.y - 25, '#F59E0B', 20);
          } else {
            ps.score = Math.max(0, ps.score - 150);
            ps.stunTimer = 1.3;
            ps.mood = 'shocked';
            ps.moodTimer = 1.3;
            this.audio.playExplosion();
            this.particles.shake(0.35);
            this.particles.showFloatingText('BOOM! -150', b.x, b.y - 25, '#EF4444', 24);
          }
          this.particles.spawnExplosion(b.x, b.y, '#EF4444', 25);
        } else {
          let pts = 100;
          let txtColor = '#FBBF24';
          if (b.moleType === 'king') {
            pts = 250;
            txtColor = '#F59E0B';
          } else if (b.moleType === 'star') {
            pts = 400;
            txtColor = '#EC4899';
          } else if (b.moleType === 'emperor') {
            pts = 600;
            txtColor = '#38BDF8';
          }

          if (this.roundTimer <= 15) pts *= 2; // 2X points during Sudden Death!

          ps.score += pts;
          ps.molesWhacked += 1;
          ps.mood = 'triumph';
          ps.moodTimer = 0.8;

          this.audio.playScore();
          this.particles.shake(0.2);
          this.particles.showFloatingText(`+${pts}!`, b.x, b.y - 30, txtColor, 24);
          this.particles.spawnConfetti(b.x, b.y, 16);
        }

        if (!isMegaSlam) break; // Mega slam can hit multiple burrows!
      }
    }

    if (!hitAnyMole && !isMegaSlam) {
      const cfg = THEME_CONFIGS.find((t) => t.id === this.currentTheme) || THEME_CONFIGS[0];
      this.particles.spawnDust(ps.x, ps.y + 10, 6);
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || ps.stunTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    const interval =
      difficulty === 'bot_hard' ? 0.05 : difficulty === 'bot_normal' ? 0.10 : 0.22;
    ps.botReactionTimer = interval;

    // Perceptual error
    if (difficulty === 'bot_easy') {
      ps.botTargetOffset = {
        x: (Math.random() - 0.5) * 36,
        y: (Math.random() - 0.5) * 36
      };
    } else if (difficulty === 'bot_normal') {
      ps.botTargetOffset = {
        x: (Math.random() - 0.5) * 16,
        y: (Math.random() - 0.5) * 16
      };
    } else {
      ps.botTargetOffset = { x: 0, y: 0 };
    }

    // Search for best emerging mole target
    let targetBurrow: MoleBurrow | null = null;
    let bestScore = -9999;

    for (const b of this.burrows) {
      if (b.moleType === null || b.isWhacked || b.peekHeight < 0.25) continue;

      const d = Math.hypot(b.x - ps.x, b.y - ps.y);
      let score = 120 - d;

      if (b.moleType === 'emperor') score += 600;
      else if (b.moleType === 'star') score += 400;
      else if (b.moleType === 'king') score += 250;
      else if (b.moleType === 'tnt') score -= 700;

      if (score > bestScore) {
        bestScore = score;
        targetBurrow = b;
      }
    }

    let steer = 0;
    let throttle = 0;
    let slam = false;

    if (targetBurrow) {
      const tx = targetBurrow.x + ps.botTargetOffset.x;
      const ty = targetBurrow.y + ps.botTargetOffset.y;
      const dx = tx - ps.x;
      const dy = ty - ps.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 14) {
        steer = dx > 0 ? 1 : -1;
        throttle = dy > 0 ? -1 : 1;
      } else {
        // In range to slam!
        if (targetBurrow.moleType !== 'tnt' || (difficulty === 'bot_easy' && Math.random() < 0.28)) {
          slam = true;
        }
      }

      // Hard AI holds to charge Mega Slam when surrounded by multiple active burrows
      if (difficulty === 'bot_hard' && dist < 22 && !ps.isCharging && Math.random() < 0.35) {
        slam = true; // start charging
      }
    }

    this.input.setBotInput(botId, slam, steer, throttle, slam);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;

    const cfg = THEME_CONFIGS.find((t) => t.id === this.currentTheme) || THEME_CONFIGS[0];

    // 1. Board Background
    this.renderBoardBackground(ctx, width, height, cfg);

    // 2. Burrows & Moles
    for (const b of this.burrows) {
      this.renderBurrowAndMole(ctx, b, cfg);
    }

    // 3. Players / Squeaky Mallets & Mascot Avatars
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      const isBot = p.type !== 'human';
      this.renderMalletPlayer(ctx, ps, p.color, isBot, cfg);
    }

    // 4. Center Sub-Header Badge (y: 56, h: 26 - respects top-center y:12-44 safe zone)
    this.renderSubHeaderBadge(ctx, width, cfg);

    // 5. Interactive Theme Pill (bottom-left x: 20, y: height - 44, w: 170, h: 32)
    this.renderThemePill(ctx, height, cfg);

    // 6. Control Hints (bottom-right x: width - 20, y: height - 28, textAlign: right)
    this.renderControlsHUD(ctx, width, height);
  }

  private renderBoardBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cfg: ThemeConfig
  ): void {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, cfg.bgGradient[0]);
    bgGrad.addColorStop(1, cfg.bgGradient[1]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Festive / Arena Decorative Outer Border
    ctx.save();
    ctx.strokeStyle = cfg.boardBorder;
    ctx.lineWidth = 3;
    ctx.shadowColor = cfg.accentGlow;
    ctx.shadowBlur = this.roundTimer <= 15 ? 16 + Math.sin(this.animTimer * 10) * 8 : 8;
    ctx.strokeRect(width * 0.08, height * 0.22, width * 0.84, height * 0.72);
    ctx.restore();

    // Subtle inner wood plank or grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let y = height * 0.25; y < height * 0.94; y += 38) {
      ctx.beginPath();
      ctx.moveTo(width * 0.08, y);
      ctx.lineTo(width * 0.92, y);
      ctx.stroke();
    }
  }

  private renderBurrowAndMole(ctx: CanvasRenderingContext2D, b: MoleBurrow, cfg: ThemeConfig): void {
    // 1. Burrow Rim (2.5D perspective ellipse)
    ctx.save();
    ctx.fillStyle = cfg.burrowRim;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.radius, b.radius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = cfg.burrowHighlight;
    ctx.stroke();

    // 2. Deep Burrow Hole
    ctx.fillStyle = cfg.burrowHole;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.radius * 0.8, b.radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Emerging Mole
    if (b.moleType !== null && b.peekHeight > 0) {
      ctx.save();
      const moleY = b.y - b.peekHeight * 30;
      ctx.translate(b.x, moleY);

      // Squish scale if whacked
      if (b.isWhacked) {
        ctx.scale(1.4, 0.35);
      }

      // Mole Head
      ctx.beginPath();
      ctx.arc(0, 0, 16, Math.PI, 0, false);
      ctx.lineTo(16, 12);
      ctx.lineTo(-16, 12);
      ctx.closePath();

      if (b.moleType === 'emperor') {
        ctx.fillStyle = '#38BDF8';
      } else if (b.moleType === 'star') {
        ctx.fillStyle = '#EC4899';
      } else if (b.moleType === 'king') {
        ctx.fillStyle = '#F59E0B';
      } else if (b.moleType === 'tnt') {
        ctx.fillStyle = '#DC2626';
      } else {
        ctx.fillStyle = '#78350F';
      }
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#0F172A';
      ctx.stroke();

      // Eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-5, -4, 3.5, 0, Math.PI * 2);
      ctx.arc(5, -4, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Pupils (Dizzy X if whacked)
      ctx.fillStyle = '#0F172A';
      if (b.isWhacked) {
        ctx.font = '700 8px monospace';
        ctx.fillText('x', -7, -2);
        ctx.fillText('x', 3, -2);
      } else {
        ctx.beginPath();
        ctx.arc(-5, -4, 1.8, 0, Math.PI * 2);
        ctx.arc(5, -4, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Snout / Pink Nose
      ctx.fillStyle = '#F472B6';
      ctx.beginPath();
      ctx.arc(0, 2, 4, 0, Math.PI * 2);
      ctx.fill();

      // Crown / Star / Fuse Accessories
      if (b.moleType === 'emperor') {
        // Rainbow Glowing Emperor Crown
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.moveTo(-12, -18);
        ctx.lineTo(-8, -10);
        ctx.lineTo(0, -18);
        ctx.lineTo(8, -10);
        ctx.lineTo(12, -18);
        ctx.lineTo(10, -6);
        ctx.lineTo(-10, -6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else if (b.moleType === 'king') {
        // Golden King Crown
        ctx.fillStyle = '#FBBF24';
        ctx.beginPath();
        ctx.moveTo(-10, -15);
        ctx.lineTo(-6, -8);
        ctx.lineTo(0, -15);
        ctx.lineTo(6, -8);
        ctx.lineTo(10, -15);
        ctx.lineTo(8, -5);
        ctx.lineTo(-8, -5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#B45309';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (b.moleType === 'star') {
        // Sparkling Star
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(0, -12, 4.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.moleType === 'tnt') {
        // Bomb Fuse & Spark
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -14);
        ctx.lineTo(3, -20);
        ctx.stroke();
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(3, -20, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  private renderMalletPlayer(
    ctx: CanvasRenderingContext2D,
    ps: MolePlayer,
    color: string,
    isBot: boolean,
    cfg: ThemeConfig
  ): void {
    ctx.save();
    ctx.translate(ps.x, ps.y);

    // Underdog Golden Dashed Aura
    if (ps.isUnderdog) {
      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(0, -10, 36, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Stun flurry stars if dazed
    if (ps.stunTimer > 0) {
      const a = performance.now() * 0.008;
      ctx.fillStyle = '#FBBF24';
      for (let s = 0; s < 3; s++) {
        const starA = a + (s * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(Math.cos(starA) * 18, Math.sin(starA) * 18 - 18, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Slam tilt angle
    const tilt = ps.slamAnim * 0.68;
    ctx.rotate(tilt);

    // Charge Scale (growing mallet head while charging)
    const chargeScale = 1.0 + ps.chargeTimer * 0.45;
    ctx.scale(chargeScale, chargeScale);

    // Mallet Handle (Wooden rod)
    ctx.fillStyle = '#92400E';
    ctx.fillRect(-3, -24, 6, 28);
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 1;
    ctx.strokeRect(-3, -24, 6, 28);

    // Giant Squeaky Mallet Head
    const headW = ps.isUnderdog ? 44 : 36;
    const headH = 22;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-headW / 2, -24 - headH, headW, headH, 6);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    // Rubber Mallet End Caps
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(-headW / 2, -24 - headH + 3, 4, headH - 6);
    ctx.fillRect(headW / 2 - 4, -24 - headH + 3, 4, headH - 6);

    ctx.restore();

    // Render Mascot Avatar alongside the player
    this.renderPlayerMascot(ctx, ps, isBot);

    // Score Tag
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${ps.score}`, ps.x, ps.y - 52);
  }

  private renderPlayerMascot(ctx: CanvasRenderingContext2D, ps: MolePlayer, isBot: boolean): void {
    const mascotX = ps.x + 22;
    const mascotY = ps.y + 12;

    ctx.save();
    drawCharacter(ctx, mascotX, mascotY, 13, ps.id, isBot, ps.mood, this.animTimer);
    ctx.restore();
  }

  private renderSubHeaderBadge(ctx: CanvasRenderingContext2D, width: number, cfg: ThemeConfig): void {
    const podW = 320;
    const podH = 26;
    const podX = width / 2 - podW / 2;
    const podY = 56; // Safe zone below top-center timer y: 12-44

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 13);
    ctx.fill();

    ctx.strokeStyle = cfg.boardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Map Name Badge
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(`ARENA: ${cfg.name}`, podX + 16, podY + 17);

    // Stampede Frenzy Status
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    if (this.roundTimer <= 15) {
      ctx.fillStyle = '#EF4444';
      ctx.fillText('⚡ STAMPEDE 2X PTS', podX + podW - 16, podY + 17);
    } else {
      ctx.fillStyle = '#94A3B8';
      ctx.fillText('HOLD TO CHARGE SLAM', podX + podW - 16, podY + 17);
    }
    ctx.restore();
  }

  private renderThemePill(ctx: CanvasRenderingContext2D, height: number, cfg: ThemeConfig): void {
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();

    ctx.strokeStyle = cfg.boardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(cfg.badge, pillX + 12, pillY + 20);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('[T]', pillX + pillW - 10, pillY + 20);
    ctx.restore();
  }

  private renderControlsHUD(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.fillText('Steer: Position Mallet | Tap: Whack | Hold: Mega Slam | Bump Rivals to Shove', width - 20, height - 28);
    ctx.restore();
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const rankings = active
      .map((p) => {
        const ps = this.playersState.get(p.id);
        const score = ps ? ps.score : 0;
        return { playerId: p.id, score, place: 1 };
      })
      .sort((a, b) => b.score - a.score);

    rankings.forEach((r, idx) => {
      r.place = idx + 1;
    });

    const winnerId =
      rankings.length > 0 && (rankings.length === 1 || rankings[0].score > rankings[1].score)
        ? rankings[0].playerId
        : null;

    let mvpHighlight = 'Carnival Whack Champion!';
    if (winnerId !== null) {
      const ps = this.playersState.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} clobbered ${ps?.molesWhacked || 0} moles with ${ps?.score || 0} pts!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}

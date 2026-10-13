import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type WhackAThiefThemeId = 'vault' | 'cyber' | 'pharaoh';

interface WhackAThiefTheme {
  id: WhackAThiefThemeId;
  name: string;
  icon: string;
  bgGradTop: string;
  bgGradBottom: string;
  wallFrame: string;
  boxBg: string;
  boxBorder: string;
  thiefColor: string;
  goldThiefColor: string;
  trapColor: string;
  accentColor: string;
}

const THEMES: Record<WhackAThiefThemeId, WhackAThiefTheme> = {
  vault: {
    id: 'vault',
    name: 'Federal Vault',
    icon: '🏦',
    bgGradTop: '#1E293B',
    bgGradBottom: '#0F172A',
    wallFrame: '#475569',
    boxBg: '#020617',
    boxBorder: '#64748B',
    thiefColor: '#64748B',
    goldThiefColor: '#F59E0B',
    trapColor: '#EF4444',
    accentColor: '#38BDF8'
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Core',
    icon: '⚡',
    bgGradTop: '#0B0F2A',
    bgGradBottom: '#030712',
    wallFrame: '#1E1B4B',
    boxBg: '#050B14',
    boxBorder: '#06B6D4',
    thiefColor: '#818CF8',
    goldThiefColor: '#F43F5E',
    trapColor: '#EF4444',
    accentColor: '#A855F7'
  },
  pharaoh: {
    id: 'pharaoh',
    name: 'Pharaoh Crypt',
    icon: '🏺',
    bgGradTop: '#291807',
    bgGradBottom: '#140A03',
    wallFrame: '#78350F',
    boxBg: '#180E04',
    boxBorder: '#D97706',
    thiefColor: '#92400E',
    goldThiefColor: '#FBBF24',
    trapColor: '#DC2626',
    accentColor: '#F59E0B'
  }
};

const THEME_ORDER: WhackAThiefThemeId[] = ['vault', 'cyber', 'pharaoh'];

interface VaultBox {
  id: number;
  col: number;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  state: 'empty' | 'thief' | 'gold_thief' | 'diamond_kingpin' | 'shock_trap';
  stateTimer: number;
  isHit: boolean;
  hitAnim: number;
}

interface VaultPlayer {
  id: PlayerId;
  targetCol: number;
  targetRow: number;
  reticleX: number;
  reticleY: number;
  score: number;
  whacks: number;
  stuns: number;
  stunTimer: number;
  swingAnim: number;
  navCooldown: number;
  chargeTime: number;
  isCharging: boolean;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  moodTimer: number;
}

export class WhackAThiefGame extends BaseGame {
  public boxes: VaultBox[] = [];
  public playersState: Map<PlayerId, VaultPlayer> = new Map();
  public currentTheme: WhackAThiefThemeId = 'vault';
  public get currentMapName(): string {
    return THEMES[this.currentTheme].name;
  }

  private spawnTimer: number = 0.7;
  private botReactionTimers: Map<PlayerId, number> = new Map();

  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;
  private canvasRef: HTMLCanvasElement | null = null;

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
    this.setupListeners();
    this.reset(width, height);
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;

    this.keyHandler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 't') {
        this.cycleTheme();
      } else if (key === '1') {
        this.setTheme('vault');
      } else if (key === '2') {
        this.setTheme('cyber');
      } else if (key === '3') {
        this.setTheme('pharaoh');
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    this.canvasRef = document.querySelector('canvas');
    if (this.canvasRef) {
      this.clickHandler = (e: MouseEvent) => {
        if (!this.canvasRef) return;
        const rect = this.canvasRef.getBoundingClientRect();
        const scaleX = this.canvasRef.width / rect.width;
        const scaleY = this.canvasRef.height / rect.height;
        const clickX = (e.clientX - rect.left) * scaleX;
        const clickY = (e.clientY - rect.top) * scaleY;

        // Theme pill zone: x: 20, y: height - 44, w: 170, h: 32
        const pillY = this.canvasRef.height - 44;
        if (clickX >= 20 && clickX <= 190 && clickY >= pillY && clickY <= pillY + 32) {
          this.cycleTheme();
        }
      };
      this.canvasRef.addEventListener('click', this.clickHandler);
    }
  }

  public cycleTheme(): void {
    const idx = THEME_ORDER.indexOf(this.currentTheme);
    this.setTheme(THEME_ORDER[(idx + 1) % THEME_ORDER.length]);
  }

  public setTheme(themeId: WhackAThiefThemeId): void {
    this.currentTheme = themeId;
    this.audio.playTap();
    this.particles.showFloatingText(
      `${THEMES[themeId].icon} ${THEMES[themeId].name}`,
      400,
      120,
      THEMES[themeId].accentColor,
      20
    );
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.boxes = [];
    this.playersState.clear();
    this.botReactionTimers.clear();
    this.spawnTimer = 0.7;

    // 4x3 Grid of 12 Safe Deposit Boxes
    const cols = 4;
    const rows = 3;
    const startX = width * 0.18;
    const spacingX = (width * 0.64) / (cols - 1);
    const startY = height * 0.28;
    const spacingY = (height * 0.54) / (rows - 1);

    let id = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.boxes.push({
          id: id++,
          col: c,
          row: r,
          x: startX + c * spacingX,
          y: startY + r * spacingY,
          width: 76,
          height: 66,
          state: 'empty',
          stateTimer: 0,
          isHit: false,
          hitAnim: 0
        });
      }
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const defaultCol = idx % 4;
      const defaultRow = Math.floor(idx / 4) % 3;
      const initialBox = this.boxes.find((b) => b.col === defaultCol && b.row === defaultRow) || this.boxes[0];

      this.playersState.set(p.id, {
        id: p.id,
        targetCol: defaultCol,
        targetRow: defaultRow,
        reticleX: initialBox.x,
        reticleY: initialBox.y,
        score: 0,
        whacks: 0,
        stuns: 0,
        stunTimer: 0,
        swingAnim: 0,
        navCooldown: 0,
        chargeTime: 0,
        isCharging: false,
        isUnderdog: false,
        currentMood: 'idle',
        moodTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.2 + Math.random() * 0.15);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Dynamic Underdog status
    const playersList = Array.from(this.playersState.values());
    const highestScore = Math.max(0, ...playersList.map((p) => p.score));
    playersList.forEach((p) => {
      p.isUnderdog = highestScore >= 350 && p.score <= highestScore - 250;
    });

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Box state updates & pop-outs
    const isSuddenDeath = this.roundTimer <= 15.0;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = isSuddenDeath ? 0.35 + Math.random() * 0.25 : 0.55 + Math.random() * 0.35;
      this.triggerPopOut(isSuddenDeath);
    }

    for (const box of this.boxes) {
      if (box.stateTimer > 0) {
        box.stateTimer -= dt;
        if (box.stateTimer <= 0) {
          box.state = 'empty';
          box.isHit = false;
        }
      }
      if (box.hitAnim > 0) {
        box.hitAnim = Math.max(0, box.hitAnim - dt * 4.5);
      }
    }

    // Update players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.moodTimer > 0) {
        ps.moodTimer -= dt;
      } else {
        ps.currentMood = ps.isCharging ? 'focused' : 'idle';
      }

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        ps.currentMood = 'shocked';
        continue;
      }
      if (ps.swingAnim > 0) {
        ps.swingAnim = Math.max(0, ps.swingAnim - dt * 6.0);
      }
      if (ps.navCooldown > 0) {
        ps.navCooldown -= dt;
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const actionHeld = this.input.isActionPressed(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      const justRight = this.input.justRight(p.id);
      const justLeft = this.input.justLeft(p.id);
      const justUp = this.input.justUp(p.id);
      const justDown = this.input.justDown(p.id);

      // Grid navigation: step on key press or debounced on analog stick hold
      if (justRight || (steer > 0.5 && ps.navCooldown <= 0)) {
        ps.targetCol = (ps.targetCol + 1) % 4;
        ps.navCooldown = 0.20;
      } else if (justLeft || (steer < -0.5 && ps.navCooldown <= 0)) {
        ps.targetCol = (ps.targetCol + 3) % 4;
        ps.navCooldown = 0.20;
      }

      if (justUp || (throttle > 0.5 && ps.navCooldown <= 0)) {
        ps.targetRow = (ps.targetRow + 2) % 3;
        ps.navCooldown = 0.20;
      } else if (justDown || (throttle < -0.5 && ps.navCooldown <= 0)) {
        ps.targetRow = (ps.targetRow + 1) % 3;
        ps.navCooldown = 0.20;
      }

      if (steer === 0 && throttle === 0) {
        ps.navCooldown = 0;
      }

      // Smooth reticle lerp towards target box
      const targetBox = this.boxes.find((b) => b.col === ps.targetCol && b.row === ps.targetRow);
      if (targetBox) {
        ps.reticleX += (targetBox.x - ps.reticleX) * dt * 18;
        ps.reticleY += (targetBox.y - ps.reticleY) * dt * 18;
      }

      // Hold-to-Charge Super Shockwave Slam
      if (actionHeld) {
        ps.isCharging = true;
        ps.chargeTime = Math.min(0.65, ps.chargeTime + dt);
        ps.currentMood = 'focused';
        if (Math.random() < 0.25) {
          this.particles.spawnSparks(ps.reticleX, ps.reticleY, p.color, 1);
        }
      } else if (ps.isCharging || justAction) {
        // Release Whack!
        const isSuperSlam = ps.chargeTime >= 0.5;
        ps.swingAnim = 1.0;
        ps.isCharging = false;
        ps.chargeTime = 0;

        if (targetBox) {
          this.executeWhack(ps, targetBox, isSuperSlam, isSuddenDeath);
        }
      }
    }

    // Check round over: timer expired
    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private executeWhack(
    player: VaultPlayer,
    targetBox: VaultBox,
    isSuperSlam: boolean,
    isSuddenDeath: boolean
  ): void {
    const pCfg = this.players[player.id];
    const color = pCfg ? pCfg.color : '#FFFFFF';
    const multiplier = (isSuddenDeath ? 2 : 1) * (player.isUnderdog ? 1.25 : 1);

    // Super Slam hits target and adjacent cross boxes!
    const affectedBoxes = isSuperSlam
      ? this.boxes.filter(
          (b) =>
            b.id === targetBox.id ||
            (Math.abs(b.col - targetBox.col) <= 1 && b.row === targetBox.row) ||
            (Math.abs(b.row - targetBox.row) <= 1 && b.col === targetBox.col)
        )
      : [targetBox];

    let hitAnyThief = false;

    affectedBoxes.forEach((box) => {
      if (box.isHit) return;

      if (box.state === 'thief' || box.state === 'gold_thief' || box.state === 'diamond_kingpin') {
        box.isHit = true;
        box.hitAnim = 1.0;
        hitAnyThief = true;

        let basePts = 100;
        let label = '+100 THIEF!';
        if (box.state === 'diamond_kingpin') {
          basePts = 450;
          label = '💎 +450 KINGPIN!';
          this.audio.playFanfare();
        } else if (box.state === 'gold_thief') {
          basePts = 250;
          label = '💰 +250 GOLD!';
          this.audio.playScore();
        } else {
          this.audio.playTap();
        }

        const pts = Math.round(basePts * multiplier);
        player.score += pts;
        player.whacks += 1;
        player.currentMood = 'triumph';
        player.moodTimer = 0.8;

        this.particles.shake(isSuperSlam ? 6 : 3);
        this.particles.spawnSparks(box.x, box.y, color, isSuperSlam ? 18 : 10);
        this.particles.showFloatingText(label, box.x, box.y - 20, THEMES[this.currentTheme].accentColor, 14);
      } else if (box.state === 'shock_trap' && box.id === targetBox.id) {
        // Shock trap triggered on primary target
        box.isHit = true;
        if (!player.isUnderdog) {
          player.stuns += 1;
          player.stunTimer = 1.4;
          player.score = Math.max(0, player.score - 80);
          player.currentMood = 'shocked';
          player.moodTimer = 1.4;

          this.audio.playExplosion();
          this.particles.shake(8);
          this.particles.spawnExplosion(box.x, box.y, '#EF4444', 24);
          this.particles.showFloatingText('⚡ SHOCKED! (-80)', box.x, box.y - 20, '#EF4444', 16);
        } else {
          // Underdog Golden Mallet absorbs shock trap!
          this.audio.playBounce();
          this.particles.spawnSparks(box.x, box.y, '#FBBF24', 12);
          this.particles.showFloatingText('SHOCK ABSORBED!', box.x, box.y - 20, '#FBBF24', 14);
        }
      }
    });

    if (isSuperSlam) {
      this.particles.shake(7);
      this.particles.spawnSparks(targetBox.x, targetBox.y, '#F59E0B', 20);
      this.particles.showFloatingText('MEGA SLAM!', targetBox.x, targetBox.y - 32, '#F59E0B', 16);
      this.audio.playBounce();
    } else if (!hitAnyThief && targetBox.state === 'empty') {
      this.audio.playTap();
    }
  }

  private triggerPopOut(isSuddenDeath: boolean): void {
    const emptyBoxes = this.boxes.filter((b) => b.state === 'empty');
    if (emptyBoxes.length === 0) return;

    // Pick 1 to 3 random boxes
    const maxCount = isSuddenDeath ? 3 : 2;
    const count = Math.min(emptyBoxes.length, Math.random() < 0.6 ? maxCount : 1);

    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * emptyBoxes.length);
      const box = emptyBoxes.splice(idx, 1)[0];
      if (box) {
        const roll = Math.random();
        if (roll < 0.18) {
          box.state = 'shock_trap';
        } else if (isSuddenDeath && roll < 0.38) {
          box.state = 'diamond_kingpin';
        } else if (roll < 0.45) {
          box.state = 'gold_thief';
        } else {
          box.state = 'thief';
        }
        box.stateTimer = isSuddenDeath ? 0.9 + Math.random() * 0.3 : 1.2 + Math.random() * 0.4;
        box.isHit = false;
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
    if (!bot || bot.stunTimer > 0) return;

    let timer = this.botReactionTimers.get(botId) || 0;
    timer -= dt;

    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const interval =
      difficulty === 'bot_easy'
        ? 0.38 + Math.random() * 0.20
        : difficulty === 'bot_normal'
        ? 0.20 + Math.random() * 0.12
        : 0.08 + Math.random() * 0.05;
    this.botReactionTimers.set(botId, interval);

    // Shock trap blunder check on Easy/Normal
    const shockTraps = this.boxes.filter((b) => !b.isHit && b.state === 'shock_trap');
    const trapBlunder =
      difficulty === 'bot_easy' ? Math.random() < 0.22 : difficulty === 'bot_normal' ? Math.random() < 0.06 : false;
    if (shockTraps.length > 0 && trapBlunder) {
      const trap = shockTraps[0];
      bot.targetCol = trap.col;
      bot.targetRow = trap.row;
      bot.swingAnim = 1.0;
      this.executeWhack(bot, trap, false, this.roundTimer <= 15.0);
      return;
    }

    // Find active thief boxes
    const activeTargets = this.boxes.filter(
      (b) => !b.isHit && (b.state === 'thief' || b.state === 'gold_thief' || b.state === 'diamond_kingpin')
    );

    if (activeTargets.length > 0) {
      if (difficulty === 'bot_easy' && Math.random() < 0.22) {
        return;
      }

      // Prioritize kingpin > gold > regular
      const target =
        activeTargets.find((b) => b.state === 'diamond_kingpin') ||
        activeTargets.find((b) => b.state === 'gold_thief') ||
        activeTargets[0];

      bot.targetCol = target.col;
      bot.targetRow = target.row;
      const isSuper = difficulty === 'bot_hard' && Math.random() < 0.45;
      bot.swingAnim = 1.0;
      this.executeWhack(bot, target, isSuper, this.roundTimer <= 15.0);
    }
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
        whacks: ps?.whacks || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const theme = THEMES[this.currentTheme];
    const topWhacks = scores[0]?.whacks || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} locked down the ${theme.name} with ${topWhacks} lightning thief zaps!`
      : 'Vault raided! The bandits fled into the night!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentTheme];

    // 1. Vault Background
    const wallGrad = ctx.createLinearGradient(0, 0, 0, height);
    wallGrad.addColorStop(0, theme.bgGradTop);
    wallGrad.addColorStop(1, theme.bgGradBottom);
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, width, height);

    // Decorative wall grid & rivet borders
    ctx.strokeStyle = theme.wallFrame;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(30, 48, width - 60, height - 96);

    // 2. Safe Deposit Box Burrows
    for (const b of this.boxes) {
      ctx.save();
      // Drop Shadow
      ctx.fillStyle = '#020617';
      ctx.fillRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);

      // Box background & door frame
      ctx.fillStyle = theme.boxBg;
      ctx.fillRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);

      ctx.strokeStyle = theme.boxBorder;
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);

      // Contents popping out
      if (b.state === 'thief' || b.state === 'gold_thief' || b.state === 'diamond_kingpin') {
        const isDiamond = b.state === 'diamond_kingpin';
        const isGold = b.state === 'gold_thief';
        const squish = b.hitAnim > 0 ? 0.6 : 1.0;

        ctx.translate(b.x, b.y);
        ctx.scale(1.0, squish);

        // Bandit Face
        ctx.fillStyle = isDiamond ? '#38BDF8' : isGold ? theme.goldThiefColor : theme.thiefColor;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();

        // Eye Mask
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-18, -8, 36, 10);

        // Glowing Eyes
        ctx.fillStyle = isDiamond ? '#FFFFFF' : isGold ? '#FEF08A' : '#38BDF8';
        ctx.beginPath();
        ctx.arc(-8, -3, 3, 0, Math.PI * 2);
        ctx.arc(8, -3, 3, 0, Math.PI * 2);
        ctx.fill();

        // Loot Sack / Crown
        if (isDiamond) {
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          ctx.moveTo(-10, -22);
          ctx.lineTo(-5, -28);
          ctx.lineTo(0, -22);
          ctx.lineTo(5, -28);
          ctx.lineTo(10, -22);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillStyle = '#10B981';
          ctx.beginPath();
          ctx.arc(14, 12, 10, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (b.state === 'shock_trap') {
        // Red flashing high-voltage electric trap
        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 22, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FEF08A';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', b.x, b.y);
      }

      ctx.restore();
    }

    // 3. Player Reticles & Stun Mallets
    for (const p of this.playersState.values()) {
      const cfg = this.players[p.id];
      const color = cfg ? cfg.color : '#FFFFFF';

      ctx.save();
      // Reticle Box
      const margin = 4 + p.id * 3.5;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(
        p.reticleX - 38 - margin,
        p.reticleY - 33 - margin,
        76 + margin * 2,
        66 + margin * 2
      );

      // Charge ring around reticle
      if (p.isCharging && p.chargeTime > 0) {
        const ratio = p.chargeTime / 0.65;
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.reticleX, p.reticleY, 28, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
        ctx.stroke();
      }

      // Mallet Swing visual
      const swingOffset = Math.sin(p.swingAnim * Math.PI) * 16;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.reticleX + 28, p.reticleY - 14 - swingOffset, 9, 0, Math.PI * 2);
      ctx.fill();

      // Stunned indicator
      if (p.stunTimer > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 12px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚡STUNNED!', p.reticleX, p.reticleY);
      }

      ctx.restore();
    }

    // 4. Draw HUD & Safe-zone elements
    this.renderHUD(ctx, width, height);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const theme = THEMES[this.currentTheme];

    // Minigame Header at y: 56, h: 26 (NEVER overlaps global timer at y: 12-44)
    const headerW = 290;
    const headerH = 26;
    const headerX = width * 0.5 - headerW * 0.5;
    const headerY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(headerX, headerY, headerW, headerH, 6);
    else ctx.rect(headerX, headerY, headerW, headerH);
    ctx.fill();
    ctx.strokeStyle = theme.boxBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const isSuddenDeath = this.roundTimer <= 15.0;
    const headerText = isSuddenDeath
      ? `🚨 VAULT BREACH 2X: ${Math.ceil(this.roundTimer)}s 🚨`
      : `${theme.icon} WHACK-A-THIEF — ${theme.name.toUpperCase()}`;
    ctx.fillText(headerText, width * 0.5, headerY + headerH * 0.5);

    // Interactive Theme Pill at bottom-left: x: 20, y: height - 44, w: 170, h: 32
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.icon} ${theme.name}`, pillX + 12, pillY + pillH * 0.5);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '900 9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('[T]', pillX + pillW - 10, pillY + pillH * 0.5);

    // Bottom Right Controls Hint
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.font = '600 11px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('WASD / Arrows: Aim | Hold Action: Super Slam', width - 20, height - 28);

    // Corner Player Cards offset to y: height - 128 (avoids theme pill at y: height - 44)
    const active = this.getActivePlayers();
    const cardW = 110;
    const cardH = 50;

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      let cx = 20;
      let cy = height - 128;

      if (idx === 1) {
        cx = width - cardW - 20;
        cy = height - 128;
      } else if (idx === 2) {
        cx = 20;
        cy = 94;
      } else if (idx === 3) {
        cx = width - cardW - 20;
        cy = 94;
      }

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(cx, cy, cardW, cardH, 8);
      else ctx.rect(cx, cy, cardW, cardH);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Mascot preview in card
      const isBot = p.type !== 'human';
      const mood: CharacterMood = ps ? ps.currentMood : 'idle';
      drawCharacter(ctx, cx + 22, cy + 25, 14, p.id, isBot, mood, performance.now() * 0.001);

      // Score / Status
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(p.name, cx + 42, cy + 8);

      ctx.fillStyle = theme.accentColor;
      ctx.font = '900 12px "Chakra Petch", monospace';
      ctx.fillText(`💰 ${Math.round(ps?.score || 0)}`, cx + 42, cy + 26);
    });

    ctx.restore();
  }

  public syncDebug(): void {
    // Expose internal state for headless tests
    (window as any).__WHACK_A_THIEF_DEBUG__ = {
      roundTimer: this.roundTimer,
      currentTheme: this.currentTheme,
      boxes: this.boxes.map((b) => ({
        id: b.id,
        state: b.state,
        isHit: b.isHit
      })),
      players: Array.from(this.playersState.values()).map((p) => ({
        id: p.id,
        score: p.score,
        targetCol: p.targetCol,
        targetRow: p.targetRow,
        stunTimer: p.stunTimer,
        isUnderdog: p.isUnderdog
      }))
    };
  }

  public destroy(): void {
    super.destroy();
    if (typeof window !== 'undefined') {
      if (this.keyHandler) {
        window.removeEventListener('keydown', this.keyHandler);
        this.keyHandler = null;
      }
      if (this.canvasRef && this.clickHandler) {
        this.canvasRef.removeEventListener('click', this.clickHandler);
        this.clickHandler = null;
      }
    }
  }
}

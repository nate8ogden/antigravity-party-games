import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type CatapultClashThemeId = 'stoneguard' | 'cyber' | 'magma';

interface CatapultClashTheme {
  id: CatapultClashThemeId;
  name: string;
  icon: string;
  skyTop: string;
  skyBottom: string;
  groundColor: string;
  groundHighlight: string;
  blockColor1: string;
  blockColor2: string;
  blockBorder: string;
  boulderColor: string;
  accentColor: string;
}

const THEMES: Record<CatapultClashThemeId, CatapultClashTheme> = {
  stoneguard: {
    id: 'stoneguard',
    name: 'Stoneguard Fortress',
    icon: '🏰',
    skyTop: '#1E1B4B',
    skyBottom: '#3B82F6',
    groundColor: '#166534',
    groundHighlight: '#22C55E',
    blockColor1: '#475569',
    blockColor2: '#334155',
    blockBorder: '#1E293B',
    boulderColor: '#64748B',
    accentColor: '#F59E0B'
  },
  cyber: {
    id: 'cyber',
    name: 'Cyber Siege Bastion',
    icon: '⚡',
    skyTop: '#0B0F2A',
    skyBottom: '#030712',
    groundColor: '#0F172A',
    groundHighlight: '#06B6D4',
    blockColor1: '#1E1B4B',
    blockColor2: '#312E81',
    blockBorder: '#06B6D4',
    boulderColor: '#38BDF8',
    accentColor: '#06B6D4'
  },
  magma: {
    id: 'magma',
    name: 'Molten Magma Keep',
    icon: '🔥',
    skyTop: '#450A0A',
    skyBottom: '#1C0606',
    groundColor: '#260A0A',
    groundHighlight: '#EF4444',
    blockColor1: '#261E1E',
    blockColor2: '#1C1515',
    blockBorder: '#DC2626',
    boulderColor: '#EA580C',
    accentColor: '#F97316'
  }
};

const THEME_ORDER: CatapultClashThemeId[] = ['stoneguard', 'cyber', 'magma'];

interface Boulder {
  id: number;
  throwerId: PlayerId;
  team: 'LEFT' | 'RIGHT';
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isMega: boolean;
  trail: { x: number; y: number }[];
}

interface CastleBlock {
  id: number;
  team: 'LEFT' | 'RIGHT';
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  isCrest: boolean;
}

interface CatapultPlayer {
  id: PlayerId;
  team: 'LEFT' | 'RIGHT';
  x: number;
  y: number;
  aimAngle: number;
  power: number;
  powerIncreasing: boolean;
  isWinding: boolean;
  score: number;
  blocksDestroyed: number;
  shotsFired: number;
  cooldown: number;
  isUnderdog: boolean;
  currentMood: CharacterMood;
  moodTimer: number;
}

export class CatapultClashGame extends BaseGame {
  public playersState: Map<PlayerId, CatapultPlayer> = new Map();
  public boulders: Boulder[] = [];
  public castleBlocks: CastleBlock[] = [];
  public currentTheme: CatapultClashThemeId = 'stoneguard';
  public get currentMapName(): string {
    return THEMES[this.currentTheme].name;
  }

  private boulderIdCounter: number = 0;
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
        this.setTheme('stoneguard');
      } else if (key === '2') {
        this.setTheme('cyber');
      } else if (key === '3') {
        this.setTheme('magma');
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

  public setTheme(themeId: CatapultClashThemeId): void {
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
    this.boulders = [];
    this.castleBlocks = [];
    this.playersState.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();

    // Spawn 2 castles (Left and Right) with destructible stone blocks
    const blockW = 28;
    const blockH = 22;
    const rows = 5;
    const cols = 4;

    // Left Castle Blocks
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isCrest = r === 2 && (c === 1 || c === 2);
        this.castleBlocks.push({
          id: this.castleBlocks.length,
          team: 'LEFT',
          x: width * 0.16 + c * (blockW + 2),
          y: height * 0.52 + r * (blockH + 2),
          width: blockW,
          height: blockH,
          health: isCrest ? 150 : 100,
          maxHealth: isCrest ? 150 : 100,
          isCrest
        });
      }
    }

    // Right Castle Blocks
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isCrest = r === 2 && (c === 1 || c === 2);
        this.castleBlocks.push({
          id: this.castleBlocks.length,
          team: 'RIGHT',
          x: width * 0.72 + c * (blockW + 2),
          y: height * 0.52 + r * (blockH + 2),
          width: blockW,
          height: blockH,
          health: isCrest ? 150 : 100,
          maxHealth: isCrest ? 150 : 100,
          isCrest
        });
      }
    }

    // Spawn Catapults for players
    active.forEach((p, idx) => {
      const team = idx % 2 === 0 ? 'LEFT' : 'RIGHT';
      const startX = team === 'LEFT' ? width * 0.08 : width * 0.92;
      const startY = height * 0.65 + (idx < 2 ? -40 : 40);
      const defaultAngle = team === 'LEFT' ? -Math.PI / 4 : -Math.PI * 0.75;

      this.playersState.set(p.id, {
        id: p.id,
        team,
        x: startX,
        y: startY,
        aimAngle: defaultAngle,
        power: 0,
        powerIncreasing: true,
        isWinding: false,
        score: 0,
        blocksDestroyed: 0,
        shotsFired: 0,
        cooldown: 0,
        isUnderdog: false,
        currentMood: 'idle',
        moodTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.25 + Math.random() * 0.15);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Dynamic Underdog status
    const playersList = Array.from(this.playersState.values());
    const highestScore = Math.max(0, ...playersList.map((p) => p.score));
    playersList.forEach((p) => {
      p.isUnderdog = highestScore >= 250 && p.score <= highestScore - 150;
    });

    // Update bot decisions
    this.updateBots(dt, width, height);

    const isSuddenDeath = this.roundTimer <= 15.0;

    // Update player catapults
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.cooldown > 0) ps.cooldown -= dt;
      if (ps.moodTimer > 0) {
        ps.moodTimer -= dt;
      } else {
        ps.currentMood = ps.isWinding ? 'focused' : 'idle';
      }

      const steer = this.input.getSteer(p.id);
      const actionHeld = this.input.isActionPressed(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);

      // Aim angle adjustment (within realistic trebuchet arc: 15 to 75 degrees)
      if (steer !== 0) {
        const angleSpeed = 1.6;
        ps.aimAngle += (ps.team === 'LEFT' ? steer : -steer) * angleSpeed * dt;
        const minAngle = ps.team === 'LEFT' ? -Math.PI * 0.45 : -Math.PI * 0.95;
        const maxAngle = ps.team === 'LEFT' ? -Math.PI * 0.05 : -Math.PI * 0.55;
        ps.aimAngle = Math.max(minAngle, Math.min(maxAngle, ps.aimAngle));
      }

      // Wind winch power
      const powerSpeed = (isSuddenDeath ? 750 : 550) * (ps.isUnderdog ? 1.3 : 1.0);
      if (actionHeld && ps.cooldown <= 0) {
        ps.isWinding = true;
        ps.currentMood = 'focused';
        if (ps.powerIncreasing) {
          ps.power += powerSpeed * dt;
          if (ps.power >= 740) {
            ps.power = 740;
            ps.powerIncreasing = false;
          }
        } else {
          ps.power -= powerSpeed * dt;
          if (ps.power <= 220) {
            ps.power = 220;
            ps.powerIncreasing = true;
          }
        }
      } else if (ps.isWinding || (justAction && ps.cooldown <= 0)) {
        // Release catapult! Launch boulder!
        const launchPower = Math.max(250, ps.power);
        const isMega = launchPower >= 620 || ps.isUnderdog;
        ps.isWinding = false;
        ps.cooldown = isSuddenDeath ? 0.35 : 0.55;
        ps.shotsFired += 1;

        const bx = ps.x + Math.cos(ps.aimAngle) * 32;
        const by = ps.y + Math.sin(ps.aimAngle) * 32;

        this.boulders.push({
          id: this.boulderIdCounter++,
          throwerId: ps.id,
          team: ps.team,
          x: bx,
          y: by,
          vx: Math.cos(ps.aimAngle) * launchPower,
          vy: Math.sin(ps.aimAngle) * launchPower,
          radius: isMega ? 13 : 9,
          isMega,
          trail: []
        });

        ps.power = 0;
        ps.powerIncreasing = true;
        this.audio.playLaser();
        this.particles.shake(isMega ? 5 : 3);
        this.particles.spawnSparks(bx, by, THEMES[this.currentTheme].accentColor, isMega ? 16 : 8);
        if (isMega) {
          this.particles.showFloatingText('MEGA BOULDER!', bx, by - 20, '#F59E0B', 14);
        }
      }
    }

    // Update boulders with ballistic gravity
    const gravity = 620;
    const multiplier = isSuddenDeath ? 2 : 1;

    for (let i = this.boulders.length - 1; i >= 0; i--) {
      const b = this.boulders[i];
      b.vy += gravity * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      b.trail.push({ x: b.x, y: b.y });
      if (b.trail.length > (b.isMega ? 14 : 8)) b.trail.shift();

      let hitBlock = false;
      const thrower = this.playersState.get(b.throwerId);

      // Check collision with enemy castle blocks
      for (let j = this.castleBlocks.length - 1; j >= 0; j--) {
        const block = this.castleBlocks[j];
        if (block.team === b.team) continue; // Friendly fire disabled

        if (
          b.x + b.radius >= block.x &&
          b.x - b.radius <= block.x + block.width &&
          b.y + b.radius >= block.y &&
          b.y - b.radius <= block.y + block.height
        ) {
          hitBlock = true;
          const damage = b.isMega ? 120 : 60;
          block.health -= damage;

          if (thrower) {
            const hitPts = (b.isMega ? 60 : 35) * multiplier;
            thrower.score += hitPts;
            thrower.currentMood = 'triumph';
            thrower.moodTimer = 0.8;
          }

          // Check block destruction
          if (block.health <= 0) {
            this.castleBlocks.splice(j, 1);
            if (thrower) {
              const crumbleBonus = (block.isCrest ? 200 : 80) * multiplier;
              thrower.score += crumbleBonus;
              thrower.blocksDestroyed += 1;
              const crumbleText = block.isCrest ? 'CREST CRUSHED! +200' : `CRUSHED! +${crumbleBonus}`;
              this.particles.showFloatingText(crumbleText, block.x, block.y - 18, '#F59E0B', 15);
            }
            this.audio.playExplosion();
            this.particles.shake(6);
            this.particles.spawnExplosion(block.x + block.width / 2, block.y + block.height / 2, '#EF4444', 22);
          } else {
            this.audio.playBounce();
            this.particles.shake(b.isMega ? 5 : 3);
            this.particles.spawnSparks(b.x, b.y, '#CBD5E1', 12);
          }

          if (!b.isMega) break; // Mega boulder punches through!
        }
      }

      // Check ground collision
      const groundY = height * 0.78;
      if (b.y >= groundY) {
        hitBlock = true;
        this.audio.playTap();
        this.particles.spawnSparks(b.x, groundY, '#78350F', 8);
      }

      // Remove boulder if hit or out of bounds
      if (hitBlock || b.x < -40 || b.x > width + 40 || b.y > height + 40) {
        this.boulders.splice(i, 1);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
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
        ? 0.38 + Math.random() * 0.20
        : difficulty === 'bot_normal'
        ? 0.20 + Math.random() * 0.12
        : 0.08 + Math.random() * 0.05;
    this.botReactionTimers.set(botId, interval);

    // Find enemy castle blocks
    const enemyBlocks = this.castleBlocks.filter((b) => b.team !== bot.team);
    if (enemyBlocks.length === 0) return;

    // Pick target block (prioritize crest)
    const target = enemyBlocks.find((b) => b.isCrest) || enemyBlocks[Math.floor(Math.random() * enemyBlocks.length)];

    // Target calculation: approximate distance
    const dist = Math.abs(target.x - bot.x);
    // Trajectory estimation: launch velocity roughly sqrt(dist * g)
    const idealPower = Math.min(720, Math.max(300, Math.sqrt(dist * 620) * 0.85));

    let idealAngle = bot.team === 'LEFT' ? -Math.PI * 0.26 : -Math.PI * 0.74;
    if (difficulty === 'bot_easy') {
      idealAngle += (Math.random() - 0.5) * 0.18;
    }

    bot.aimAngle = idealAngle;

    if (bot.cooldown <= 0) {
      // Release shot when power aligns
      const isMega = difficulty === 'bot_hard' && Math.random() < 0.45;
      const bx = bot.x + Math.cos(bot.aimAngle) * 32;
      const by = bot.y + Math.sin(bot.aimAngle) * 32;

      this.boulders.push({
        id: this.boulderIdCounter++,
        throwerId: bot.id,
        team: bot.team,
        x: bx,
        y: by,
        vx: Math.cos(bot.aimAngle) * (isMega ? 720 : idealPower),
        vy: Math.sin(bot.aimAngle) * (isMega ? 720 : idealPower),
        radius: isMega ? 13 : 9,
        isMega,
        trail: []
      });

      bot.cooldown = 0.60;
      bot.shotsFired += 1;
      this.audio.playLaser();
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
        blocksDestroyed: ps?.blocksDestroyed || 0
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
    const topBlocks = scores[0]?.blocksDestroyed || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} pulverized the enemy battlements with ${topBlocks} crushed blocks!`
      : 'Both fortresses weathered the siege!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const theme = THEMES[this.currentTheme];

    // 1. Battlefield Sky & Landscape
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, theme.skyTop);
    skyGrad.addColorStop(0.7, theme.skyBottom);
    skyGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Ground platform
    const groundY = height * 0.78;
    ctx.fillStyle = theme.groundColor;
    ctx.fillRect(0, groundY, width, height - groundY);

    ctx.strokeStyle = theme.groundHighlight;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(width, groundY);
    ctx.stroke();

    // 2. Render Castle Blocks
    for (const block of this.castleBlocks) {
      ctx.save();
      // Drop Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(block.x + 2, block.y + 2, block.width, block.height);

      ctx.fillStyle = block.isCrest ? theme.accentColor : (block.id % 2 === 0 ? theme.blockColor1 : theme.blockColor2);
      ctx.fillRect(block.x, block.y, block.width, block.height);

      // Stone border
      ctx.strokeStyle = theme.blockBorder;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(block.x, block.y, block.width, block.height);

      // Crest insignia
      if (block.isCrest) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👑', block.x + block.width / 2, block.y + block.height / 2);
      }

      // Damage cracks if health < maxHealth
      if (block.health < block.maxHealth) {
        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(block.x + 4, block.y + 4);
        ctx.lineTo(block.x + block.width - 4, block.y + block.height - 4);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Render Boulders & Smoke Trails
    for (const b of this.boulders) {
      ctx.save();
      if (b.trail.length > 1) {
        ctx.strokeStyle = b.isMega ? '#F59E0B' : 'rgba(203, 213, 225, 0.4)';
        ctx.lineWidth = b.isMega ? 4 : 2.5;
        ctx.beginPath();
        b.trail.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();
      }

      // Boulder Body
      ctx.fillStyle = b.isMega ? '#EA580C' : theme.boulderColor;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // 4. Render Catapults & Mascots
    for (const ps of this.playersState.values()) {
      const cfg = this.players[ps.id];
      const color = cfg ? cfg.color : '#FFFFFF';

      ctx.save();
      // Wooden Catapult Base Frame
      ctx.fillStyle = '#78350F';
      ctx.fillRect(ps.x - 14, ps.y - 4, 28, 14);

      // Wheels
      ctx.fillStyle = '#451A03';
      ctx.beginPath();
      ctx.arc(ps.x - 10, ps.y + 10, 6, 0, Math.PI * 2);
      ctx.arc(ps.x + 10, ps.y + 10, 6, 0, Math.PI * 2);
      ctx.fill();

      // Pivot Arm pointing in aimAngle
      ctx.save();
      ctx.translate(ps.x, ps.y);
      ctx.rotate(ps.aimAngle);

      ctx.strokeStyle = '#92400E';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(28, 0);
      ctx.stroke();

      // Catapult bucket
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(28, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Power meter arc when winding
      if (ps.isWinding) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        const pRatio = ps.power / 740;
        ctx.arc(ps.x, ps.y - 20, 16, -Math.PI / 2, -Math.PI / 2 + pRatio * Math.PI * 2);
        ctx.stroke();
      }

      // Mascot captain standing next to catapult
      const isBot = cfg?.type !== 'human';
      drawCharacter(ctx, ps.x + (ps.team === 'LEFT' ? -18 : 18), ps.y - 6, 12, ps.id, isBot, ps.currentMood, performance.now() * 0.001);

      // Player Name Pill
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(ps.x - 22, ps.y + 20, 44, 14, 6);
      else ctx.rect(ps.x - 22, ps.y + 20, 44, 14);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 9px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cfg?.name.toUpperCase() || `P${ps.id + 1}`, ps.x, ps.y + 27);

      ctx.restore();
    }

    // 5. Draw HUD & Safe-zone elements
    this.renderHUD(ctx, width, height);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const theme = THEMES[this.currentTheme];

    // Minigame Header at y: 56, h: 26 (NEVER overlaps global timer at y: 12-44)
    const headerW = 310;
    const headerH = 26;
    const headerX = width * 0.5 - headerW * 0.5;
    const headerY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(headerX, headerY, headerW, headerH, 6);
    else ctx.rect(headerX, headerY, headerW, headerH);
    ctx.fill();
    ctx.strokeStyle = theme.accentColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const isSuddenDeath = this.roundTimer <= 15.0;
    const headerText = isSuddenDeath
      ? `💥 SIEGE BARRAGE 2X: ${Math.ceil(this.roundTimer)}s 💥`
      : `${theme.icon} CATAPULT CLASH — ${theme.name.toUpperCase()}`;
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
    ctx.fillText('Steer: Arc Angle | Hold Action: Winch Power', width - 20, height - 28);

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
      ctx.fillText(`🏰 ${Math.round(ps?.score || 0)}`, cx + 42, cy + 26);
    });

    ctx.restore();
  }

  public syncDebug(): void {
    // Expose internal state for headless tests
    (window as any).__CATAPULT_CLASH_DEBUG__ = {
      roundTimer: this.roundTimer,
      currentTheme: this.currentTheme,
      boulders: this.boulders.length,
      castleBlocks: this.castleBlocks.length,
      players: Array.from(this.playersState.values()).map((p) => ({
        id: p.id,
        score: p.score,
        team: p.team,
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

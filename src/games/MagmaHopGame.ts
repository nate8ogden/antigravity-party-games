import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export interface MagmaTheme {
  name: string;
  lavaGradStart: string;
  lavaGradMid: string;
  lavaGradEnd: string;
  waveColor: string;
  pillarSide: string;
  pillarTopSolidStart: string;
  pillarTopSolidMid: string;
  pillarTopSolidEnd: string;
  pillarTopCrackStart: string;
  pillarRimSolid: string;
  pillarRimCrack: string;
  crystalColor: string;
  crystalHighlight: string;
  themePillColor: string;
}

export const MAGMA_THEMES: MagmaTheme[] = [
  {
    name: 'Volcanic Inferno 🔥',
    lavaGradStart: '#5E0D00',
    lavaGradMid: '#991B00',
    lavaGradEnd: '#4A0800',
    waveColor: 'rgba(255, 90, 0, 0.22)',
    pillarSide: '#1A141A',
    pillarTopSolidStart: '#4A4A58',
    pillarTopSolidMid: '#2C2B36',
    pillarTopSolidEnd: '#1A1922',
    pillarTopCrackStart: '#552211',
    pillarRimSolid: '#68667A',
    pillarRimCrack: '#FF5500',
    crystalColor: '#F59E0B',
    crystalHighlight: '#FEF08A',
    themePillColor: '#F97316'
  },
  {
    name: 'Toxic Acid Bog 🧪',
    lavaGradStart: '#052E16',
    lavaGradMid: '#14532D',
    lavaGradEnd: '#022C22',
    waveColor: 'rgba(74, 222, 128, 0.20)',
    pillarSide: '#142118',
    pillarTopSolidStart: '#334155',
    pillarTopSolidMid: '#1E293B',
    pillarTopSolidEnd: '#0F172A',
    pillarTopCrackStart: '#166534',
    pillarRimSolid: '#4ADE80',
    pillarRimCrack: '#A3E635',
    crystalColor: '#22C55E',
    crystalHighlight: '#BBF7D0',
    themePillColor: '#22C55E'
  },
  {
    name: 'Glacial Iceberg Rift ❄️',
    lavaGradStart: '#082F49',
    lavaGradMid: '#0369A1',
    lavaGradEnd: '#0C4A6E',
    waveColor: 'rgba(56, 189, 248, 0.22)',
    pillarSide: '#0B192C',
    pillarTopSolidStart: '#BAE6FD',
    pillarTopSolidMid: '#7DD3FC',
    pillarTopSolidEnd: '#38BDF8',
    pillarTopCrackStart: '#0284C7',
    pillarRimSolid: '#E0F2FE',
    pillarRimCrack: '#38BDF8',
    crystalColor: '#38BDF8',
    crystalHighlight: '#FFFFFF',
    themePillColor: '#38BDF8'
  }
];

export interface BasaltPillar {
  id: number;
  x: number;
  y: number;
  col: number;
  row: number;
  radius: number;
  state: 'solid' | 'cracking' | 'submerged' | 'rising';
  stateTimer: number;
  crackLevel: number;
  hasCrystal: boolean;
  geyserWarningTimer: number;
  geyserActiveTimer: number;
  shakeOffset: number;
}

export interface MagmaPlayer {
  id: PlayerId;
  x: number;
  y: number;
  z: number;
  angle: number;
  isAlive: boolean;
  lives: number;
  score: number;
  crystalsCollected: number;
  invulnerableTimer: number;
  currentPillarId: number | null;
  squashAnim: number;

  isHopping: boolean;
  hopProgress: number;
  hopDuration: number;
  hopStartX: number;
  hopStartY: number;
  hopTargetX: number;
  hopTargetY: number;
  hopTargetPillarId: number | null;
  hopCooldown: number;

  prevSteer: number;
  prevThrottle: number;
  moveHoldTimer: number;

  hopStreak: number;
  isUnderdog: boolean;
  hitStunTimer: number;
}

export class MagmaHopGame extends BaseGame {
  public pillars: BasaltPillar[] = [];
  public magmaPlayers: Map<PlayerId, MagmaPlayer> = new Map();
  public currentMapName: string = 'Hexagonal Atoll';

  private lavaOffset: number = 0;
  private crystalSpawnTimer: number = 2.0;
  private geyserCycleTimer: number = 4.0;
  private botReactionTimers: Map<PlayerId, number> = new Map();

  // Polish & Theme Properties
  private currentThemeIndex: number = 0;
  private animTimer: number = 0;
  private suddenDeathAnnounced: boolean = false;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private pointerdownListener: ((e: PointerEvent) => void) | null = null;

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

  public destroy(): void {
    this.removeListeners();
    super.destroy();
    if (typeof window !== 'undefined' && (window as unknown as { __MAGMA_HOP_DEBUG__?: unknown }).__MAGMA_HOP_DEBUG__) {
      delete (window as unknown as { __MAGMA_HOP_DEBUG__?: unknown }).__MAGMA_HOP_DEBUG__;
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isFinished) return;
      if (e.code === 'KeyT') {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % MAGMA_THEMES.length;
        this.audio.playTap();
      }
    };
    window.addEventListener('keydown', this.keydownListener);

    this.pointerdownListener = (e: PointerEvent) => {
      if (this.isFinished) return;
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // Theme pill at x: 20, y: canvas.height - 44, w: 170, h: 32
      if (clickX >= 20 && clickX <= 190 && clickY >= canvas.height - 44 && clickY <= canvas.height - 12) {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % MAGMA_THEMES.length;
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

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.suddenDeathAnnounced = false;
    this.pillars = [];
    this.magmaPlayers.clear();
    this.botReactionTimers.clear();
    this.lavaOffset = 0;
    this.crystalSpawnTimer = 1.5;
    this.geyserCycleTimer = 4.0;
    this.animTimer = 0;

    const spawnPillars = this.generateRandomMap(width, height);

    const innerPillars = this.pillars.filter((p) => p.col >= 1 && p.col <= 4);
    for (let i = 0; i < Math.min(5, innerPillars.length); i++) {
      const idx = Math.floor(Math.random() * innerPillars.length);
      if (innerPillars[idx]) innerPillars[idx].hasCrystal = true;
    }

    const active = this.getActivePlayers();
    active.forEach((p, index) => {
      const pil = spawnPillars[index % spawnPillars.length] || this.pillars[0];

      this.magmaPlayers.set(p.id, {
        id: p.id,
        x: pil.x,
        y: pil.y,
        z: 0,
        angle: 0,
        isAlive: true,
        lives: 3,
        score: 0,
        crystalsCollected: 0,
        invulnerableTimer: 0,
        currentPillarId: pil.id,
        squashAnim: 0,
        isHopping: false,
        hopProgress: 0,
        hopDuration: 0.34,
        hopStartX: pil.x,
        hopStartY: pil.y,
        hopTargetX: pil.x,
        hopTargetY: pil.y,
        hopTargetPillarId: pil.id,
        hopCooldown: 0,
        prevSteer: 0,
        prevThrottle: 0,
        moveHoldTimer: 0,
        hopStreak: 0,
        isUnderdog: false,
        hitStunTimer: 0
      });
      this.botReactionTimers.set(p.id, 0.35 + Math.random() * 0.25);
    });

    // Expose debug hook for testing
    (window as any).__MAGMA_HOP_DEBUG__ = {
      getPlayers: () => Array.from(this.magmaPlayers.values()).map(p => ({
        id: p.id,
        x: p.x,
        y: p.y,
        lives: p.lives,
        score: p.score,
        currentPillarId: p.currentPillarId,
        isUnderdog: p.isUnderdog,
        hopStreak: p.hopStreak
      })),
      getPillars: () => this.pillars.map(pil => ({
        id: pil.id,
        x: pil.x,
        y: pil.y,
        state: pil.state,
        hasCrystal: pil.hasCrystal
      })),
      hop: (pid: PlayerId, targetPillarId: number) => {
        const p = this.magmaPlayers.get(pid);
        const pil = this.pillars.find(x => x.id === targetPillarId);
        if (p && pil) {
          this.startHop(p, pil.id, pil.x, pil.y);
        }
      },
      getTheme: () => MAGMA_THEMES[this.currentThemeIndex].name,
      setTheme: (idx: number) => {
        this.currentThemeIndex = Math.max(0, Math.min(idx, MAGMA_THEMES.length - 1));
      }
    };
  }

  private generateRandomMap(width: number, height: number): BasaltPillar[] {
    const archetypes = ['Hexagonal Atoll', 'Twin Islands', 'Crater Ring', 'Volcanic Archipelago'];
    this.currentMapName = archetypes[Math.floor(Math.random() * archetypes.length)];
    this.pillars = [];

    const cols = 6;
    const rows = 4;
    const startX = width * 0.16;
    const spacingX = (width * 0.68) / (cols - 1);
    const startY = height * 0.28;
    const spacingY = (height * 0.52) / (rows - 1);

    let idCounter = 0;
    const spawns: BasaltPillar[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const px = startX + c * spacingX + (r % 2 === 1 ? spacingX * 0.4 : 0);
        const py = startY + r * spacingY;

        const pil: BasaltPillar = {
          id: idCounter++,
          x: px,
          y: py,
          col: c,
          row: r,
          radius: 28,
          state: 'solid',
          stateTimer: 0,
          crackLevel: 0,
          hasCrystal: false,
          geyserWarningTimer: 0,
          geyserActiveTimer: 0,
          shakeOffset: 0
        };
        this.pillars.push(pil);

        // Corner spawns
        if ((r === 0 || r === rows - 1) && (c === 0 || c === cols - 1)) {
          spawns.push(pil);
        }
      }
    }

    return spawns.length >= 4 ? spawns : this.pillars.slice(0, 4);
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.animTimer += dt;
    this.lavaOffset += dt * 1.5;
    const isSuddenDeath = this.roundTimer <= 15;

    if (isSuddenDeath && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.audio.playExplosion();
      this.particles.addTrauma(0.4);
      this.particles.showFloatingText('🌋 SUDDEN DEATH: MAGMA SURGE! 🌋', width / 2, height / 2 - 40, '#FACC15', 28);
    }

    // Determine Underdog status
    let maxLives = 0;
    let minLives = 4;
    let maxScore = -Infinity;
    let minScore = Infinity;
    for (const p of this.magmaPlayers.values()) {
      if (!p.isAlive) continue;
      if (p.lives > maxLives) maxLives = p.lives;
      if (p.lives < minLives) minLives = p.lives;
      if (p.score > maxScore) maxScore = p.score;
      if (p.score < minScore) minScore = p.score;
    }

    for (const p of this.magmaPlayers.values()) {
      p.isUnderdog = p.isAlive && ((maxLives - p.lives >= 1) || (maxScore - p.score >= 150 && maxScore > 0));
    }

    // Update pillars & geysers
    this.updatePillars(dt, isSuddenDeath);
    this.updateBots(dt, width, height);

    // Crystal spawning
    this.crystalSpawnTimer -= dt;
    if (this.crystalSpawnTimer <= 0) {
      this.crystalSpawnTimer = 3.5 + Math.random() * 2.0;
      this.spawnCrystal();
    }

    // Geyser eruptions
    this.geyserCycleTimer -= dt;
    if (this.geyserCycleTimer <= 0) {
      this.geyserCycleTimer = isSuddenDeath ? 2.2 : 4.0 + Math.random() * 2.0;
      this.triggerRandomGeysers();
    }

    // Update player movement and hopping
    this.updatePlayers(dt);

    const active = this.getActivePlayers();
    const alivePlayers = Array.from(this.magmaPlayers.values()).filter((p) => p.isAlive);

    if (this.roundTimer <= 0 || (active.length > 1 && alivePlayers.length <= 1)) {
      this.isFinished = true;
    }
  }

  private updatePillars(dt: number, isSuddenDeath: boolean): void {
    for (const pil of this.pillars) {
      if (pil.geyserWarningTimer > 0) {
        pil.geyserWarningTimer -= dt;
        if (pil.geyserWarningTimer <= 0) {
          pil.geyserActiveTimer = 1.3;
          this.audio.playExplosion();
          this.particles.shake(6);
          this.particles.spawnExplosion(pil.x, pil.y, '#FF4500', 18);
        }
      } else if (pil.geyserActiveTimer > 0) {
        pil.geyserActiveTimer -= dt;
        if (Math.random() < 0.45) {
          this.particles.spawnSparks(pil.x + (Math.random() - 0.5) * 24, pil.y - 24, '#FFA500', 3);
        }
      }

      // In Sudden Death, outer pillars sink permanently
      if (isSuddenDeath && (pil.col === 0 || pil.col === 5 || pil.row === 0 || pil.row === 3)) {
        if (pil.state === 'solid') {
          pil.state = 'cracking';
          pil.stateTimer = 1.2;
        }
      }

      switch (pil.state) {
        case 'solid':
          pil.shakeOffset = 0;
          pil.crackLevel = 0;
          break;

        case 'cracking':
          pil.stateTimer -= dt;
          pil.crackLevel = Math.min(1, pil.crackLevel + dt * 0.7);
          pil.shakeOffset = (Math.random() - 0.5) * 4 * pil.crackLevel;
          if (pil.stateTimer <= 0) {
            pil.state = 'submerged';
            pil.stateTimer = isSuddenDeath ? 999 : 2.6; // stays down permanently in sudden death
            pil.hasCrystal = false;
            this.particles.spawnSparks(pil.x, pil.y, '#FF3300', 16);
            this.audio.playBounce();
          }
          break;

        case 'submerged':
          if (!isSuddenDeath) {
            pil.stateTimer -= dt;
            pil.shakeOffset = 0;
            if (pil.stateTimer <= 0) {
              pil.state = 'rising';
              pil.stateTimer = 0.8;
            }
          }
          break;

        case 'rising':
          pil.stateTimer -= dt;
          pil.crackLevel = Math.max(0, pil.stateTimer / 0.8);
          if (pil.stateTimer <= 0) {
            pil.state = 'solid';
            pil.crackLevel = 0;
          }
          break;
      }
    }
  }

  private spawnCrystal(): void {
    const solidPillars = this.pillars.filter((p) => p.state === 'solid' && !p.hasCrystal);
    if (solidPillars.length > 0) {
      const chosen = solidPillars[Math.floor(Math.random() * solidPillars.length)];
      chosen.hasCrystal = true;
      this.particles.spawnSparks(chosen.x, chosen.y, '#F59E0B', 10);
    }
  }

  private triggerRandomGeysers(): void {
    const candidatePillars = this.pillars.filter(
      (p) => p.state !== 'submerged' && p.geyserWarningTimer <= 0 && p.geyserActiveTimer <= 0
    );
    if (candidatePillars.length === 0) return;

    const count = Math.min(candidatePillars.length, Math.random() < 0.6 ? 2 : 1);
    for (let i = 0; i < count; i++) {
      const pickIdx = Math.floor(Math.random() * candidatePillars.length);
      const chosen = candidatePillars.splice(pickIdx, 1)[0];
      if (chosen) {
        chosen.geyserWarningTimer = 1.2;
      }
    }
  }

  private updatePlayers(dt: number): void {
    for (const p of this.magmaPlayers.values()) {
      if (!p.isAlive) continue;

      if (p.invulnerableTimer > 0) p.invulnerableTimer -= dt;
      if (p.hopCooldown > 0) p.hopCooldown -= dt;
      if (p.hitStunTimer > 0) p.hitStunTimer -= dt;
      if (p.squashAnim > 0) p.squashAnim = Math.max(0, p.squashAnim - dt * 5.0);

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      const justUp = this.input.justUp(p.id);
      const justDown = this.input.justDown(p.id);
      const justLeft = this.input.justLeft(p.id);
      const justRight = this.input.justRight(p.id);

      if (p.isHopping) {
        p.hopProgress += dt / p.hopDuration;
        const t = Math.min(1.0, p.hopProgress);

        p.x = p.hopStartX + (p.hopTargetX - p.hopStartX) * t;
        p.y = p.hopStartY + (p.hopTargetY - p.hopStartY) * t;

        const peakZ = p.isUnderdog ? 54 : 44;
        p.z = Math.sin(t * Math.PI) * peakZ;

        if (p.hopProgress >= 1.0) {
          p.isHopping = false;
          p.z = 0;
          p.squashAnim = 0.8;
          p.hopCooldown = 0.08;
          this.onPlayerLanded(p);
        }
      } else {
        this.checkStandingPillar(p, dt);

        if (steer !== 0 || throttle !== 0) {
          p.angle = Math.atan2(-throttle, steer);
        }

        const justSteerChange = (steer !== 0 && steer !== p.prevSteer) || justLeft || justRight;
        const justThrottleChange = (throttle !== 0 && throttle !== p.prevThrottle) || justUp || justDown;
        const freshDirection = justSteerChange || justThrottleChange;

        if (steer !== 0 || throttle !== 0) {
          p.moveHoldTimer += dt;
        } else {
          p.moveHoldTimer = 0;
        }
        const holdRepeat = p.moveHoldTimer >= 0.38;

        const wantsHop = (freshDirection || holdRepeat || justAction) && p.hopCooldown <= 0;

        if (wantsHop) {
          let hopDx = 0;
          let hopDy = 0;

          if (steer !== 0 || throttle !== 0 || justLeft || justRight || justUp || justDown) {
            let dirX = steer;
            if (justRight) dirX = 1;
            else if (justLeft) dirX = -1;

            let dirY = -throttle;
            if (justUp) dirY = -1;
            else if (justDown) dirY = 1;

            hopDx = dirX;
            hopDy = dirY;
            this.handleDirectionalHop(p, hopDx, hopDy, true);
          } else {
            hopDx = Math.cos(p.angle);
            hopDy = Math.sin(p.angle);
            this.handleDirectionalHop(p, hopDx, hopDy, false);
          }
        }

        p.prevSteer = steer;
        p.prevThrottle = throttle;
      }
    }
  }

  private handleDirectionalHop(p: MagmaPlayer, dirX: number, dirY: number, isExplicitDirection: boolean): void {
    const mag = Math.hypot(dirX, dirY);
    if (mag > 0) {
      dirX /= mag;
      dirY /= mag;
    }
    const targetAngle = Math.atan2(dirY, dirX);
    p.angle = targetAngle;

    const neighbors = this.pillars.filter((pil) => {
      if (pil.id === p.currentPillarId) return false;
      const d = Math.hypot(pil.x - p.x, pil.y - p.y);
      return d >= 35 && d <= (p.isUnderdog ? 220 : 190);
    });

    let bestNeighbor: BasaltPillar | null = null;
    let bestScore = -Infinity;

    for (const nb of neighbors) {
      const angleToNb = Math.atan2(nb.y - p.y, nb.x - p.x);
      let diff = angleToNb - targetAngle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      if (Math.abs(diff) < (Math.PI * 0.45)) {
        const align = Math.cos(diff);
        const dist = Math.hypot(nb.x - p.x, nb.y - p.y);
        const score = align * 100 - (dist / 190) * 20;
        if (score > bestScore) {
          bestScore = score;
          bestNeighbor = nb;
        }
      }
    }

    if (!bestNeighbor && !isExplicitDirection && neighbors.length > 0) {
      const safeNeighbors = neighbors.filter((n) => n.state === 'solid' && n.geyserActiveTimer <= 0);
      const candidates = safeNeighbors.length > 0 ? safeNeighbors : neighbors;
      bestNeighbor = candidates.reduce((prev, curr) => {
        const dPrev = Math.hypot(prev.x - p.x, prev.y - p.y);
        const dCurr = Math.hypot(curr.x - p.x, curr.y - p.y);
        return dCurr < dPrev ? curr : prev;
      });
    }

    if (bestNeighbor) {
      this.startHop(p, bestNeighbor.id, bestNeighbor.x, bestNeighbor.y);
    } else if (isExplicitDirection) {
      const lavaLandingX = p.x + dirX * 125;
      const lavaLandingY = p.y + dirY * 125;
      this.startHop(p, null, lavaLandingX, lavaLandingY);
    }
  }

  private startHop(p: MagmaPlayer, targetPillarId: number | null, tx: number, ty: number): void {
    p.isHopping = true;
    p.hopProgress = 0;
    p.hopDuration = p.isUnderdog ? 0.28 : 0.34;
    p.hopStartX = p.x;
    p.hopStartY = p.y;
    p.hopTargetX = tx;
    p.hopTargetY = ty;
    p.hopTargetPillarId = targetPillarId;
    p.angle = Math.atan2(ty - p.y, tx - p.x);

    this.audio.playTap();
    this.particles.spawnSparks(p.x, p.y, '#FF8C00', 6);
  }

  private onPlayerLanded(p: MagmaPlayer): void {
    let landingPillar: BasaltPillar | null = null;
    if (p.hopTargetPillarId !== null) {
      landingPillar = this.pillars.find((x) => x.id === p.hopTargetPillarId) || null;
    }

    if (!landingPillar) {
      landingPillar = this.findNearestPillar(p.x, p.y);
      const dist = landingPillar ? Math.hypot(p.x - landingPillar.x, p.y - landingPillar.y) : 999;
      if (!landingPillar || dist > landingPillar.radius + 6) {
        landingPillar = null;
      }
    }

    if (!landingPillar || landingPillar.state === 'submerged') {
      this.damagePlayer(p, 'Fell into Molten Lava!');
    } else if (landingPillar.geyserActiveTimer > 0) {
      this.damagePlayer(p, 'Scorched by Magma Geyser!');
    } else {
      p.currentPillarId = landingPillar.id;
      p.x = landingPillar.x;
      p.y = landingPillar.y;
      p.hopStreak++;

      // Streak points
      const streakPoints = Math.min(50, 10 + p.hopStreak * 5);
      p.score += streakPoints;

      this.audio.playTap();
      this.particles.spawnSparks(landingPillar.x, landingPillar.y, '#FFA500', 8);

      // Check if another player was already standing on this pillar: SHOVE THEM!
      for (const other of this.magmaPlayers.values()) {
        if (other.id !== p.id && other.isAlive && other.currentPillarId === landingPillar.id && !other.isHopping) {
          this.shovePlayer(p, other, landingPillar);
        }
      }

      if (landingPillar.hasCrystal) {
        landingPillar.hasCrystal = false;
        p.score += 100;
        p.crystalsCollected += 1;
        this.audio.playScore();
        this.particles.spawnSparks(landingPillar.x, landingPillar.y, '#F59E0B', 18);
        this.particles.showFloatingText('CRYSTAL! +100 💎', landingPillar.x, landingPillar.y - 28, '#F59E0B', 18);
      }

      if (landingPillar.state === 'solid') {
        landingPillar.state = 'cracking';
        landingPillar.stateTimer = p.isUnderdog ? 2.8 : 1.8;
      }
    }
  }

  private shovePlayer(shover: MagmaPlayer, victim: MagmaPlayer, pillar: BasaltPillar): void {
    victim.hitStunTimer = 0.35;
    this.audio.playBounce();
    this.particles.addTrauma(0.2);
    this.particles.spawnSparks(victim.x, victim.y, '#FFFFFF', 10);
    this.particles.showFloatingText('SHOVE! 💥', victim.x, victim.y - 30, '#EF4444', 18);

    // Find candidate neighbor for victim to flee to, or shove off stone
    const shoveAngle = Math.atan2(victim.y - shover.y, victim.x - shover.x) || (Math.random() * Math.PI * 2);
    const neighbors = this.pillars.filter(
      (pil) => pil.id !== pillar.id && Math.hypot(pil.x - victim.x, pil.y - victim.y) <= 180
    );

    let bestNb: BasaltPillar | null = null;
    let bestAlign = -Infinity;
    for (const nb of neighbors) {
      const a = Math.atan2(nb.y - victim.y, nb.x - victim.x);
      const align = Math.cos(a - shoveAngle);
      if (align > bestAlign) {
        bestAlign = align;
        bestNb = nb;
      }
    }

    if (bestNb && bestAlign > 0.3) {
      this.startHop(victim, bestNb.id, bestNb.x, bestNb.y);
    } else {
      // Displaced to outer lip of pillar
      victim.x = pillar.x + Math.cos(shoveAngle) * (pillar.radius * 0.85);
      victim.y = pillar.y + Math.sin(shoveAngle) * (pillar.radius * 0.85);
    }
  }

  private checkStandingPillar(p: MagmaPlayer, dt: number): void {
    if (p.currentPillarId === null) return;
    const pil = this.pillars.find((x) => x.id === p.currentPillarId);
    if (!pil) return;

    if (pil.state === 'submerged') {
      this.damagePlayer(p, 'Pillar Submerged!');
    } else if (pil.state === 'cracking') {
      p.score += dt * 15;
    }
  }

  private damagePlayer(p: MagmaPlayer, _reason: string): void {
    if (p.invulnerableTimer > 0 || !p.isAlive) return;

    p.lives -= 1;
    p.hopStreak = 0;
    this.audio.playExplosion();
    this.particles.shake(8);
    this.particles.spawnExplosion(p.x, p.y, '#FF4500', 22);

    if (p.lives <= 0) {
      p.isAlive = false;
      p.z = 0;
      p.isHopping = false;
      this.particles.showFloatingText('OUT! 💀', p.x, p.y - 20, '#EF4444', 24);
    } else {
      p.invulnerableTimer = 1.6;
      p.isHopping = false;
      p.z = 0;

      const solidPillars = this.pillars.filter((pil) => pil.state === 'solid' && pil.geyserActiveTimer <= 0);
      const respawnPil = solidPillars.length > 0
        ? solidPillars[Math.floor(Math.random() * solidPillars.length)]
        : this.pillars[0];

      if (respawnPil) {
        p.currentPillarId = respawnPil.id;
        p.x = respawnPil.x;
        p.y = respawnPil.y;
      }
      this.particles.showFloatingText(`-1 LIFE (${p.lives} ❤️ LEFT)`, p.x, p.y - 30, '#F87171', 18);
    }
  }

  private findNearestPillar(x: number, y: number): BasaltPillar | null {
    let nearest: BasaltPillar | null = null;
    let minD = Infinity;
    for (const pil of this.pillars) {
      const d = Math.hypot(pil.x - x, pil.y - y);
      if (d < minD) {
        minD = d;
        nearest = pil;
      }
    }
    return nearest;
  }

  protected updateBotAI(
    _dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const bot = this.magmaPlayers.get(botId);
    if (!bot || !bot.isAlive || bot.isHopping) return;

    const currentPil = this.pillars.find((x) => x.id === bot.currentPillarId);
    const mustFlee = currentPil && (currentPil.state === 'cracking' || currentPil.geyserWarningTimer > 0);

    const candidates = this.pillars.filter((pil) => {
      if (pil.id === bot.currentPillarId) return false;
      if (pil.state === 'submerged') return false;
      const d = Math.hypot(pil.x - bot.x, pil.y - bot.y);
      return d >= 35 && d <= 190;
    });

    if (candidates.length === 0) return;

    let bestPillar: BasaltPillar | null = null;
    let bestScore = -Infinity;

    for (const cand of candidates) {
      let score = 100;
      if (cand.state === 'solid') score += 80;
      if (cand.state === 'rising') score += 40;
      if (cand.hasCrystal) score += 60;
      if (cand.geyserWarningTimer > 0 || cand.geyserActiveTimer > 0) score -= 200;

      const dist = Math.hypot(cand.x - bot.x, cand.y - bot.y);
      score -= (dist / 175) * 15;

      if (difficulty === 'bot_easy') {
        score += (Math.random() - 0.5) * 60;
      }

      if (score > bestScore) {
        bestScore = score;
        bestPillar = cand;
      }
    }

    if (bestPillar && (mustFlee || bestScore > 110 || Math.random() < 0.45)) {
      this.startHop(bot, bestPillar.id, bestPillar.x, bestPillar.y);
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const scores = active.map((p) => {
      const mp = this.magmaPlayers.get(p.id);
      const finalScore = mp ? Math.round(mp.score + mp.lives * 150) : 0;
      return {
        playerId: p.id,
        score: finalScore,
        crystals: mp?.crystalsCollected || 0,
        lives: mp?.lives || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);

    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topCrystals = scores[0]?.crystals || 0;
    const winnerName = winnerId !== null ? (this.getPlayer(winnerId)?.name || 'Player') : '';
    const mvpHighlight = winnerId !== null
      ? `${winnerName} MASTERED THE BASALT PILLARS WITH ${topCrystals} CRYSTALS!`
      : 'ALL JUMPERS CONSUMED BY MOLTEN FURY!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const theme = MAGMA_THEMES[this.currentThemeIndex];
    const isSuddenDeath = this.roundTimer <= 15;

    // 1. Magma / Swamp / Ice Sea
    const lavaGrad = ctx.createLinearGradient(0, 0, width, height);
    lavaGrad.addColorStop(0, theme.lavaGradStart);
    lavaGrad.addColorStop(0.5, theme.lavaGradMid);
    lavaGrad.addColorStop(1, theme.lavaGradEnd);
    ctx.fillStyle = lavaGrad;
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.fillStyle = theme.waveColor;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      const waveY = (height / 6) * i + Math.sin(this.lavaOffset + i) * 16;
      ctx.ellipse(width * 0.5, waveY, width * 0.55, 28, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. Pillars
    for (const pil of this.pillars) {
      this.renderPillar(ctx, pil, theme);
    }

    // 3. Mascot Players
    for (const p of this.magmaPlayers.values()) {
      if (!p.isAlive) continue;
      this.renderPlayer(ctx, p);
    }

    // 4. Header Instruction Badge (y: 56)
    ctx.save();
    const pillW = 440;
    const pillH = 26;
    const pillX = width / 2 - pillW / 2;
    const pillY = 56;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 13);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isSuddenDeath ? '#F87171' : '#FFFFFF';
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      isSuddenDeath
        ? '🌋 MAGMA SURGE! PERIMETER PILLARS COLLAPSING! 🌋'
        : 'HOP TO STONES • COLLECT CRYSTALS • SHOVE RIVALS OFF!',
      width / 2,
      pillY + pillH / 2
    );
    ctx.restore();

    // 5. Interactive Bottom-Left Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(20, height - 44, 170, 32, 16);
    else ctx.rect(20, height - 44, 170, 32);
    ctx.fill();
    ctx.strokeStyle = theme.themePillColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.themePillColor;
    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${theme.name} [T]`, 20 + 85, height - 44 + 16);
    ctx.restore();

    // 6. On-screen Controls Pill (Offset to right, never overlapping theme pill)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.font = '600 11px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('WASD / Arrows: Aim & Hop | Tap: Jump', width - 24, height - 28);
    ctx.restore();

    ctx.restore();
  }

  private renderPillar(ctx: CanvasRenderingContext2D, pil: BasaltPillar, theme: MagmaTheme): void {
    ctx.save();
    const px = pil.x + pil.shakeOffset;
    const py = pil.y;

    if (pil.state === 'submerged') {
      ctx.fillStyle = '#FF3B00';
      ctx.beginPath();
      ctx.arc(px, py, pil.radius * 0.7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFE600';
      ctx.beginPath();
      ctx.arc(px, py, pil.radius * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    const sinkDepth = pil.state === 'cracking' ? pil.crackLevel * 8 : (pil.state === 'rising' ? 8 : 0);
    const renderY = py + sinkDepth;

    ctx.fillStyle = theme.pillarSide;
    ctx.beginPath();
    ctx.ellipse(px, renderY + 12, pil.radius, pil.radius * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();

    const topGrad = ctx.createRadialGradient(px, renderY - 4, 4, px, renderY, pil.radius);
    if (pil.state === 'cracking') {
      topGrad.addColorStop(0, theme.pillarTopCrackStart);
      topGrad.addColorStop(0.7, '#2D1B18');
      topGrad.addColorStop(1, '#180E0C');
    } else {
      topGrad.addColorStop(0, theme.pillarTopSolidStart);
      topGrad.addColorStop(0.7, theme.pillarTopSolidMid);
      topGrad.addColorStop(1, theme.pillarTopSolidEnd);
    }

    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.ellipse(px, renderY, pil.radius, pil.radius * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = pil.state === 'cracking' ? theme.pillarRimCrack : theme.pillarRimSolid;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    if (pil.crackLevel > 0) {
      ctx.strokeStyle = '#FFAA00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px - pil.radius * 0.4, renderY - 8);
      ctx.lineTo(px, renderY);
      ctx.lineTo(px + pil.radius * 0.5, renderY + 6);
      ctx.moveTo(px, renderY);
      ctx.lineTo(px - 6, renderY + 14);
      ctx.stroke();
    }

    if (pil.geyserWarningTimer > 0) {
      ctx.fillStyle = 'rgba(255, 69, 0, 0.55)';
      ctx.beginPath();
      ctx.ellipse(px, renderY, pil.radius * 0.8, pil.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (pil.geyserActiveTimer > 0) {
      const plumeGrad = ctx.createLinearGradient(px, renderY, px, renderY - 95);
      plumeGrad.addColorStop(0, 'rgba(255, 200, 0, 0.9)');
      plumeGrad.addColorStop(0.5, 'rgba(255, 60, 0, 0.85)');
      plumeGrad.addColorStop(1, 'rgba(200, 0, 0, 0)');
      ctx.fillStyle = plumeGrad;
      ctx.beginPath();
      ctx.moveTo(px - pil.radius * 0.6, renderY);
      ctx.lineTo(px - pil.radius * 0.2, renderY - 95);
      ctx.lineTo(px + pil.radius * 0.2, renderY - 95);
      ctx.lineTo(px + pil.radius * 0.6, renderY);
      ctx.closePath();
      ctx.fill();
    }

    if (pil.hasCrystal) {
      const crystalBob = Math.sin(this.lavaOffset * 3 + pil.id) * 4;
      const cy = renderY - 14 + crystalBob;

      ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.beginPath();
      ctx.arc(px, cy, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = theme.crystalColor;
      ctx.beginPath();
      ctx.moveTo(px, cy - 10);
      ctx.lineTo(px + 7, cy);
      ctx.lineTo(px, cy + 10);
      ctx.lineTo(px - 7, cy);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = theme.crystalHighlight;
      ctx.beginPath();
      ctx.moveTo(px, cy - 10);
      ctx.lineTo(px + 4, cy);
      ctx.lineTo(px, cy + 4);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, p: MagmaPlayer): void {
    const isBot = this.players[p.id]?.type.startsWith('bot_') ?? false;

    ctx.save();
    const shadowScale = Math.max(0.3, 1 - p.z / 90);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 4, 14 * shadowScale, 8 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (p.invulnerableTimer > 0 && Math.floor(p.invulnerableTimer * 12) % 2 === 0) {
      ctx.restore();
      return;
    }

    const renderY = p.y - p.z;

    // Underdog golden aura
    if (p.isUnderdog) {
      ctx.save();
      ctx.strokeStyle = '#F59E0B';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(p.x, renderY, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    let mood: CharacterMood = 'focused';
    if (p.hitStunTimer > 0) {
      mood = 'shocked';
    } else if (p.isHopping || p.crystalsCollected > 0) {
      mood = 'happy';
    } else if (this.isFinished) {
      mood = 'triumph';
    }

    drawCharacter(ctx, p.x, renderY - 8, 14, p.id, isBot, mood, this.animTimer);

    // Hearts & Score Badge Above Player
    ctx.save();
    ctx.textAlign = 'center';
    let heartsStr = '';
    for (let h = 0; h < p.lives; h++) heartsStr += '❤️';
    ctx.font = '10px sans-serif';
    ctx.fillText(heartsStr, p.x, renderY - 26);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 10px Montserrat, sans-serif';
    ctx.fillText(`${p.score} PTS`, p.x, renderY - 37);
    ctx.restore();

    ctx.restore();
  }
}

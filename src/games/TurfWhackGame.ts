import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';
import { CharacterMood } from '../core/CharacterRenderer';

export interface TurfTheme {
  name: string;
  lawnTop: string;
  lawnMid: string;
  lawnBot: string;
  gridLineColor: string;
  fenceColor: string;
  soilOuter: string;
  soilInner: string;
  bannerBorder: string;
  bannerText: string;
  themePillColor: string;
}

export const TURF_THEMES: TurfTheme[] = [
  {
    name: 'Backyard Garden 🌻',
    lawnTop: '#15803D',
    lawnMid: '#166534',
    lawnBot: '#14532D',
    gridLineColor: 'rgba(255, 255, 255, 0.05)',
    fenceColor: '#F8FAFC',
    soilOuter: '#78350F',
    soilInner: '#1C1917',
    bannerBorder: '#10B981',
    bannerText: '#A7F3D0',
    themePillColor: '#10B981'
  },
  {
    name: 'Neon Arcade Whack ⚡',
    lawnTop: '#0F172A',
    lawnMid: '#1E1B4B',
    lawnBot: '#020617',
    gridLineColor: 'rgba(56, 189, 248, 0.12)',
    fenceColor: '#38BDF8',
    soilOuter: '#312E81',
    soilInner: '#090514',
    bannerBorder: '#38BDF8',
    bannerText: '#7DD3FC',
    themePillColor: '#38BDF8'
  },
  {
    name: 'Lunar Crater 🌕',
    lawnTop: '#334155',
    lawnMid: '#1E293B',
    lawnBot: '#0F172A',
    gridLineColor: 'rgba(248, 250, 252, 0.06)',
    fenceColor: '#CBD5E1',
    soilOuter: '#475569',
    soilInner: '#020617',
    bannerBorder: '#F59E0B',
    bannerText: '#FDE68A',
    themePillColor: '#F59E0B'
  }
];

interface Hole {
  id: number;
  x: number;
  y: number;
  occupant: 'none' | 'mole' | 'gold_mole' | 'tnt';
  popTimer: number; // time remaining up
  popProgress: number; // 0 to 1 for smooth rise/sink animation
  ownerQuadrant: number; // 0: TL, 1: TR, 2: BL, 3: BR
}

interface MalletPlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetHoleId: number | null;
  score: number;
  combo: number;
  isWhacking: boolean;
  whackAnim: number; // 0 to 1
  stunTimer: number;
  isUnderdog: boolean;
  recentMood: CharacterMood;
  moodTimer: number;
}

interface BotTargetState {
  targetHoleId: number | null;
  reactionDelay: number;
  hesitateTimer: number;
  isTrickedByTnt: boolean;
}

export class TurfWhackGame extends BaseGame {
  private holes: Hole[] = [];
  private mallets: Map<PlayerId, MalletPlayer> = new Map();
  private spawnCooldown: number = 0;
  private botStates: Map<PlayerId, BotTargetState> = new Map();

  // Themes and Listeners
  private currentThemeIndex: number = 0;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private pointerdownListener: ((e: PointerEvent) => void) | null = null;

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  public destroy(): void {
    this.removeListeners();
    super.destroy();
    if (typeof window !== 'undefined' && (window as unknown as { __TURF_WHACK_DEBUG__?: unknown }).__TURF_WHACK_DEBUG__) {
      delete (window as unknown as { __TURF_WHACK_DEBUG__?: unknown }).__TURF_WHACK_DEBUG__;
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isFinished) return;
      if (e.code === 'KeyT') {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % TURF_THEMES.length;
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

      // Theme pill is at x: 20, y: canvas.height - 44, w: 170, h: 32
      if (clickX >= 20 && clickX <= 190 && clickY >= canvas.height - 44 && clickY <= canvas.height - 12) {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % TURF_THEMES.length;
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
    this.roundTimer = 45;
    this.isFinished = false;
    this.holes = [];
    this.mallets.clear();
    this.botStates.clear();
    this.spawnCooldown = 0.5;

    // Create 8 burrow holes arranged in a 2-ring pattern
    const cx = width / 2;
    const cy = height / 2 + 10;
    const innerRadius = Math.min(width, height) * 0.22;
    const outerRadius = Math.min(width, height) * 0.36;

    // 4 inner ring holes
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2 + Math.PI / 4;
      this.holes.push({
        id: i,
        x: cx + Math.cos(angle) * innerRadius,
        y: cy + Math.sin(angle) * innerRadius,
        occupant: 'none',
        popTimer: 0,
        popProgress: 0,
        ownerQuadrant: i
      });
    }

    // 4 outer ring holes
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      this.holes.push({
        id: 4 + i,
        x: cx + Math.cos(angle) * outerRadius,
        y: cy + Math.sin(angle) * outerRadius,
        occupant: 'none',
        popTimer: 0,
        popProgress: 0,
        ownerQuadrant: i
      });
    }

    // Setup mallet players
    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      const defaultHole = this.holes[idx % this.holes.length];
      this.mallets.set(p.id, {
        id: p.id,
        x: defaultHole.x,
        y: defaultHole.y - 20,
        vx: 0,
        vy: 0,
        targetHoleId: defaultHole.id,
        score: 0,
        combo: 0,
        isWhacking: false,
        whackAnim: 0,
        stunTimer: 0,
        isUnderdog: false,
        recentMood: 'focused',
        moodTimer: 0
      });
    });

    // Expose debug harness
    (window as unknown as { __TURF_WHACK_DEBUG__?: unknown }).__TURF_WHACK_DEBUG__ = {
      getMallets: () =>
        Array.from(this.mallets.values()).map((m) => ({
          id: m.id,
          x: m.x,
          y: m.y,
          score: m.score,
          isWhacking: m.isWhacking,
          stunTimer: m.stunTimer
        })),
      getHoles: () =>
        this.holes.map((h) => ({
          id: h.id,
          x: h.x,
          y: h.y,
          occupant: h.occupant,
          popProgress: h.popProgress,
          popTimer: h.popTimer
        })),
      popMoleAtHole: (holeId: number, occupant: 'mole' | 'gold_mole' | 'tnt') => {
        const h = this.holes.find((item) => item.id === holeId);
        if (h) {
          h.occupant = occupant;
          h.popProgress = 1.0;
          h.popTimer = 5.0;
        }
      },
      getHitRadius: () => 88
    };
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    const isSuddenDeath = this.roundTimer <= 15;

    // Underdog check: trailing behind leader by >= 6 points
    let maxScore = 0;
    for (const m of this.mallets.values()) {
      if (m.score > maxScore) maxScore = m.score;
    }
    for (const m of this.mallets.values()) {
      m.isUnderdog = maxScore >= 6 && m.score <= maxScore - 6;
      if (m.moodTimer > 0) {
        m.moodTimer -= dt;
      } else {
        m.recentMood = m.stunTimer > 0 ? 'shocked' : 'focused';
      }
    }

    // Spawn new pop-up occupants (Accelerated during Sudden Death)
    this.spawnCooldown -= dt;
    const maxActiveMoles = isSuddenDeath ? 5 : 4;
    const activeMoles = this.holes.filter((h) => h.occupant !== 'none').length;
    if (this.spawnCooldown <= 0 && activeMoles < maxActiveMoles) {
      this.spawnMole(isSuddenDeath);
      this.spawnCooldown = isSuddenDeath ? 0.35 + Math.random() * 0.45 : 0.6 + Math.random() * 0.8;
    }

    // Update holes animation & pop duration
    for (const hole of this.holes) {
      if (hole.occupant !== 'none') {
        hole.popTimer -= dt;
        hole.popProgress = Math.min(1.0, hole.popProgress + dt * (isSuddenDeath ? 7 : 5));

        if (hole.popTimer <= 0) {
          // Retract
          hole.popProgress -= dt * 6;
          if (hole.popProgress <= 0) {
            hole.occupant = 'none';
            hole.popProgress = 0;
          }
        }
      } else {
        hole.popProgress = 0;
      }
    }

    // Update player mallets, movement, and whacks
    for (const m of this.mallets.values()) {
      if (m.stunTimer > 0) {
        m.stunTimer -= dt;
      }

      // Apply damping to velocity kickbacks
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.vx *= Math.pow(0.04, dt);
      m.vy *= Math.pow(0.04, dt);

      const isBot = this.players[m.id]?.type.startsWith('bot_');

      // Human Movement Controls (WASD / Arrows / Joystick / Touch)
      if (!isBot && m.stunTimer <= 0) {
        const steerX = this.input.getSteer(m.id);
        const steerY = -this.input.getThrottle(m.id); // W is UP (-Y), S is DOWN (+Y)
        const mag = Math.hypot(steerX, steerY);

        const baseSpeed = 430 * (m.isUnderdog ? 1.15 : 1.0);
        if (mag > 0.08) {
          m.x += (steerX / (mag > 1 ? mag : 1)) * baseSpeed * dt;
          m.y += (steerY / (mag > 1 ? mag : 1)) * baseSpeed * dt;
        } else {
          // Single-button / touch hold fallback: float toward nearest popped mole
          if (this.input.isPressed(m.id)) {
            const targetHole = this.holes
              .filter((h) => h.occupant === 'mole' || h.occupant === 'gold_mole')
              .sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0];
            if (targetHole) {
              const dx = targetHole.x - m.x;
              const dy = targetHole.y - m.y;
              const d = Math.hypot(dx, dy);
              if (d > 10) {
                m.x += (dx / (d || 0.001)) * 280 * dt;
                m.y += (dy / (d || 0.001)) * 280 * dt;
              }
            }
          }
        }
      }

      // Constrain mallet within lawn boundaries
      const margin = 36;
      m.x = Math.max(margin, Math.min(width - margin, m.x));
      m.y = Math.max(margin + 40, Math.min(height - margin, m.y));

      // Check player swing tap (Space / Enter / Primary action / Tap)
      const justAction = this.input.justAction(m.id);
      const justPressed = this.input.justPressed(m.id);
      const pressed =
        (justAction || (justPressed && !this.input.getSteer(m.id) && !this.input.getThrottle(m.id))) &&
        m.stunTimer <= 0;

      if (pressed && !m.isWhacking) {
        m.isWhacking = true;
        m.whackAnim = 0;
        this.audio.playTap();
        this.checkMalletHit(m);
      }

      // Whack animation (punchy wide swing)
      if (m.isWhacking) {
        m.whackAnim += dt * 5.5;
        if (m.whackAnim >= 1) {
          m.isWhacking = false;
          m.whackAnim = 0;
        }
      }
    }

    // Inter-Player Mallet-to-Mallet Physical Collision Bumping
    const malletList = Array.from(this.mallets.values());
    for (let i = 0; i < malletList.length; i++) {
      for (let j = i + 1; j < malletList.length; j++) {
        const m1 = malletList[i];
        const m2 = malletList[j];
        const dx = m2.x - m1.x;
        const dy = m2.y - m1.y;
        const dist = Math.hypot(dx, dy);
        const minGap = 56;

        if (dist < minGap && dist > 0.001) {
          const overlap = minGap - dist;
          const nx = dx / dist;
          const ny = dy / dist;

          m1.x -= nx * overlap * 0.5;
          m1.y -= ny * overlap * 0.5;
          m2.x += nx * overlap * 0.5;
          m2.y += ny * overlap * 0.5;

          // Clang rebound impulses
          const impulse = 320;
          m1.vx = -nx * impulse;
          m1.vy = -ny * impulse;
          m2.vx = nx * impulse;
          m2.vy = ny * impulse;

          this.audio.playLaser();
          this.particles.spawnSparks((m1.x + m2.x) / 2, (m1.y + m2.y) / 2, '#FFFFFF', 8);

          // Momentary shocked reaction
          m1.recentMood = 'shocked';
          m1.moodTimer = 0.5;
          m2.recentMood = 'shocked';
          m2.moodTimer = 0.5;
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private spawnMole(isSuddenDeath: boolean): void {
    const emptyHoles = this.holes.filter((h) => h.occupant === 'none');
    if (emptyHoles.length === 0) return;

    const chosen = emptyHoles[Math.floor(Math.random() * emptyHoles.length)];
    const roll = Math.random();

    if (isSuddenDeath) {
      // Sudden Death: 60% Golden Moles, 25% TNT hazards, 15% standard
      if (roll < 0.60) {
        chosen.occupant = 'gold_mole';
        chosen.popTimer = 1.0;
      } else if (roll < 0.85) {
        chosen.occupant = 'tnt';
        chosen.popTimer = 1.4;
      } else {
        chosen.occupant = 'mole';
        chosen.popTimer = 1.2;
      }
    } else {
      if (roll < 0.20) {
        chosen.occupant = 'tnt'; // Dynamite hazard
        chosen.popTimer = 1.8;
      } else if (roll < 0.45) {
        chosen.occupant = 'gold_mole'; // Bonus golden mole
        chosen.popTimer = 1.2;
      } else {
        chosen.occupant = 'mole'; // Standard mole
        chosen.popTimer = 1.5;
      }
    }
    chosen.popProgress = 0.1;
  }

  private checkMalletHit(m: MalletPlayer): void {
    // Underdog Mega-Mallet surge expands hit radius from 88 to 115!
    const hitRadius = m.isUnderdog ? 115 : 88;
    let hitAny = false;

    // Find all popped holes within hitRadius, sorted closest first
    const activeMoles = this.holes
      .filter((h) => h.occupant !== 'none' && h.popProgress >= 0.2)
      .map((h) => ({ hole: h, dist: Math.hypot(h.x - m.x, h.y - m.y) }))
      .filter((item) => item.dist < hitRadius)
      .sort((a, b) => a.dist - b.dist);

    if (activeMoles.length > 0) {
      const { hole } = activeMoles[0];
      hitAny = true;

      if (hole.occupant === 'tnt') {
        // Hit dynamite! BOOM
        m.score = Math.max(0, m.score - 2);
        m.combo = 0;
        m.stunTimer = 1.5;
        m.recentMood = 'shocked';
        m.moodTimer = 1.5;
        this.audio.playExplosion();
        this.particles.showFloatingText('-2 PTS! TNT BOOM! 💥', m.x, m.y - 45, '#EF4444', 22);
        this.particles.spawnSparks(hole.x, hole.y, '#EF4444', 24);
        this.particles.addTrauma(0.35);
      } else if (hole.occupant === 'gold_mole') {
        // Golden Mole! Combo ramp
        m.combo = Math.min(5, m.combo + 1);
        const comboMultiplier = m.combo >= 4 ? 2.0 : m.combo >= 2 ? 1.5 : 1.0;
        const pts = Math.round(3 * comboMultiplier);
        m.score += pts;
        m.recentMood = 'triumph';
        m.moodTimer = 0.9;
        this.audio.playFanfare();
        const comboTag = comboMultiplier > 1 ? ` (${comboMultiplier}X COMBO!)` : '';
        this.particles.showFloatingText(`+${pts} PTS! GOLDEN MOLE! 👑${comboTag}`, m.x, m.y - 45, '#F59E0B', 24);
        this.particles.spawnSparks(hole.x, hole.y, '#FBBF24', 22);
        this.particles.addTrauma(0.18);
      } else {
        // Standard Mole
        m.combo = Math.min(5, m.combo + 1);
        const comboMultiplier = m.combo >= 4 ? 2.0 : m.combo >= 2 ? 1.5 : 1.0;
        const pts = Math.round(1 * comboMultiplier);
        m.score += pts;
        m.recentMood = 'happy';
        m.moodTimer = 0.7;
        this.audio.playLaser();
        const comboTag = comboMultiplier > 1 ? ` (${comboMultiplier}X)` : '';
        this.particles.showFloatingText(`+${pts} PTS! WHACK!${comboTag}`, m.x, m.y - 45, '#10B981', 20);
        this.particles.spawnSparks(hole.x, hole.y, '#34D399', 16);
      }

      hole.occupant = 'none';
      hole.popProgress = 0;
    }

    if (!hitAny) {
      m.combo = 0;
      this.particles.spawnSparks(m.x, m.y, 'rgba(255,255,255,0.4)', 8);
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const m = this.mallets.get(botId);
    if (!m || m.stunTimer > 0) {
      this.input.setBotInput(botId, false);
      return;
    }

    let state = this.botStates.get(botId);
    if (!state) {
      state = { targetHoleId: null, reactionDelay: 0, hesitateTimer: -1, isTrickedByTnt: false };
      this.botStates.set(botId, state);
    }

    // Check if current target hole is still valid
    let currentTargetHole = state.targetHoleId !== null ? this.holes.find((h) => h.id === state.targetHoleId) : null;
    if (!currentTargetHole || currentTargetHole.occupant === 'none' || currentTargetHole.popProgress < 0.2) {
      state.targetHoleId = null;
    }

    // If bot has no active target, search for surfaced moles
    if (state.targetHoleId === null) {
      const candidates = this.holes.filter((h) => h.occupant !== 'none' && h.popProgress > 0.25);
      if (candidates.length === 0) {
        this.input.setBotInput(botId, false);
        return;
      }

      // Check TNT mistake chance: Easy = 35%, Normal = 16%, Hard = 4%
      const tntMistakeChance = difficulty === 'bot_easy' ? 0.35 : difficulty === 'bot_normal' ? 0.16 : 0.04;
      const isTricked = Math.random() < tntMistakeChance;
      state.isTrickedByTnt = isTricked;

      const validCandidates = candidates.filter((h) => {
        if (h.occupant === 'tnt') return isTricked;
        return true;
      });

      if (validCandidates.length === 0) {
        this.input.setBotInput(botId, false);
        return;
      }

      // Target selection: Hard bots prioritize gold moles; Normal and Easy prioritize closest
      let chosenHole = validCandidates[0];
      if (difficulty === 'bot_hard') {
        validCandidates.sort((a, b) => {
          if (a.occupant === 'gold_mole' && b.occupant !== 'gold_mole') return -1;
          if (b.occupant === 'gold_mole' && a.occupant !== 'gold_mole') return 1;
          return Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y);
        });
        chosenHole = validCandidates[0];
      } else {
        validCandidates.sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y));
        chosenHole = validCandidates[0];
      }

      state.targetHoleId = chosenHole.id;
      // Human-like reaction delay before starting to glide toward target
      state.reactionDelay =
        difficulty === 'bot_easy'
          ? 0.50 + Math.random() * 0.30
          : difficulty === 'bot_normal'
          ? 0.28 + Math.random() * 0.20
          : 0.12 + Math.random() * 0.10;
      state.hesitateTimer = -1;
    }

    // Reaction delay countdown
    if (state.reactionDelay > 0) {
      state.reactionDelay -= dt;
      this.input.setBotInput(botId, false);
      return;
    }

    currentTargetHole = this.holes.find((h) => h.id === state.targetHoleId);
    if (!currentTargetHole) {
      this.input.setBotInput(botId, false);
      return;
    }

    // Relaxed, beatable glide speeds: Easy = 165, Normal = 230, Hard = 340
    const glideSpeed =
      (difficulty === 'bot_hard' ? 340 : difficulty === 'bot_normal' ? 230 : 165) *
      (m.isUnderdog ? 1.15 : 1.0);
    const dx = currentTargetHole.x - m.x;
    const dy = currentTargetHole.y - m.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 8) {
      m.x += (dx / (dist || 0.001)) * glideSpeed * dt;
      m.y += (dy / (dist || 0.001)) * glideSpeed * dt;
    }

    // Within striking range (with wide swing, range is 64px)
    if (dist < 64) {
      if (state.hesitateTimer < 0) {
        state.hesitateTimer =
          difficulty === 'bot_easy'
            ? 0.35 + Math.random() * 0.22
            : difficulty === 'bot_normal'
            ? 0.18 + Math.random() * 0.14
            : 0.07 + Math.random() * 0.07;
      } else {
        state.hesitateTimer -= dt;
        if (state.hesitateTimer <= 0) {
          this.input.setBotInput(botId, true);
          state.targetHoleId = null;
          state.hesitateTimer = -1;
          return;
        }
      }
    }

    this.input.setBotInput(botId, false);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const theme = TURF_THEMES[this.currentThemeIndex];
    const isSuddenDeath = this.roundTimer <= 15;

    // 1. Dynamic Lawn / Floor
    const grassGrad = ctx.createLinearGradient(0, 0, 0, height);
    grassGrad.addColorStop(0, theme.lawnTop);
    grassGrad.addColorStop(0.5, theme.lawnMid);
    grassGrad.addColorStop(1, theme.lawnBot);
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, 0, width, height);

    // Mowed lawn / tile checkerboard strips
    ctx.fillStyle = theme.gridLineColor;
    const stripW = 60;
    for (let x = 0; x < width; x += stripW * 2) {
      ctx.fillRect(x, 0, stripW, height);
    }

    // Border Frame Fence
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : theme.fenceColor;
    ctx.lineWidth = isSuddenDeath ? 7 : 5;
    ctx.strokeRect(16, 16, width - 32, height - 32);

    // Sudden Death Pulsing Text at the top
    if (isSuddenDeath) {
      ctx.save();
      ctx.font = '900 13px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#EF4444';
      ctx.fillText('⚡ SUDDEN DEATH: GOLDEN MOLE FRENZY! (60% GOLD MOLES) ⚡', width / 2, 44);
      ctx.restore();
    }

    // 2. Render Burrow Holes with Dirt Mounds
    for (const hole of this.holes) {
      ctx.save();

      // Dirt Mound Rim
      ctx.fillStyle = theme.soilOuter;
      ctx.beginPath();
      ctx.ellipse(hole.x, hole.y + 6, 42, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      // Deep Dark Hole Cavity
      ctx.fillStyle = theme.soilInner;
      ctx.beginPath();
      ctx.ellipse(hole.x, hole.y, 34, 16, 0, 0, Math.PI * 2);
      ctx.fill();

      // 3. Render Hole Occupant (Smooth rise and sink animation)
      if (hole.occupant !== 'none' && hole.popProgress > 0) {
        const riseY = hole.y - hole.popProgress * 28;

        ctx.save();
        ctx.beginPath();
        // Clip to above the hole opening
        ctx.rect(hole.x - 40, hole.y - 60, 80, 60);
        ctx.clip();

        if (hole.occupant === 'tnt') {
          // Sizzling Dynamite Barrel
          ctx.fillStyle = '#DC2626';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(hole.x - 16, riseY - 14, 32, 28, 4);
          else ctx.rect(hole.x - 16, riseY - 14, 32, 28);
          ctx.fill();

          // Black banding straps
          ctx.fillStyle = '#18181B';
          ctx.fillRect(hole.x - 16, riseY - 8, 32, 4);
          ctx.fillRect(hole.x - 16, riseY + 4, 32, 4);

          // TNT Label
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '900 11px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('TNT', hole.x, riseY);

          // Sizzling Fuse Spark
          ctx.fillStyle = '#F59E0B';
          ctx.beginPath();
          ctx.arc(hole.x, riseY - 18, 5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Mole Body (Cute cartoon mole)
          const isGold = hole.occupant === 'gold_mole';
          ctx.fillStyle = isGold ? '#D97706' : '#57534E';
          ctx.beginPath();
          ctx.ellipse(hole.x, riseY, 22, 26, 0, 0, Math.PI * 2);
          ctx.fill();

          // Pink Snout & Nose
          ctx.fillStyle = '#F472B6';
          ctx.beginPath();
          ctx.ellipse(hole.x, riseY + 2, 8, 5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#831843';
          ctx.beginPath();
          ctx.arc(hole.x, riseY + 1, 2.5, 0, Math.PI * 2);
          ctx.fill();

          // Cute Eyes
          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(hole.x - 7, riseY - 6, 4, 0, Math.PI * 2);
          ctx.arc(hole.x + 7, riseY - 6, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0F172A';
          ctx.beginPath();
          ctx.arc(hole.x - 6, riseY - 6, 2, 0, Math.PI * 2);
          ctx.arc(hole.x + 6, riseY - 6, 2, 0, Math.PI * 2);
          ctx.fill();

          // Gold Crown or Miner Helmet
          if (isGold) {
            ctx.fillStyle = '#FBBF24';
            ctx.beginPath();
            ctx.moveTo(hole.x - 12, riseY - 16);
            ctx.lineTo(hole.x - 14, riseY - 26);
            ctx.lineTo(hole.x - 6, riseY - 20);
            ctx.lineTo(hole.x, riseY - 28);
            ctx.lineTo(hole.x + 6, riseY - 20);
            ctx.lineTo(hole.x + 14, riseY - 26);
            ctx.lineTo(hole.x + 12, riseY - 16);
            ctx.closePath();
            ctx.fill();
          } else {
            // Hardhat
            ctx.fillStyle = '#F59E0B';
            ctx.beginPath();
            ctx.ellipse(hole.x, riseY - 14, 16, 8, 0, Math.PI, 0);
            ctx.fill();
            ctx.fillRect(hole.x - 18, riseY - 15, 36, 3);
          }
        }

        ctx.restore();
      }

      ctx.restore();
    }

    // 4. Render Player Mallets & Character Mascots
    for (const m of this.mallets.values()) {
      ctx.save();
      const p = this.players[m.id];
      const pColor = p?.color || '#FFFFFF';

      // Underdog Mega-Mallet Golden Aura
      if (m.isUnderdog) {
        ctx.save();
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(m.x, m.y, 60, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = '#FBBF24';
        ctx.font = '800 10px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⭐ MEGA MALLET SURGE', m.x, m.y - 74);
      }

      // Wide dynamic cartoon swing arc (windup back to +25°, smash down to -70°)
      let slamAngle = 0;
      let slamOffsetY = 0;
      if (m.isWhacking) {
        if (m.whackAnim < 0.25) {
          const t = m.whackAnim / 0.25;
          slamAngle = t * 0.45;
          slamOffsetY = -t * 6;
        } else if (m.whackAnim < 0.65) {
          const t = (m.whackAnim - 0.25) / 0.40;
          slamAngle = 0.45 - t * 1.65;
          slamOffsetY = t * 20;
        } else {
          const t = (m.whackAnim - 0.65) / 0.35;
          slamAngle = -1.2 * (1 - t);
          slamOffsetY = 20 * (1 - t);
        }
      }

      ctx.translate(m.x, m.y + slamOffsetY);
      ctx.rotate(slamAngle);

      // Wide cartoon swing swoosh arc during downswing
      if (m.isWhacking && m.whackAnim >= 0.2 && m.whackAnim <= 0.75) {
        ctx.save();
        ctx.shadowColor = pColor;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(0, 0, m.isUnderdog ? 72 : 56, -1.3, 0.4);
        ctx.stroke();

        ctx.strokeStyle = pColor;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, m.isUnderdog ? 72 : 56, -1.2, 0.3);
        ctx.stroke();
        ctx.restore();
      }

      // Stun indicator
      if (m.stunTimer > 0) {
        ctx.save();
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💫 STUNNED!', 0, -50);
        ctx.restore();
      }

      // Hover shadow on lawn
      const hoverElev = m.isWhacking ? (1 - Math.sin(m.whackAnim * Math.PI)) * 16 : 16;
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-30 + hoverElev * 0.35, -30 + hoverElev, 60, 26, 8);
      else ctx.rect(-30 + hoverElev * 0.35, -30 + hoverElev, 60, 26);
      ctx.fill();
      ctx.restore();

      // Wooden Mallet Handle
      ctx.fillStyle = '#78350F';
      ctx.fillRect(-5, -12, 10, 58);

      // Mallet Hammer Head (Expanded if Underdog)
      const headW = m.isUnderdog ? 82 : 64;
      const headH = m.isUnderdog ? 36 : 28;
      ctx.fillStyle = pColor;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-headW / 2, -headH - 4, headW, headH, 8);
      else ctx.rect(-headW / 2, -headH - 4, headW, headH);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Striking Face Metal Bands
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(-headW / 2, -headH - 4, 8, headH);
      ctx.fillRect(headW / 2 - 8, -headH - 4, 8, headH);

      // Character Mascot Face on the Mallet Handle Base
      this.drawPlayerMascot(ctx, m.id, 0, 36, 14, m.recentMood, performance.now() * 0.001);

      // Score Pill
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(-36, 56, 72, 22, 11);
      else ctx.rect(-36, 56, 72, 22);
      ctx.fill();
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const comboText = m.combo >= 2 ? ` 🔥${m.combo}X` : '';
      ctx.fillText(`${m.score} PTS${comboText}`, 0, 67);

      ctx.restore();
    }

    // 5. Instruction Banner (Safely at y=56 below stopwatch timer)
    ctx.save();
    const pillW = 340;
    const pillH = 26;
    const pillX = width / 2 - pillW / 2;
    const pillY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 13);
    else ctx.rect(pillX, pillY, pillW, pillH);
    ctx.fill();
    ctx.strokeStyle = theme.bannerBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = theme.bannerText;
    ctx.font = '800 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WHACK MOLES • GOLD MOLE = 3 PTS • COMBO MULTIPLIERS!', width / 2, pillY + pillH / 2);
    ctx.restore();

    // 6. Interactive Bottom-Left Theme Pill (x: 20, y: height - 44, w: 170, h: 32)
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

    // 7. On-screen Controls Pill (Offset to right, never overlapping theme pill)
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.font = '600 11px Montserrat, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('WASD / Arrows to Move • Space / Enter to Whack • Shove Rivals!', width - 24, height - 28);
    ctx.restore();

    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const list = Array.from(this.mallets.values()).sort((a, b) => b.score - a.score);
    const winnerId = list.length > 0 ? list[0].id : null;
    return {
      winnerId,
      rankings: list.map((m, idx) => ({ playerId: m.id, score: m.score, place: idx + 1 })),
      mvpHighlight:
        winnerId !== null
          ? `${this.players[winnerId].name} whacked ${list[0].score} moles out of the yard with supreme combos!`
          : 'Garden tie!'
    };
  }
}

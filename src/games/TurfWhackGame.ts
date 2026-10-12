import { BaseGame } from './BaseGame';
import { PlayerId, RoundResult } from '../core/Types';

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
  targetHoleId: number | null;
  score: number;
  isWhacking: boolean;
  whackAnim: number; // 0 to 1
  stunTimer: number;
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

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 45;
    this.isFinished = false;
    this.holes = [];
    this.mallets.clear();
    this.botStates.clear();
    this.spawnCooldown = 0.5;

    // Create 8 burrow holes arranged in a 2-ring circular garden pattern
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
        targetHoleId: defaultHole.id,
        score: 0,
        isWhacking: false,
        whackAnim: 0,
        stunTimer: 0
      });
    });

    // Expose debug harness
    (window as any).__TURF_WHACK_DEBUG__ = {
      getMallets: () => Array.from(this.mallets.values()).map(m => ({
        id: m.id,
        x: m.x,
        y: m.y,
        score: m.score,
        isWhacking: m.isWhacking,
        stunTimer: m.stunTimer
      })),
      getHoles: () => this.holes.map(h => ({
        id: h.id,
        x: h.x,
        y: h.y,
        occupant: h.occupant,
        popProgress: h.popProgress,
        popTimer: h.popTimer
      })),
      popMoleAtHole: (holeId: number, occupant: 'mole' | 'gold_mole' | 'tnt') => {
        const h = this.holes.find(h => h.id === holeId);
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

    // Spawn new pop-up occupants
    this.spawnCooldown -= dt;
    const activeMoles = this.holes.filter((h) => h.occupant !== 'none').length;
    if (this.spawnCooldown <= 0 && activeMoles < 4) {
      this.spawnMole();
      this.spawnCooldown = 0.6 + Math.random() * 0.8;
    }

    // Update holes animation & pop duration
    for (const hole of this.holes) {
      if (hole.occupant !== 'none') {
        hole.popTimer -= dt;
        hole.popProgress = Math.min(1.0, hole.popProgress + dt * 5);

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

      const isBot = this.players[m.id]?.type.startsWith('bot_');

      // Human Movement Controls (WASD / Arrows / Joystick / Touch)
      if (!isBot && m.stunTimer <= 0) {
        const steerX = this.input.getSteer(m.id);
        const steerY = -this.input.getThrottle(m.id); // W is UP (-Y), S is DOWN (+Y)
        const mag = Math.hypot(steerX, steerY);

        if (mag > 0.08) {
          const moveSpeed = 430;
          m.x += (steerX / (mag > 1 ? mag : 1)) * moveSpeed * dt;
          m.y += (steerY / (mag > 1 ? mag : 1)) * moveSpeed * dt;
        } else {
          // Single-button / mobile hold fallback:
          // If holding action button without directional input, gently float toward nearest popped mole!
          if (this.input.isPressed(m.id)) {
            const targetHole = this.holes
              .filter((h) => h.occupant === 'mole' || h.occupant === 'gold_mole')
              .sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))[0];
            if (targetHole) {
              const dx = targetHole.x - m.x;
              const dy = targetHole.y - m.y;
              const d = Math.hypot(dx, dy);
              if (d > 10) {
                m.x += (dx / d) * 280 * dt;
                m.y += (dy / d) * 280 * dt;
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
      const pressed = (justAction || (justPressed && !this.input.getSteer(m.id) && !this.input.getThrottle(m.id))) && m.stunTimer <= 0;

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

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private spawnMole(): void {
    const emptyHoles = this.holes.filter((h) => h.occupant === 'none');
    if (emptyHoles.length === 0) return;

    const chosen = emptyHoles[Math.floor(Math.random() * emptyHoles.length)];
    const roll = Math.random();

    if (roll < 0.22) {
      chosen.occupant = 'tnt'; // Dynamite hazard
      chosen.popTimer = 1.8;
    } else if (roll < 0.45) {
      chosen.occupant = 'gold_mole'; // Bonus golden mole
      chosen.popTimer = 1.1;
    } else {
      chosen.occupant = 'mole'; // Standard mole
      chosen.popTimer = 1.5;
    }
    chosen.popProgress = 0.1;
  }

  private checkMalletHit(m: MalletPlayer): void {
    const hitRadius = 88; // Wide, generous swing radius!
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
        m.stunTimer = 1.6;
        this.audio.playExplosion();
        this.particles.showFloatingText('-2 PTS! TNT BOOM! 💥', m.x, m.y - 45, '#EF4444', 22);
        this.particles.spawnSparks(hole.x, hole.y, '#EF4444', 24);
        this.particles.addTrauma(0.35);
      } else if (hole.occupant === 'gold_mole') {
        // Golden Mole!
        m.score += 2;
        this.audio.playFanfare();
        this.particles.showFloatingText('+2 PTS! GOLDEN MOLE! 👑', m.x, m.y - 45, '#F59E0B', 24);
        this.particles.spawnSparks(hole.x, hole.y, '#FBBF24', 20);
      } else {
        // Standard Mole
        m.score += 1;
        this.audio.playLaser();
        this.particles.showFloatingText('+1 PTS! WHACK!', m.x, m.y - 45, '#10B981', 20);
        this.particles.spawnSparks(hole.x, hole.y, '#34D399', 16);
      }

      hole.occupant = 'none';
      hole.popProgress = 0;
    }

    if (!hitAny) {
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

      // Check TNT mistake chance: Easy = 40%, Normal = 18%, Hard = 5%
      const tntMistakeChance = difficulty === 'bot_easy' ? 0.40 : difficulty === 'bot_normal' ? 0.18 : 0.05;
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

      // Target selection:
      // Hard bots prioritize gold moles; Normal and Easy prioritize closest to play naturally
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
      state.reactionDelay = difficulty === 'bot_easy'
        ? 0.55 + Math.random() * 0.35
        : difficulty === 'bot_normal'
        ? 0.32 + Math.random() * 0.22
        : 0.14 + Math.random() * 0.10;
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

    // Relaxed, beatable glide speeds: Easy = 155, Normal = 220, Hard = 330
    const glideSpeed = difficulty === 'bot_hard' ? 330 : difficulty === 'bot_normal' ? 220 : 155;
    const dx = currentTargetHole.x - m.x;
    const dy = currentTargetHole.y - m.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 8) {
      m.x += (dx / dist) * glideSpeed * dt;
      m.y += (dy / dist) * glideSpeed * dt;
    }

    // Within striking range (with wide swing, range is 60px)
    if (dist < 60) {
      if (state.hesitateTimer < 0) {
        state.hesitateTimer = difficulty === 'bot_easy'
          ? 0.38 + Math.random() * 0.25
          : difficulty === 'bot_normal'
          ? 0.20 + Math.random() * 0.15
          : 0.08 + Math.random() * 0.08;
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

    // 1. Lush Backyard Garden Lawn
    const grassGrad = ctx.createLinearGradient(0, 0, 0, height);
    grassGrad.addColorStop(0, '#15803D');
    grassGrad.addColorStop(0.5, '#166534');
    grassGrad.addColorStop(1, '#14532D');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, 0, width, height);

    // Garden checkerboard cut lines
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    const stripW = 60;
    for (let x = 0; x < width; x += stripW * 2) {
      ctx.fillRect(x, 0, stripW, height);
    }

    // White Picket Fence Border Frame
    ctx.strokeStyle = '#F8FAFC';
    ctx.lineWidth = 6;
    ctx.strokeRect(16, 16, width - 32, height - 32);

    // 2. Render Burrow Holes with Dirt Mounds
    for (const hole of this.holes) {
      ctx.save();

      // Dirt Mound Rim
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.ellipse(hole.x, hole.y + 6, 42, 22, 0, 0, Math.PI * 2);
      ctx.fill();

      // Deep Dark Hole Cavity
      ctx.fillStyle = '#1C1917';
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
          ctx.roundRect(hole.x - 16, riseY - 14, 32, 28, 4);
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

    // 4. Render Player Mallets
    for (const m of this.mallets.values()) {
      ctx.save();
      const p = this.players[m.id];
      const pColor = p?.color || '#FFFFFF';

      // Wide dynamic cartoon swing arc (windup back to +25°, smash down to -70°)
      let slamAngle = 0;
      let slamOffsetY = 0;
      if (m.isWhacking) {
        if (m.whackAnim < 0.25) {
          // Wind up backward
          const t = m.whackAnim / 0.25;
          slamAngle = t * 0.45;
          slamOffsetY = -t * 6;
        } else if (m.whackAnim < 0.65) {
          // Power smash forward through wide 95 degree arc
          const t = (m.whackAnim - 0.25) / 0.40;
          slamAngle = 0.45 - t * 1.65; // from +0.45 down to -1.2 rad
          slamOffsetY = t * 20;
        } else {
          // Recovery
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
        ctx.arc(0, 0, 56, -1.3, 0.4);
        ctx.stroke();

        ctx.strokeStyle = pColor;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, 56, -1.2, 0.3);
        ctx.stroke();
        ctx.restore();
      }

      // Stun stars
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
      ctx.roundRect(-30 + hoverElev * 0.35, -30 + hoverElev, 60, 26, 8);
      ctx.fill();
      ctx.restore();

      // Wooden Mallet Handle (longer, sturdier grip)
      ctx.fillStyle = '#78350F';
      ctx.fillRect(-5, -12, 10, 58);

      // Mallet Hammer Head (wider and beefier: 64px wide x 28px high)
      ctx.fillStyle = pColor;
      ctx.beginPath();
      ctx.roundRect(-32, -32, 64, 28, 8);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Striking Face Metal Bands
      ctx.fillStyle = '#E2E8F0';
      ctx.fillRect(-32, -32, 8, 28);
      ctx.fillRect(24, -32, 8, 28);

      // Score Pill
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.roundRect(-32, 52, 64, 22, 11);
      ctx.fill();
      ctx.strokeStyle = pColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${m.score} PTS`, 0, 63);

      ctx.restore();
    }

    // 5. Instruction Banner (Safely at y=56 below stopwatch timer)
    ctx.save();
    const pillW = 290;
    const pillH = 26;
    const pillX = width / 2 - pillW / 2;
    const pillY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 13);
    ctx.fill();
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#A7F3D0';
    ctx.font = '800 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WHACK MOLES • GOLD MOLE = 2X • AVOID TNT!', width / 2, pillY + pillH / 2);
    ctx.restore();

    // 6. On-screen Controls Pill (Bottom of lawn)
    ctx.save();
    const hintW = Math.min(460, width - 40);
    const hintH = 22;
    const hintX = width / 2 - hintW / 2;
    const hintY = height - 32;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(hintX, hintY, hintW, hintH, 11);
    ctx.fill();
    ctx.strokeStyle = '#64748B';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 10px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P1: WASD to Move, SPACE to Whack  •  P2: ARROWS to Move, ENTER to Whack', width / 2, hintY + hintH / 2);
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
          ? `${this.players[winnerId].name} whacked ${list[0].score} moles out of the yard!`
          : 'Garden tie!'
    };
  }
}

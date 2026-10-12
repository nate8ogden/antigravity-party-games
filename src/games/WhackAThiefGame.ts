import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface VaultBox {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  state: 'empty' | 'thief' | 'gold_thief' | 'shock_trap';
  stateTimer: number;
  isHit: boolean;
  hitAnim: number;
}

interface VaultPlayer {
  id: PlayerId;
  targetBoxIndex: number;
  score: number;
  whacks: number;
  stuns: number;
  stunTimer: number;
  swingAnim: number;
  navCooldown: number;
}

export class WhackAThiefGame extends BaseGame {
  public boxes: VaultBox[] = [];
  public playersState: Map<PlayerId, VaultPlayer> = new Map();
  public currentMapName: string = 'Federal Reserve Vault';

  private spawnTimer: number = 0.8;
  private botReactionTimers: Map<PlayerId, number> = new Map();

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
    this.reset(width, height);
  }

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.boxes = [];
    this.playersState.clear();
    this.botReactionTimers.clear();
    this.spawnTimer = 0.8;

    // 4x3 Grid of 12 Safe Deposit Boxes
    const cols = 4;
    const rows = 3;
    const startX = width * 0.16;
    const spacingX = (width * 0.68) / (cols - 1);
    const startY = height * 0.28;
    const spacingY = (height * 0.58) / (rows - 1);

    let id = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.boxes.push({
          id: id++,
          x: startX + c * spacingX,
          y: startY + r * spacingY,
          width: 70,
          height: 60,
          state: 'empty',
          stateTimer: 0,
          isHit: false,
          hitAnim: 0
        });
      }
    }

    const active = this.getActivePlayers();
    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        targetBoxIndex: idx * 3,
        score: 0,
        whacks: 0,
        stuns: 0,
        stunTimer: 0,
        swingAnim: 0,
        navCooldown: 0
      });
      this.botReactionTimers.set(p.id, 0.25 + Math.random() * 0.25);
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bot decisions
    this.updateBots(dt, width, height);

    // Box state updates & pop-outs
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.45 + Math.random() * 0.35;
      this.triggerPopOut();
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
        box.hitAnim = Math.max(0, box.hitAnim - dt * 4.0);
      }
    }

    // Update players
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        continue;
      }
      if (ps.swingAnim > 0) {
        ps.swingAnim = Math.max(0, ps.swingAnim - dt * 5.0);
      }
      if (ps.navCooldown > 0) {
        ps.navCooldown -= dt;
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      const justRight = this.input.justRight(p.id);
      const justLeft = this.input.justLeft(p.id);
      const justUp = this.input.justUp(p.id);
      const justDown = this.input.justDown(p.id);

      // Grid selection navigation: discrete step on key press or debounced on hold
      let col = ps.targetBoxIndex % 4;
      let row = Math.floor(ps.targetBoxIndex / 4);

      if (justRight || (steer > 0.5 && ps.navCooldown <= 0)) {
        col = (col + 1) % 4;
        ps.navCooldown = 0.22;
      } else if (justLeft || (steer < -0.5 && ps.navCooldown <= 0)) {
        col = (col + 3) % 4;
        ps.navCooldown = 0.22;
      }

      if (justUp || (throttle > 0.5 && ps.navCooldown <= 0)) {
        row = (row + 2) % 3;
        ps.navCooldown = 0.22;
      } else if (justDown || (throttle < -0.5 && ps.navCooldown <= 0)) {
        row = (row + 1) % 3;
        ps.navCooldown = 0.22;
      }

      if (steer === 0 && throttle === 0) {
        ps.navCooldown = 0;
      }

      ps.targetBoxIndex = row * 4 + col;

      // Whack action
      if (justAction) {
        ps.swingAnim = 1.0;
        const targetBox = this.boxes[ps.targetBoxIndex];

        if (targetBox && !targetBox.isHit) {
          if (targetBox.state === 'thief') {
            targetBox.isHit = true;
            targetBox.hitAnim = 1.0;
            ps.score += 100;
            ps.whacks += 1;
            this.audio.playTap();
            this.particles.spawnSparks(targetBox.x, targetBox.y, '#3B82F6', 12);
          } else if (targetBox.state === 'gold_thief') {
            targetBox.isHit = true;
            targetBox.hitAnim = 1.0;
            ps.score += 250;
            ps.whacks += 1;
            this.audio.playScore();
            this.particles.shake(5);
            this.particles.spawnExplosion(targetBox.x, targetBox.y, '#F59E0B', 20);
          } else if (targetBox.state === 'shock_trap') {
            // SHOCKED! Stunned for 1.8 seconds!
            targetBox.isHit = true;
            ps.stuns += 1;
            ps.stunTimer = 1.6;
            ps.score = Math.max(0, ps.score - 80);
            this.audio.playExplosion();
            this.particles.shake(8);
            this.particles.spawnExplosion(targetBox.x, targetBox.y, '#EF4444', 22);
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private triggerPopOut(): void {
    const emptyBoxes = this.boxes.filter((b) => b.state === 'empty');
    if (emptyBoxes.length === 0) return;

    // Pick 1 to 2 random boxes
    const count = Math.min(emptyBoxes.length, Math.random() < 0.6 ? 2 : 1);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * emptyBoxes.length);
      const box = emptyBoxes.splice(idx, 1)[0];

      const roll = Math.random();
      if (roll < 0.20) {
        box.state = 'shock_trap';
      } else if (roll < 0.40) {
        box.state = 'gold_thief';
      } else {
        box.state = 'thief';
      }
      box.stateTimer = 1.1 + Math.random() * 0.4;
      box.isHit = false;
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
        ? 0.40 + Math.random() * 0.25
        : difficulty === 'bot_normal'
        ? 0.20 + Math.random() * 0.16
        : 0.08 + Math.random() * 0.06;
    this.botReactionTimers.set(botId, interval);

    // Check for accidental shock trap blunder on Easy/Normal
    const shockTraps = this.boxes.filter((b) => !b.isHit && b.state === 'shock_trap');
    const trapBlunder = difficulty === 'bot_easy' ? Math.random() < 0.22 : difficulty === 'bot_normal' ? Math.random() < 0.06 : false;
    if (shockTraps.length > 0 && trapBlunder) {
      const trap = shockTraps[0];
      bot.targetBoxIndex = trap.id;
      bot.swingAnim = 1.0;
      trap.isHit = true;
      bot.stuns += 1;
      bot.stunTimer = 1.6;
      bot.score = Math.max(0, bot.score - 80);
      this.audio.playExplosion();
      this.particles.shake(8);
      this.particles.spawnExplosion(trap.x, trap.y, '#EF4444', 22);
      return;
    }

    // Find active thief boxes
    const activeTargets = this.boxes.filter(
      (b) => !b.isHit && (b.state === 'thief' || b.state === 'gold_thief')
    );

    if (activeTargets.length > 0) {
      // Easy bots occasionally miss or delay
      if (difficulty === 'bot_easy' && Math.random() < 0.20) {
        return;
      }
      // Prioritize gold thief
      const target = activeTargets.find((b) => b.state === 'gold_thief') || activeTargets[0];
      bot.targetBoxIndex = target.id;
      bot.swingAnim = 1.0;

      target.isHit = true;
      target.hitAnim = 1.0;
      bot.score += target.state === 'gold_thief' ? 250 : 100;
      bot.whacks += 1;
      this.audio.playTap();
      this.particles.spawnSparks(target.x, target.y, '#3B82F6', 10);
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

    const topWhacks = scores[0]?.whacks || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} defended the vault with ${topWhacks} thief zaps!`
      : 'Vault raided! The bandits fled with the diamonds!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Heavy Titanium Vault Wall
    const wallGrad = ctx.createLinearGradient(0, 0, 0, height);
    wallGrad.addColorStop(0, '#1E293B');
    wallGrad.addColorStop(0.5, '#334155');
    wallGrad.addColorStop(1, '#0F172A');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, width, height);

    // Rivet borders
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, width - 60, height - 60);

    // 2. Safe Deposit Box Burrows
    for (const b of this.boxes) {
      ctx.save();
      // Drop Shadow
      ctx.fillStyle = '#020617';
      ctx.fillRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);

      // Steel door frame
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);

      // Contents popping out
      if (b.state === 'thief' || b.state === 'gold_thief') {
        const isGold = b.state === 'gold_thief';
        const squish = b.hitAnim > 0 ? 0.6 : 1.0;

        ctx.translate(b.x, b.y);
        ctx.scale(1.0, squish);

        // Bandit Raccoon Face
        ctx.fillStyle = isGold ? '#F59E0B' : '#475569';
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.fill();

        // Eye Mask
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(-18, -8, 36, 10);

        // Glowing Eyes
        ctx.fillStyle = isGold ? '#FEF08A' : '#38BDF8';
        ctx.beginPath();
        ctx.arc(-8, -3, 3, 0, Math.PI * 2);
        ctx.arc(8, -3, 3, 0, Math.PI * 2);
        ctx.fill();

        // Loot Sack
        ctx.fillStyle = '#10B981';
        ctx.beginPath();
        ctx.arc(14, 12, 10, 0, Math.PI * 2);
        ctx.fill();
      } else if (b.state === 'shock_trap') {
        // Red flashing high-voltage electric trap
        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FEF08A';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚡', b.x, b.y);
      }

      ctx.restore();
    }

    // 3. Player Reticles & Stun Batons
    for (const p of this.playersState.values()) {
      const cfg = this.players.find((x) => x.id === p.id);
      const color = cfg ? cfg.color : '#FFFFFF';
      const targetBox = this.boxes[p.targetBoxIndex];

      if (targetBox) {
        ctx.save();
        // Nested colored reticle around chosen deposit box
        const margin = 4 + p.id * 3.5;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(
          targetBox.x - targetBox.width / 2 - margin,
          targetBox.y - targetBox.height / 2 - margin,
          targetBox.width + margin * 2,
          targetBox.height + margin * 2
        );

        // Player ID Badge positioned at corner corresponding to player quadrant
        const badgeOffsets = [
          { bx: -targetBox.width / 2 - 2, by: -targetBox.height / 2 - 6 },
          { bx: targetBox.width / 2 + 2, by: -targetBox.height / 2 - 6 },
          { bx: -targetBox.width / 2 - 2, by: targetBox.height / 2 + 14 },
          { bx: targetBox.width / 2 + 2, by: targetBox.height / 2 + 14 }
        ];
        const bo = badgeOffsets[p.id] || badgeOffsets[0];

        ctx.fillStyle = color;
        ctx.font = 'bold 11px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`P${p.id + 1}`, targetBox.x + bo.bx, targetBox.y + bo.by);

        // Stunned indicator
        if (p.stunTimer > 0) {
          ctx.fillStyle = '#EF4444';
          ctx.font = 'bold 12px Montserrat, sans-serif';
          ctx.fillText('⚡STUNNED!', targetBox.x, targetBox.y);
        }

        ctx.restore();
      }
    }

    // 4. Draw HUD
    this.renderHUD(ctx, width, height);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, _height: number): void {
    ctx.save();
    // Timer badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(width * 0.5 - 55, 12, 110, 36, 10);
    ctx.fill();
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 18px "Chakra Petch", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(this.roundTimer)}s`, width * 0.5, 30);

    // Score bar
    const active = this.getActivePlayers();
    const itemW = 95;
    const subBarW = active.length * itemW;
    const subBarX = width * 0.5 - subBarW * 0.5;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(subBarX, 54, subBarW, 26, 6);
    ctx.fill();

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      const px = subBarX + idx * itemW + itemW / 2;
      ctx.fillStyle = p.color;
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`P${p.id + 1}: 💰${ps?.score || 0}`, px, 67);
    });

    ctx.restore();
  }
}

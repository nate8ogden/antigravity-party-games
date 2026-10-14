import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export type HydraTheme = 'lerna' | 'styx' | 'volcano';

interface HydraHead {
  id: number;
  anchorX: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  vy: number;
  kind: 'emerald' | 'crimson' | 'golden' | 'venom';
  points: number;
  color: string;
  active: boolean;
}

interface HeroSlayer {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  radius: number;
  isCharging: boolean;
  chargeRatio: number;
  slashAnimTimer: number;
  isCauterizeSlash: boolean;
  overloadTimer: number;
  stunTimer: number;
  score: number;
  combo: number;
  headsSevered: number;
  shuntsLanded: number;
  isUnderdog: boolean;
  botReactionTimer: number;
  botTargetCharge: number;
}

export class HydraSlayerGame extends BaseGame {
  public theme: HydraTheme = 'lerna';
  public playersState: Map<PlayerId, HeroSlayer> = new Map();
  private heads: HydraHead[] = [];
  private headIdCounter: number = 0;
  private spawnTimer: number = 0.6;
  private suddenDeathTriggered: boolean = false;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private mousedownListener: ((e: MouseEvent) => void) | null = null;
  private lastWidth: number = 800;
  private lastHeight: number = 600;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 36.0;
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.reset(width, height);

    if (typeof window !== 'undefined') {
      this.keydownListener = (e: KeyboardEvent) => {
        if (e.key === '1') this.switchTheme('lerna', this.lastWidth, this.lastHeight);
        else if (e.key === '2') this.switchTheme('styx', this.lastWidth, this.lastHeight);
        else if (e.key === '3') this.switchTheme('volcano', this.lastWidth, this.lastHeight);
        else if (e.key === 't' || e.key === 'T') {
          const order: HydraTheme[] = ['lerna', 'styx', 'volcano'];
          const next = order[(order.indexOf(this.theme) + 1) % order.length];
          this.switchTheme(next, this.lastWidth, this.lastHeight);
        }
      };
      this.mousedownListener = (e: MouseEvent) => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
        const my = (e.clientY - rect.top) * (canvas.height / rect.height);
        if (mx >= 20 && mx <= 190 && my >= this.lastHeight - 44 && my <= this.lastHeight - 12) {
          const order: HydraTheme[] = ['lerna', 'styx', 'volcano'];
          const next = order[(order.indexOf(this.theme) + 1) % order.length];
          this.switchTheme(next, this.lastWidth, this.lastHeight);
        }
      };
      window.addEventListener('keydown', this.keydownListener);
      window.addEventListener('mousedown', this.mousedownListener);
    }
  }

  public destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownListener) {
        window.removeEventListener('keydown', this.keydownListener);
        this.keydownListener = null;
      }
      if (this.mousedownListener) {
        window.removeEventListener('mousedown', this.mousedownListener);
        this.mousedownListener = null;
      }
    }
  }

  public switchTheme(theme: HydraTheme, width: number, height: number): void {
    this.theme = theme;
    this.audio.playChime();
    this.particles.showFloatingText(
      `THEME: ${theme.toUpperCase()}!`,
      width / 2,
      height / 2 - 40,
      theme === 'lerna' ? '#22C55E' : theme === 'styx' ? '#A855F7' : '#F97316',
      22
    );
  }

  public reset(width: number = 800, height: number = 600): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.roundTimer = 36.0;
    this.isFinished = false;
    this.suddenDeathTriggered = false;
    this.playersState.clear();
    this.heads = [];
    this.headIdCounter = 0;
    this.spawnTimer = 0.4;

    const active = this.getActivePlayers();
    const count = Math.max(1, active.length);
    const spacing = width / (count + 1);
    const causewayY = height * 0.72;

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: causewayY,
        vx: 0,
        vy: 0,
        facing: idx % 2 === 0 ? 1 : -1,
        radius: 16,
        isCharging: false,
        chargeRatio: 0,
        slashAnimTimer: 0,
        isCauterizeSlash: false,
        overloadTimer: 0,
        stunTimer: 0,
        score: 0,
        combo: 0,
        headsSevered: 0,
        shuntsLanded: 0,
        isUnderdog: false,
        botReactionTimer: 0.14 + idx * 0.05,
        botTargetCharge: 0.82
      });
    });

    for (let i = 0; i < 4; i++) {
      this.spawnHydraHead(width, height);
    }
  }

  private spawnHydraHead(width: number, height: number, forceGolden: boolean = false): void {
    const roll = Math.random();
    let kind: 'emerald' | 'crimson' | 'golden' | 'venom' = 'emerald';
    let points = 80;
    let color = '#22C55E';

    if (forceGolden || roll < (this.suddenDeathTriggered ? 0.34 : 0.2)) {
      kind = 'golden';
      points = 220;
      color = '#FACC15';
    } else if (roll < 0.38) {
      kind = 'venom';
      points = 60;
      color = '#D946EF';
    } else if (roll < 0.65) {
      kind = 'crimson';
      points = 135;
      color = '#F43F5E';
    }

    const targetX = 85 + Math.random() * (width - 170);
    const anchorX = width * 0.5 + (targetX - width * 0.5) * 0.55;
    const causewayY = height * 0.72;

    this.heads.push({
      id: ++this.headIdCounter,
      anchorX,
      x: anchorX,
      y: 128,
      targetX,
      targetY: causewayY,
      vy: (kind === 'venom' ? 190 : 125 + Math.random() * 45) * (this.suddenDeathTriggered ? 1.25 : 1.0),
      kind,
      points,
      color,
      active: true
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.lastWidth = width;
    this.lastHeight = height;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    if (this.roundTimer <= 0) {
      this.isFinished = true;
      return;
    }

    // Sudden Death Overdrive at <= 12s
    if (this.roundTimer <= 12.0 && !this.suddenDeathTriggered) {
      this.suddenDeathTriggered = true;
      this.audio.playFanfare();
      this.particles.shake(0.35);
      this.particles.showFloatingText(
        '⚡ SUDDEN DEATH: IMMORTAL GOLDEN HYDRA FURY! ⚡',
        width / 2,
        102,
        '#FACC15',
        21
      );
      this.spawnHydraHead(width, height, true);
      this.spawnHydraHead(width, height, true);
    }

    // Compute Underdog Surge (>= 250 pts behind leader)
    let maxScore = 0;
    for (const st of this.playersState.values()) {
      if (st.score > maxScore) maxScore = st.score;
    }
    for (const st of this.playersState.values()) {
      st.isUnderdog = maxScore - st.score >= 250;
    }

    this.updateBots(dt, width, height);

    // Spawn Hydra Heads
    this.spawnTimer -= dt;
    const maxHeads = this.suddenDeathTriggered ? 8 : 6;
    if (this.spawnTimer <= 0 && this.heads.filter((h) => h.active).length < maxHeads) {
      this.spawnTimer = this.suddenDeathTriggered ? 0.48 : 0.72;
      this.spawnHydraHead(width, height);
    }

    const causewayY = height * 0.72;

    // Update Lunging Hydra Heads
    for (const h of this.heads) {
      if (!h.active) continue;
      h.y += h.vy * dt;
      const progress = Math.max(0, Math.min(1, (h.y - 128) / Math.max(1, h.targetY - 128)));
      h.x = h.anchorX + (h.targetX - h.anchorX) * progress;

      // Impact with Temple Causeway
      if (h.y >= h.targetY + 8) {
        h.active = false;
        this.particles.spawnSparks(h.x, h.targetY, h.color, 8);

        // Check if any hero standing right on impact spot got bitten or splashed!
        for (const hero of this.playersState.values()) {
          if (Math.hypot(hero.x - h.x, hero.y - h.targetY) <= 34 && hero.stunTimer <= 0) {
            hero.combo = 0;
            hero.stunTimer = 0.55;
            hero.score = Math.max(0, hero.score - 35);
            this.audio.playStun();
            this.particles.shake(0.24);
            this.particles.showFloatingText(
              h.kind === 'venom' ? 'VENOM SPLASH! -35' : 'HYDRA BITE! -35',
              hero.x,
              hero.y - 24,
              '#EF4444',
              17
            );
          }
        }
      }
    }

    const activePlayers = this.getActivePlayers();
    for (const p of activePlayers) {
      const st = this.playersState.get(p.id);
      if (!st) continue;

      if (st.slashAnimTimer > 0) st.slashAnimTimer = Math.max(0, st.slashAnimTimer - dt);
      if (st.overloadTimer > 0) st.overloadTimer = Math.max(0, st.overloadTimer - dt);
      if (st.stunTimer > 0) st.stunTimer = Math.max(0, st.stunTimer - dt);

      const steer = this.input.getSteer(p.id);
      const throttle = -this.input.getThrottle(p.id);
      const holdingAction = this.input.isActionPressed(p.id);

      if (Math.abs(steer) > 0.15) {
        st.facing = steer > 0 ? 1 : -1;
      }

      // Hold-to-Charge Searing Flame-Cauterize Slash (72%-98% Sweet Spot)
      if (st.overloadTimer <= 0 && st.stunTimer <= 0 && st.slashAnimTimer <= 0) {
        if (holdingAction) {
          st.isCharging = true;
          st.chargeRatio += dt * 1.22 * (st.isUnderdog ? 1.3 : 1.0);
          if (st.chargeRatio >= 1.0) {
            st.chargeRatio = 0;
            st.isCharging = false;
            st.overloadTimer = 0.55;
            this.audio.playStun();
            this.particles.showFloatingText('BLADE OVERHEAT!', st.x, st.y - 26, '#F97316', 16);
          }
        } else if (st.isCharging) {
          const ratio = st.chargeRatio;
          st.isCharging = false;
          st.chargeRatio = 0;
          this.executeHeroSlash(st, ratio);
        }
      }

      const speed = (st.isUnderdog ? 275 : 230) * (st.isCharging ? 0.68 : 1.0);
      if (st.stunTimer <= 0) {
        st.vx += (steer * speed - st.vx) * Math.min(1, dt * 11);
        st.vy += (throttle * speed * 0.55 - st.vy) * Math.min(1, dt * 11);
      } else {
        st.vx *= Math.pow(0.1, dt);
        st.vy *= Math.pow(0.1, dt);
      }

      st.x += st.vx * dt;
      st.y += st.vy * dt;

      st.x = Math.max(50, Math.min(width - 50, st.x));
      st.y = Math.max(causewayY - 38, Math.min(height - 62, st.y));
    }

    // Player-to-Player Elastic Causeway Collisions (m1*v1 + m2*v2)
    for (let i = 0; i < activePlayers.length; i++) {
      for (let j = i + 1; j < activePlayers.length; j++) {
        const p1 = this.playersState.get(activePlayers[i].id);
        const p2 = this.playersState.get(activePlayers[j].id);
        if (!p1 || !p2) continue;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = p1.radius + p2.radius + 4;

        if (dist > 0 && dist < minDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = (minDist - dist) * 0.5;
          p1.x -= nx * overlap;
          p1.y -= ny * overlap;
          p2.x += nx * overlap;
          p2.y += ny * overlap;

          const kx = p1.vx - p2.vx;
          const ky = p1.vy - p2.vy;
          const pImp = 2 * (nx * kx + ny * ky) * 0.5;
          p1.vx -= pImp * nx - nx * 55;
          p1.vy -= pImp * ny;
          p2.vx += pImp * nx + nx * 55;
          p2.vy += pImp * ny;
          this.audio.playBounce();
        }
      }
    }

    this.heads = this.heads.filter((h) => h.active);
  }

  private executeHeroSlash(st: HeroSlayer, ratio: number): void {
    const isSweetSpot = ratio >= 0.72 && ratio <= 0.98;
    st.slashAnimTimer = 0.32;
    st.isCauterizeSlash = isSweetSpot;

    const reach = isSweetSpot ? 96 : 64;
    const mult = (isSweetSpot ? 1.75 : 1.0) * (st.isUnderdog ? 1.25 : 1.0);
    let hitAny = false;

    for (const h of this.heads) {
      if (!h.active) continue;
      const d = Math.hypot(h.x - st.x, h.y - (st.y - 16));
      if (d <= reach) {
        if (h.kind === 'venom' && !isSweetSpot) {
          // Slashing venom without a Sweet-Spot Flame Cauterize splashes poison!
          h.active = false;
          st.combo = 0;
          st.stunTimer = 0.5;
          st.score = Math.max(0, st.score - 25);
          this.audio.playStun();
          this.particles.spawnExplosion(h.x, h.y, '#D946EF', 14);
          this.particles.showFloatingText('VENOM BURST! -25', st.x, st.y - 28, '#D946EF', 17);
          hitAny = true;
          continue;
        }

        // Severed Hydra Head (or Cauterized Venom Orb!)
        h.active = false;
        hitAny = true;
        st.headsSevered += 1;
        st.combo += 1;
        const pts = Math.round((h.points + st.combo * 12) * mult);
        st.score += pts;

        this.audio.playScore();
        if (isSweetSpot || h.kind === 'golden') {
          this.audio.playChime();
        }
        this.particles.spawnExplosion(h.x, h.y, isSweetSpot ? '#F97316' : h.color, 18);
        this.particles.showFloatingText(
          isSweetSpot ? `🔥 CAUTERIZED! +${pts}` : `⚔️ SEVERED! +${pts}`,
          h.x,
          h.y - 14,
          isSweetSpot ? '#FACC15' : h.color,
          isSweetSpot ? 20 : 17
        );
      }
    }

    // Flame Shockwave Shunt against rival heroes nearby!
    const shuntRadius = isSweetSpot ? 95 : 55;
    for (const other of this.playersState.values()) {
      if (other.id === st.id) continue;
      const dx = other.x - st.x;
      const dy = other.y - st.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d <= shuntRadius) {
        const dir = dx >= 0 ? 1 : -1;
        other.vx += dir * (isSweetSpot ? 310 : 170);
        other.stunTimer = isSweetSpot ? 0.45 : 0.2;
        const shuntPts = isSweetSpot ? 70 : 35;
        st.score += shuntPts;
        st.shuntsLanded += 1;
        this.audio.playBounce();
        this.particles.showFloatingText(`BLADE SHUNT! +${shuntPts}`, other.x, other.y - 26, '#38BDF8', 17);
        hitAny = true;
      }
    }

    if (!hitAny) {
      this.audio.playWhoosh();
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const st = this.playersState.get(botId);
    if (!st || st.stunTimer > 0) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    // Find best incoming Hydra Head
    let bestHead: HydraHead | null = null;
    let bestVal = -9999;

    for (const h of this.heads) {
      if (!h.active) continue;
      if (h.kind === 'venom' && difficulty !== 'bot_hard') {
        // Dodge venom if close!
        if (Math.abs(h.targetX - st.x) < 42 && h.y > st.y - 110) {
          const dodgeDir = st.x < 400 ? 1 : -1;
          this.input.setBotInput(botId, true, dodgeDir, 0, false);
          return;
        }
        continue;
      }
      const dx = Math.abs(h.targetX - st.x);
      const val = h.points * 1.4 - dx * 0.9 + (h.y - 128) * 0.6;
      if (val > bestVal) {
        bestVal = val;
        bestHead = h;
      }
    }

    if (!bestHead) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    const dx = bestHead.targetX - st.x;
    const steer = Math.abs(dx) > 18 ? (dx > 0 ? 1 : -1) : 0;

    if (st.isCharging) {
      if (st.chargeRatio >= st.botTargetCharge && bestHead.y >= st.y - 82) {
        this.input.setBotInput(botId, steer !== 0, steer, 0, false);
      } else {
        this.input.setBotInput(botId, true, steer, 0, true);
      }
      return;
    }

    st.botReactionTimer -= dt;
    if (st.botReactionTimer > 0) return;

    st.botReactionTimer =
      difficulty === 'bot_hard'
        ? 0.09 + Math.random() * 0.04
        : difficulty === 'bot_normal'
        ? 0.2 + Math.random() * 0.04
        : 0.36 + Math.random() * 0.07;

    if (Math.abs(dx) < 52 && bestHead.y > st.y - 145 && st.overloadTimer <= 0) {
      st.botTargetCharge =
        difficulty === 'bot_hard'
          ? 0.76 + Math.random() * 0.16
          : difficulty === 'bot_normal'
          ? 0.68 + Math.random() * 0.2
          : 0.35 + Math.random() * 0.3;
      this.input.setBotInput(botId, true, steer, 0, true);
    } else {
      this.input.setBotInput(botId, steer !== 0, steer, 0, false);
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const st = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: st?.score || 0,
        severed: st?.headsSevered || 0,
        shunts: st?.shuntsLanded || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topSevered = scores[0]?.severed || 0;
    const mvpHighlight =
      winnerId !== null
        ? `Player ${Number(winnerId) + 1} cauterized ${topSevered} Hydra heads & landed ${scores[0]?.shunts || 0} blade shunts!`
        : 'The multi-headed Hydra overwhelmed the ancient heroes!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    const now = performance.now() * 0.001;

    // 1. Swamp of Lerna / River Styx / Magma Crater Backdrop & Marble Causeway
    this.renderBackdrop(ctx, width, height, now);

    // 2. Colossal Hydra Body & Lunging Articulated Serpent Necks
    this.renderHydra(ctx, width, height, now);

    // 3. Hero Mascot Slayers & Flame-Cauterize Swords
    this.renderHeroes(ctx, now);

    // 4. Theme Pill (Bottom-Left)
    this.renderThemePill(ctx, height);
  }

  private renderBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number, now: number): void {
    if (this.theme === 'lerna') {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#04120B');
      grad.addColorStop(0.55, '#0D2B1D');
      grad.addColorStop(1, '#091811');
      ctx.fillStyle = grad;
    } else if (this.theme === 'styx') {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#0F0720');
      grad.addColorStop(0.55, '#1E1B4B');
      grad.addColorStop(1, '#090D16');
      ctx.fillStyle = grad;
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, '#180808');
      grad.addColorStop(0.55, '#450A0A');
      grad.addColorStop(1, '#0F172A');
      ctx.fillStyle = grad;
    }
    ctx.fillRect(0, 0, width, height);

    // Ancient Doric Temple Columns in background
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    for (const cx of [width * 0.15, width * 0.38, width * 0.62, width * 0.85]) {
      ctx.fillRect(cx - 14, 110, 28, height * 0.55);
    }

    // Shared 2.5D Marble Temple Causeway
    const causewayY = height * 0.65;
    ctx.fillStyle = this.theme === 'volcano' ? '#27272A' : '#334155';
    ctx.fillRect(0, causewayY, width, height - causewayY);
    ctx.strokeStyle = this.theme === 'lerna' ? '#22C55E' : this.theme === 'styx' ? '#A855F7' : '#F97316';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, causewayY);
    ctx.lineTo(width, causewayY);
    ctx.stroke();

    // Glowing Swamp / Styx / Magma Mist above causeway line
    ctx.fillStyle =
      this.theme === 'lerna'
        ? `rgba(34, 197, 94, ${0.08 + 0.03 * Math.sin(now * 3)})`
        : this.theme === 'styx'
        ? `rgba(168, 85, 247, ${0.08 + 0.03 * Math.sin(now * 3)})`
        : `rgba(249, 115, 22, ${0.08 + 0.03 * Math.sin(now * 3)})`;
    ctx.fillRect(0, causewayY - 28, width, 28);
    ctx.restore();
  }

  private renderHydra(ctx: CanvasRenderingContext2D, width: number, _height: number, now: number): void {
    // Central Hydra Torso Silhouette emerging from the upper swamp at (width/2, 132)
    ctx.save();
    ctx.fillStyle = '#064E3B';
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(width / 2, 128, 85, 32, 0, Math.PI, 0);
    ctx.fill();
    ctx.stroke();

    for (const h of this.heads) {
      if (!h.active) continue;

      // Ground Target Warning Reticle on the Causeway
      ctx.save();
      ctx.strokeStyle = h.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.ellipse(h.targetX, h.targetY + 4, 24, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      if (h.kind === 'venom') {
        // Corrosive Venom Spit Orb
        ctx.save();
        ctx.translate(h.x, h.y);
        ctx.fillStyle = '#D946EF';
        ctx.shadowColor = '#D946EF';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('☠', 0, 3.5);
        ctx.restore();
      } else {
        // Sinuous Bezier Serpent Neck connecting Hydra Torso to Lunging Head!
        ctx.save();
        ctx.strokeStyle = h.color;
        ctx.lineWidth = 11;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(h.anchorX, 124);
        const ctrlX = (h.anchorX + h.x) * 0.5 + Math.sin(now * 5 + h.id) * 24;
        const ctrlY = (124 + h.y) * 0.5;
        ctx.quadraticCurveTo(ctrlX, ctrlY, h.x, h.y);
        ctx.stroke();

        // 2.5D Serpent Head & Jaws
        ctx.translate(h.x, h.y);
        ctx.fillStyle = h.color;
        ctx.shadowColor = h.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.ellipse(0, 0, 14, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Glowing Fierce Eyes & Fangs
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(-5, -3, 2.8, 0, Math.PI * 2);
        ctx.arc(5, -3, 2.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.moveTo(-6, 12);
        ctx.lineTo(-4, 20);
        ctx.lineTo(-2, 12);
        ctx.moveTo(2, 12);
        ctx.lineTo(4, 20);
        ctx.lineTo(6, 12);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  private renderHeroes(ctx: CanvasRenderingContext2D, now: number): void {
    for (const p of this.getActivePlayers()) {
      const st = this.playersState.get(p.id);
      if (!st) continue;

      ctx.save();
      ctx.translate(st.x, st.y);

      if (st.isUnderdog) {
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, st.radius + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Hold-to-Charge Searing Flame-Cauterize Ring (72%-98% Sweet Spot)
      if (st.isCharging) {
        const r = st.radius + 9;
        const isSweet = st.chargeRatio >= 0.72 && st.chargeRatio <= 0.98;
        ctx.strokeStyle = isSweet ? '#22C55E' : '#F97316';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + st.chargeRatio * Math.PI * 2);
        ctx.stroke();
      }

      // Whirlwind Slash Arc Effect
      if (st.slashAnimTimer > 0) {
        ctx.save();
        ctx.strokeStyle = st.isCauterizeSlash ? '#F97316' : '#38BDF8';
        ctx.lineWidth = st.isCauterizeSlash ? 6 : 4;
        ctx.beginPath();
        ctx.arc(0, -10, st.isCauterizeSlash ? 48 : 34, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        ctx.restore();
      }

      const mood =
        st.stunTimer > 0 || st.overloadTimer > 0
          ? 'shocked'
          : st.slashAnimTimer > 0 || st.combo >= 2
          ? 'triumph'
          : 'focused';
      this.drawPlayerMascot(ctx, p.id, 0, 0, st.radius, mood, now);

      // Heroic Flame-Blade in hand
      ctx.save();
      ctx.scale(st.facing, 1);
      const bladeAng = st.slashAnimTimer > 0 ? 1.1 : st.isCharging ? -0.55 : -0.15;
      ctx.translate(12, 0);
      ctx.rotate(bladeAng);
      ctx.fillStyle = st.chargeRatio >= 0.72 || st.isCauterizeSlash ? '#F97316' : '#FACC15';
      ctx.fillRect(-2.5, -28, 5, 26);
      ctx.fillStyle = '#B45309';
      ctx.fillRect(-6, -4, 12, 3.5);
      ctx.restore();

      ctx.restore();

      // Score & Combo Label
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 4;
      const comboTxt = st.combo >= 2 ? ` (${st.combo}x)` : '';
      ctx.fillText(`${st.score} pts${comboTxt}`, st.x, st.y - st.radius - 13);
      ctx.restore();
    }
  }

  private renderThemePill(ctx: CanvasRenderingContext2D, height: number): void {
    const pillW = 170;
    const pillH = 32;
    const pillX = 20;
    const pillY = height - 44;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.font = '800 10.5px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.theme === 'lerna' ? '#22C55E' : this.theme === 'styx' ? '#A855F7' : '#F97316';
    ctx.fillText(`THEME: ${this.theme.toUpperCase()} [T]`, pillX + pillW / 2, pillY + 20);
    ctx.restore();
  }
}

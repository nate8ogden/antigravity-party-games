import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

type ItemType = 'gold_small' | 'gold_large' | 'diamond' | 'rock' | 'tnt' | 'mystery';

interface CavernItem {
  id: number;
  type: ItemType;
  x: number;
  y: number;
  radius: number;
  value: number;
  weight: number; // 1 = light/fast, 4 = heavy/slow
  color: string;
  grabbedBy: PlayerId | null;
  destroyed: boolean;
}

interface MinerPlayer {
  id: PlayerId;
  winchX: number;
  winchY: number;
  angle: number; // radians (0 = straight down)
  sweepDir: number; // 1 or -1
  minAngle: number;
  maxAngle: number;
  clawState: 'SWINGING' | 'SHOOTING' | 'REELING';
  clawLength: number;
  clawMaxLen: number;
  grabbedItem: CavernItem | null;
  score: number;
  itemsRetrieved: number;
  botTargetId: number | null;
  botReactionTimer: number;
}

export class GoldMinerGame extends BaseGame {
  private playersState: Map<PlayerId, MinerPlayer> = new Map();
  private items: CavernItem[] = [];
  private currentMapName: string = 'Crystal Caverns';
  private groundY: number = 100;
  private itemCounter: number = 0;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.isFinished = false;
    this.roundTimer = 45;
    this.groundY = 105;
    this.itemCounter = 0;

    this.initPlayers(width);
    this.generateProceduralMap(width, height);
  }

  private initPlayers(width: number): void {
    this.playersState.clear();
    const active = this.getActivePlayers();
    const count = active.length;

    // Distribute winches horizontally along top surface
    active.forEach((p, idx) => {
      const wx = ((idx + 1) * width) / (count + 1);
      const wy = this.groundY - 14;

      this.playersState.set(p.id, {
        id: p.id,
        winchX: wx,
        winchY: wy,
        angle: (Math.random() - 0.5) * 0.8,
        sweepDir: idx % 2 === 0 ? 1 : -1,
        minAngle: -Math.PI * 0.38,
        maxAngle: Math.PI * 0.38,
        clawState: 'SWINGING',
        clawLength: 26,
        clawMaxLen: 680,
        grabbedItem: null,
        score: 0,
        itemsRetrieved: 0,
        botTargetId: null,
        botReactionTimer: 0.2 + idx * 0.1
      });
    });
  }

  private generateProceduralMap(width: number, height: number): void {
    const maps = [
      'Crystal Caverns',
      'Dynamite Quarry',
      'Lost Incan Gold',
      'Molten Core'
    ];
    this.currentMapName = maps[Math.floor(Math.random() * maps.length)];
    this.items = [];

    const cavernTop = this.groundY + 35;
    const cavernBottom = height - 25;
    const paddingX = 45;

    // Item density based on map archetype
    let numSmallGold = 8;
    let numLargeGold = 4;
    let numDiamonds = 4;
    let numRocks = 7;
    let numTnt = 3;
    let numMystery = 2;

    if (this.currentMapName === 'Crystal Caverns') {
      numDiamonds = 8;
      numSmallGold = 6;
      numRocks = 5;
      numTnt = 1;
    } else if (this.currentMapName === 'Dynamite Quarry') {
      numTnt = 7;
      numRocks = 10;
      numLargeGold = 5;
      numDiamonds = 2;
    } else if (this.currentMapName === 'Lost Incan Gold') {
      numLargeGold = 8;
      numMystery = 4;
      numRocks = 6;
    } else if (this.currentMapName === 'Molten Core') {
      numDiamonds = 6;
      numTnt = 5;
      numSmallGold = 7;
    }

    const trySpawnItem = (
      type: ItemType,
      radius: number,
      value: number,
      weight: number,
      color: string
    ) => {
      for (let attempt = 0; attempt < 35; attempt++) {
        const x = paddingX + Math.random() * (width - paddingX * 2);
        const y = cavernTop + Math.random() * (cavernBottom - cavernTop);

        // Check distance to existing items
        let overlap = false;
        for (const it of this.items) {
          if (Math.hypot(it.x - x, it.y - y) < it.radius + radius + 14) {
            overlap = true;
            break;
          }
        }

        if (!overlap) {
          this.items.push({
            id: ++this.itemCounter,
            type,
            x,
            y,
            radius,
            value,
            weight,
            color,
            grabbedBy: null,
            destroyed: false
          });
          break;
        }
      }
    };

    // Diamonds
    for (let i = 0; i < numDiamonds; i++) {
      trySpawnItem('diamond', 10, 350, 0.75, '#67E8F9');
    }
    // Large Gold
    for (let i = 0; i < numLargeGold; i++) {
      trySpawnItem('gold_large', 24, 250, 3.2, '#F59E0B');
    }
    // Small Gold
    for (let i = 0; i < numSmallGold; i++) {
      trySpawnItem('gold_small', 14, 100, 1.4, '#FBBF24');
    }
    // Rocks
    for (let i = 0; i < numRocks; i++) {
      trySpawnItem('rock', 19, 25, 3.8, '#78716C');
    }
    // TNT
    for (let i = 0; i < numTnt; i++) {
      trySpawnItem('tnt', 16, 0, 0.5, '#EF4444');
    }
    // Mystery Bags
    for (let i = 0; i < numMystery; i++) {
      trySpawnItem('mystery', 15, 150, 1.2, '#A855F7');
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    // Update bot inputs via BaseGame
    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.clawState === 'SWINGING') {
        // Oscillate winch
        const swingSpeed = 1.7; // rad/s
        ps.angle += ps.sweepDir * swingSpeed * dt;
        if (ps.angle > ps.maxAngle) {
          ps.angle = ps.maxAngle;
          ps.sweepDir = -1;
        } else if (ps.angle < ps.minAngle) {
          ps.angle = ps.minAngle;
          ps.sweepDir = 1;
        }

        // Check shoot input
        const wantsToShoot =
          this.input.justPressed(p.id) ||
          this.input.justAction(p.id) ||
          this.input.getThrottle(p.id) > 0.5;

        if (wantsToShoot) {
          ps.clawState = 'SHOOTING';
          this.audio.playWhoosh();
        }
      } else if (ps.clawState === 'SHOOTING') {
        const shootSpeed = 340; // px/s
        ps.clawLength += shootSpeed * dt;

        // Claw tip position
        const clawTipX = ps.winchX + Math.sin(ps.angle) * ps.clawLength;
        const clawTipY = ps.winchY + Math.cos(ps.angle) * ps.clawLength;

        // Boundary collision check
        if (
          clawTipX < 15 ||
          clawTipX > width - 15 ||
          clawTipY > height - 15 ||
          ps.clawLength >= ps.clawMaxLen
        ) {
          ps.clawState = 'REELING';
          this.audio.playBounce();
        } else {
          // Check collision with ungrabbed cavern items
          for (const item of this.items) {
            if (item.destroyed || item.grabbedBy !== null) continue;

            const dist = Math.hypot(clawTipX - item.x, clawTipY - item.y);
            if (dist <= item.radius + 12) {
              // Grabbed item!
              if (item.type === 'tnt') {
                this.detonateTNT(item);
                ps.clawState = 'REELING';
                break;
              } else {
                item.grabbedBy = ps.id;
                ps.grabbedItem = item;
                ps.clawState = 'REELING';
                this.audio.playTap();
                break;
              }
            }
          }
        }
      } else if (ps.clawState === 'REELING') {
        // Reel speed depends on item weight
        const baseReelSpeed = 310;
        const weightFactor = ps.grabbedItem ? ps.grabbedItem.weight : 0.8;
        const actualReelSpeed = Math.max(55, baseReelSpeed / weightFactor);

        ps.clawLength -= actualReelSpeed * dt;

        if (Math.random() < 0.1) {
          this.audio.playReel();
        }

        // Update grabbed item position to claw tip
        if (ps.grabbedItem) {
          ps.grabbedItem.x = ps.winchX + Math.sin(ps.angle) * ps.clawLength;
          ps.grabbedItem.y = ps.winchY + Math.cos(ps.angle) * ps.clawLength;
        }

        // Fully reeled back to winch
        if (ps.clawLength <= 26) {
          ps.clawLength = 26;
          ps.clawState = 'SWINGING';

          if (ps.grabbedItem) {
            const it = ps.grabbedItem;
            it.destroyed = true;

            // Mystery bag random reward
            let pts = it.value;
            if (it.type === 'mystery') {
              const rolls = [50, 150, 200, 300, 400];
              pts = rolls[Math.floor(Math.random() * rolls.length)];
            }

            ps.score += pts;
            ps.itemsRetrieved += 1;

            this.audio.playScore();
            this.particles.showFloatingText(`+${pts}`, ps.winchX, ps.winchY - 26, it.color, 24);
            this.particles.spawnConfetti(ps.winchX, ps.winchY, 15);

            ps.grabbedItem = null;
          }
        }
      }
    }

    // Check if cavern is empty of high-value items
    const remainingValuables = this.items.filter(
      (it) => !it.destroyed && it.grabbedBy === null && it.type !== 'rock' && it.type !== 'tnt'
    );
    if (remainingValuables.length === 0 || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private detonateTNT(tnt: CavernItem): void {
    tnt.destroyed = true;
    this.audio.playExplosion();
    this.particles.shake(0.4);
    this.particles.spawnExplosion(tnt.x, tnt.y, '#EF4444', 35);
    this.particles.showFloatingText('BOOM!', tnt.x, tnt.y - 15, '#EF4444', 26);

    const blastRadius = 80;
    for (const other of this.items) {
      if (other.destroyed || other.id === tnt.id) continue;
      const d = Math.hypot(other.x - tnt.x, other.y - tnt.y);
      if (d <= blastRadius) {
        other.destroyed = true;
        this.particles.spawnExplosion(other.x, other.y, other.color, 15);
      }
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
    if (!ps || ps.clawState !== 'SWINGING') {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    ps.botReactionTimer -= dt;
    if (ps.botReactionTimer > 0) return;

    const tolerance =
      difficulty === 'bot_hard' ? 0.045 : difficulty === 'bot_normal' ? 0.09 : 0.18;
    ps.botReactionTimer = 0.06;

    // Find best target candidate
    let bestScore = -9999;
    let targetAngle = 0;

    for (const item of this.items) {
      if (item.destroyed || item.grabbedBy !== null) continue;

      const dx = item.x - ps.winchX;
      const dy = item.y - ps.winchY;
      if (dy <= 0) continue;

      const angleToItem = Math.atan2(dx, dy);
      if (angleToItem < ps.minAngle || angleToItem > ps.maxAngle) continue;

      const dist = Math.hypot(dx, dy);

      let util = (item.value / dist) * 100;
      if (item.type === 'rock') util -= 150;
      if (item.type === 'tnt') util -= 250;
      if (item.type === 'diamond') util += 80;

      // Check if an obstacle (rock or TNT) blocks the line of sight
      if (difficulty !== 'bot_easy') {
        let isBlocked = false;
        for (const obs of this.items) {
          if (obs.id === item.id || obs.destroyed || obs.grabbedBy !== null) continue;
          if (obs.type !== 'rock' && obs.type !== 'tnt') continue;
          const odx = obs.x - ps.winchX;
          const ody = obs.y - ps.winchY;
          const odist = Math.hypot(odx, ody);
          if (odist >= dist) continue;

          const oAngle = Math.atan2(odx, ody);
          if (Math.abs(oAngle - angleToItem) < 0.12) {
            isBlocked = true;
            break;
          }
        }
        if (isBlocked) continue;
      }

      if (util > bestScore) {
        bestScore = util;
        targetAngle = angleToItem;
      }
    }

    if (bestScore > 0 && Math.abs(ps.angle - targetAngle) < tolerance) {
      if (difficulty === 'bot_easy' && Math.random() < 0.3) {
        this.input.setBotInput(botId, false, 0, 0, false);
        return;
      }
      this.input.setBotInput(botId, true, 0, 1, true);
    } else {
      this.input.setBotInput(botId, false, 0, 0, false);
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Cavern Underground Background
    const caveGrad = ctx.createLinearGradient(0, this.groundY, 0, height);
    if (this.currentMapName === 'Crystal Caverns') {
      caveGrad.addColorStop(0, '#0F172A');
      caveGrad.addColorStop(1, '#022C22');
    } else if (this.currentMapName === 'Dynamite Quarry') {
      caveGrad.addColorStop(0, '#292524');
      caveGrad.addColorStop(1, '#1C1917');
    } else if (this.currentMapName === 'Molten Core') {
      caveGrad.addColorStop(0, '#1C1917');
      caveGrad.addColorStop(1, '#450A0A');
    } else {
      caveGrad.addColorStop(0, '#1E1B4B');
      caveGrad.addColorStop(1, '#0F172A');
    }

    ctx.fillStyle = caveGrad;
    ctx.fillRect(0, this.groundY, width, height - this.groundY);

    // Surface Ground line
    ctx.fillStyle = '#10B981';
    ctx.fillRect(0, this.groundY - 6, width, 6);
    ctx.fillStyle = '#065F46';
    ctx.fillRect(0, this.groundY, width, 4);

    // Top Sky above ground
    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(0, 0, width, this.groundY - 6);

    // 2. Render Cavern Items
    for (const item of this.items) {
      if (item.destroyed) continue;
      this.renderCavernItem(ctx, item);
    }

    // 3. Render Miner Winches, Cables & Claws
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;
      this.renderMinerPlayer(ctx, ps, p.color);
    }

    // 4. Render Center HUD Pod
    this.renderCenterHudPod(ctx, width);
  }

  private renderCavernItem(ctx: CanvasRenderingContext2D, item: CavernItem): void {
    ctx.save();
    ctx.translate(item.x, item.y);

    if (item.type === 'diamond') {
      // Sparkling Cyan Diamond
      ctx.beginPath();
      ctx.moveTo(0, -item.radius);
      ctx.lineTo(item.radius, 0);
      ctx.lineTo(0, item.radius);
      ctx.lineTo(-item.radius, 0);
      ctx.closePath();
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Facet glint
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    } else if (item.type === 'gold_large' || item.type === 'gold_small') {
      // Lumpy Gold Nugget
      ctx.beginPath();
      const numPts = 7;
      for (let i = 0; i < numPts; i++) {
        const a = (i * Math.PI * 2) / numPts;
        const r = item.radius * (0.8 + ((i * 3) % 4) * 0.08);
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#78350F';
      ctx.stroke();

      // Golden Sheen
      ctx.fillStyle = '#FEF08A';
      ctx.beginPath();
      ctx.arc(-item.radius * 0.3, -item.radius * 0.3, item.radius * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (item.type === 'rock') {
      // Craggy Granite Rock
      ctx.beginPath();
      ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#44403C';
      ctx.stroke();

      // Rock fissures
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-item.radius * 0.4, -item.radius * 0.2);
      ctx.lineTo(item.radius * 0.3, item.radius * 0.4);
      ctx.stroke();
    } else if (item.type === 'tnt') {
      // Red TNT Barrel
      const w = item.radius * 1.6;
      const h = item.radius * 1.8;
      ctx.fillStyle = '#DC2626';
      ctx.beginPath();
      ctx.roundRect(-w / 2, -h / 2, w, h, 3);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#7F1D1D';
      ctx.stroke();

      // TNT Label
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TNT', 0, 3);

      // Fuse sparking
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -h / 2);
      ctx.quadraticCurveTo(4, -h / 2 - 6, 2, -h / 2 - 8);
      ctx.stroke();
    } else if (item.type === 'mystery') {
      // Mystery Question Bag
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(0, 2, item.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#581C87';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('?', 0, 6);
    }

    ctx.restore();
  }

  private renderMinerPlayer(
    ctx: CanvasRenderingContext2D,
    ps: MinerPlayer,
    color: string
  ): void {
    // 1. Miner Shack / Winch Base on surface
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(ps.winchX - 16, ps.winchY - 14, 32, 14, 3);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    // Pulley Wheel
    ctx.beginPath();
    ctx.arc(ps.winchX, ps.winchY, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#64748B';
    ctx.fill();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 2. Steel Cable
    const clawTipX = ps.winchX + Math.sin(ps.angle) * ps.clawLength;
    const clawTipY = ps.winchY + Math.cos(ps.angle) * ps.clawLength;

    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ps.winchX, ps.winchY);
    ctx.lineTo(clawTipX, clawTipY);
    ctx.stroke();

    // 3. Mechanical Claw Pincers
    ctx.save();
    ctx.translate(clawTipX, clawTipY);
    ctx.rotate(-ps.angle); // Rotate to align with cable

    // Claw Hub
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pincers (open or clamping)
    const pincerSpread = ps.grabbedItem ? 0.35 : 0.65;
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2.5;

    // Left pincer
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-Math.sin(pincerSpread) * 14, Math.cos(pincerSpread) * 14);
    ctx.lineTo(-Math.sin(pincerSpread) * 8, Math.cos(pincerSpread) * 18);
    ctx.stroke();

    // Right pincer
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.sin(pincerSpread) * 14, Math.cos(pincerSpread) * 14);
    ctx.lineTo(Math.sin(pincerSpread) * 8, Math.cos(pincerSpread) * 18);
    ctx.stroke();

    ctx.restore();

    // Score Tag above miner
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${ps.score}g`, ps.winchX, ps.winchY - 20);
  }

  private renderCenterHudPod(ctx: CanvasRenderingContext2D, width: number): void {
    const podW = 340;
    const podH = 26;
    const podX = width / 2 - podW / 2;
    const podY = 56;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 13);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Map Name Badge
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(`CAVERN: ${this.currentMapName}`, podX + 16, podY + 17);

    // Timer display
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    const timerColor = this.roundTimer < 10 ? '#EF4444' : '#F1F5F9';
    ctx.fillStyle = timerColor;
    ctx.fillText(`TIME: ${this.roundTimer.toFixed(1)}s`, podX + podW - 16, podY + 17);
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

    let mvpHighlight = 'Gold Rush Tycoon!';
    if (winnerId !== null) {
      const ps = this.playersState.get(winnerId);
      mvpHighlight = `Player ${Number(winnerId) + 1} struck it rich with ${ps?.score || 0}g of gold!`;
    }

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }
}

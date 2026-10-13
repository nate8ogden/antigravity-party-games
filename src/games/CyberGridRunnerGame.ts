import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export interface DataNode {
  id: number;
  x: number;
  y: number;
  radius: number;
  type: 'packet' | 'core' | 'overclock';
  points: number;
  pulseAnim: number;
}

export interface LaserGate {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isActive: boolean;
  hackedBy: PlayerId | null;
  cycleTimer: number;
}

export interface HoverRunner {
  id: PlayerId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  radius: number;
  score: number;
  nitroEnergy: number; // 0 to 100%
  isBoosting: boolean;
  boostDuration: number;
  overclockTimer: number; // Hyper Overclock Supercharge state
  stunTimer: number;
  coresCollected: number;
  trail: { x: number; y: number; alpha: number; color: string }[];
}

export class CyberGridRunnerGame extends BaseGame {
  public playersState: Map<PlayerId, HoverRunner> = new Map();
  public dataNodes: DataNode[] = [];
  public laserGates: LaserGate[] = [];
  public currentMapName: string = 'Neo-Kyoto Synthwave Grid';

  private nextNodeId: number = 0;
  private nodeSpawnTimer: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private botBoostCooldowns: Map<PlayerId, number> = new Map();
  private touchBtnRect = { x: 0, y: 0, w: 100, h: 48 };
  private pointerdownHandler: ((e: PointerEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
    this.roundTimer = 45.0;
  }

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  public destroy(): void {
    this.removeListeners();
    if (typeof window !== 'undefined' && (window as unknown as { __CYBER_GRID_DEBUG__?: unknown }).__CYBER_GRID_DEBUG__) {
      delete (window as unknown as { __CYBER_GRID_DEBUG__?: unknown }).__CYBER_GRID_DEBUG__;
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.pointerdownHandler = (e: PointerEvent) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Touch Nitro/EMP Button
      const b = this.touchBtnRect;
      if (clickX >= b.x && clickX <= b.x + b.w && clickY >= b.y && clickY <= b.y + b.h) {
        const p1 = this.playersState.get(0);
        if (p1) this.triggerPlayerBoost(p1);
      }
    };

    window.addEventListener('pointerdown', this.pointerdownHandler);
  }

  private removeListeners(): void {
    if (typeof window === 'undefined') return;
    if (this.pointerdownHandler) {
      window.removeEventListener('pointerdown', this.pointerdownHandler);
      this.pointerdownHandler = null;
    }
  }

  public reset(width: number = 800, height: number = 600): void {
    this.isFinished = false;
    this.roundTimer = 45.0;
    this.playersState.clear();
    this.dataNodes = [];
    this.laserGates = [];
    this.nextNodeId = 0;
    this.nodeSpawnTimer = 0;
    this.botReactionTimers.clear();
    this.botBoostCooldowns.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const centerX = width / 2;
    const centerY = (height + 50) / 2;

    // Spawn players evenly around center arena
    active.forEach((p, idx) => {
      const angle = (idx / count) * Math.PI * 2;
      const dist = Math.min(width, height) * 0.32;
      this.playersState.set(p.id, {
        id: p.id,
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        angle: angle + Math.PI,
        radius: 17,
        score: 0,
        nitroEnergy: 100,
        isBoosting: false,
        boostDuration: 0,
        overclockTimer: 0,
        stunTimer: 0,
        coresCollected: 0,
        trail: []
      });
      this.botReactionTimers.set(p.id, 0.12 + Math.random() * 0.1);
    });

    // Spawn Initial Cyber Laser Gates
    this.setupLaserGates(width, height);

    // Spawn Initial Cluster of Data Nodes
    for (let i = 0; i < 10; i++) {
      this.spawnDataNode(width, height, i === 0 ? 'overclock' : i < 4 ? 'core' : 'packet');
    }

    this.touchBtnRect = {
      x: width * 0.5 - 55,
      y: height - 56,
      w: 110,
      h: 46
    };

    this.exposeDebug();
  }

  private setupLaserGates(width: number, height: number): void {
    const cx = width / 2;
    const cy = (height + 50) / 2;
    const gateOffset = Math.min(width, height) * 0.22;

    this.laserGates = [
      // Top Horizontal Gate
      { id: 1, x1: cx - 60, y1: cy - gateOffset, x2: cx + 60, y2: cy - gateOffset, isActive: true, hackedBy: null, cycleTimer: 0 },
      // Bottom Horizontal Gate
      { id: 2, x1: cx - 60, y1: cy + gateOffset, x2: cx + 60, y2: cy + gateOffset, isActive: true, hackedBy: null, cycleTimer: 1.5 },
      // Left Vertical Gate
      { id: 3, x1: cx - gateOffset, y1: cy - 50, x2: cx - gateOffset, y2: cy + 50, isActive: false, hackedBy: null, cycleTimer: 3.0 },
      // Right Vertical Gate
      { id: 4, x1: cx + gateOffset, y1: cy - 50, x2: cx + gateOffset, y2: cy + 50, isActive: false, hackedBy: null, cycleTimer: 4.5 }
    ];
  }

  private spawnDataNode(width: number, height: number, type: 'packet' | 'core' | 'overclock' = 'packet'): void {
    const margin = 55;
    const x = margin + Math.random() * (width - margin * 2);
    const y = 75 + Math.random() * (height - margin - 75);

    let radius = 7;
    let points = 1;
    if (type === 'core') {
      radius = 11;
      points = 3;
    } else if (type === 'overclock') {
      radius = 14;
      points = 8;
    }

    this.dataNodes.push({
      id: ++this.nextNodeId,
      x,
      y,
      radius,
      type,
      points,
      pulseAnim: Math.random() * Math.PI * 2
    });
  }

  private exposeDebug(): void {
    if (typeof window !== 'undefined') {
      const game = this;
      (window as unknown as { __CYBER_GRID_DEBUG__?: unknown }).__CYBER_GRID_DEBUG__ = {
        get players() {
          return Array.from(game.playersState.values());
        },
        get nodes() {
          return game.dataNodes;
        },
        get gates() {
          return game.laserGates;
        },
        triggerBoost: (playerId: PlayerId) => {
          const p = game.playersState.get(playerId);
          if (p) game.triggerPlayerBoost(p);
        }
      };
    }
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    // Dynamic data node spawning
    this.nodeSpawnTimer += dt;
    if (this.nodeSpawnTimer >= 1.8 && this.dataNodes.length < 16) {
      this.nodeSpawnTimer = 0;
      const typeRoll = Math.random();
      const nodeType = typeRoll < 0.15 ? 'overclock' : typeRoll < 0.45 ? 'core' : 'packet';
      this.spawnDataNode(width, height, nodeType);
    }

    // Update Laser Gate cycling
    for (const gate of this.laserGates) {
      gate.cycleTimer += dt;
      if (gate.cycleTimer >= 4.0) {
        gate.cycleTimer = 0;
        gate.isActive = !gate.isActive;
        gate.hackedBy = null;
      }
    }

    // 1. Process Hover Runner Physics, Boosts, and Inputs
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.stunTimer > 0) {
        ps.stunTimer -= dt;
        ps.vx *= Math.pow(0.88, dt * 60);
        ps.vy *= Math.pow(0.88, dt * 60);
        ps.x += ps.vx * dt;
        ps.y += ps.vy * dt;
        ps.angle += 14 * dt; // Rapid spin out on stun
        continue;
      }

      // Overclock Supercharge countdown
      if (ps.overclockTimer > 0) {
        ps.overclockTimer -= dt;
      }

      // Nitro recharge
      if (!ps.isBoosting && ps.nitroEnergy < 100) {
        ps.nitroEnergy = Math.min(100, ps.nitroEnergy + dt * 26);
      }

      // Boost timer countdown
      if (ps.isBoosting) {
        ps.boostDuration -= dt;
        if (ps.boostDuration <= 0) {
          ps.isBoosting = false;
        }
      }

      const steer = this.input.getSteer(p.id);
      const throttle = this.input.getThrottle(p.id);
      const isPressed = this.input.isPressed(p.id);
      const isAction = this.input.justAction(p.id);

      if (isAction && !ps.isBoosting) {
        this.triggerPlayerBoost(ps);
      }

      // Check if trailing behind leader (Catch-up slipstream for humans!)
      const isBot = p.type.startsWith('bot_');
      let isTrailing = false;
      if (!isBot) {
        for (const other of this.playersState.values()) {
          if (other.score > ps.score + 5) {
            isTrailing = true;
            break;
          }
        }
      }

      const isSupercharged = ps.overclockTimer > 0;
      let baseSpeed = isBot ? 175 : 230; // Calibrated bot speed: humans move faster than bots!
      if (!isBot && isTrailing) baseSpeed *= 1.18; // +18% catch-up slipstream

      const currentSpeedLimit = ps.isBoosting ? 440 : isSupercharged ? 320 : baseSpeed;
      const accelRate = ps.isBoosting ? 26 : 14;

      if (steer !== 0 || throttle !== 0) {
        const targetAngle = Math.atan2(-throttle, steer);
        // Smooth angular turning
        let diff = targetAngle - ps.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ps.angle += diff * Math.min(1, dt * 12);

        const targetVx = Math.cos(targetAngle) * currentSpeedLimit;
        const targetVy = Math.sin(targetAngle) * currentSpeedLimit;
        ps.vx += (targetVx - ps.vx) * Math.min(1, dt * accelRate);
        ps.vy += (targetVy - ps.vy) * Math.min(1, dt * accelRate);
      } else if (isPressed) {
        // Single Button Arcade: HOLD drives forward in current heading!
        const targetVx = Math.cos(ps.angle) * currentSpeedLimit;
        const targetVy = Math.sin(ps.angle) * currentSpeedLimit;
        ps.vx += (targetVx - ps.vx) * Math.min(1, dt * accelRate);
        ps.vy += (targetVy - ps.vy) * Math.min(1, dt * accelRate);
      } else {
        // Single Button Arcade: RELEASE smoothly steers in a scan arc
        if (!isBot) {
          ps.angle += dt * 2.8;
        }
        // Hover drift friction
        ps.vx *= Math.pow(0.92, dt * 60);
        ps.vy *= Math.pow(0.92, dt * 60);
      }

      // Apply velocity
      ps.x += ps.vx * dt;
      ps.y += ps.vy * dt;

      // Arena boundary bounce
      const minX = 26;
      const maxX = width - 26;
      const minY = 62;
      const maxY = height - 26;

      if (ps.x < minX) {
        ps.x = minX;
        ps.vx = Math.abs(ps.vx) * 0.8;
        this.audio.playBounce();
      } else if (ps.x > maxX) {
        ps.x = maxX;
        ps.vx = -Math.abs(ps.vx) * 0.8;
        this.audio.playBounce();
      }

      if (ps.y < minY) {
        ps.y = minY;
        ps.vy = Math.abs(ps.vy) * 0.8;
        this.audio.playBounce();
      } else if (ps.y > maxY) {
        ps.y = maxY;
        ps.vy = -Math.abs(ps.vy) * 0.8;
        this.audio.playBounce();
      }

      // Add to hover thruster trail
      ps.trail.push({ x: ps.x, y: ps.y, alpha: 1.0, color: p.color });
      if (ps.trail.length > (ps.isBoosting ? 24 : 14)) {
        ps.trail.shift();
      }

      // 2. Data Node Collection & Magnetic Attraction
      const isMagnetic = ps.overclockTimer > 0;
      const magnetRadius = isMagnetic ? 90 : 35;

      for (let i = this.dataNodes.length - 1; i >= 0; i--) {
        const node = this.dataNodes[i];
        const dist = Math.hypot(node.x - ps.x, node.y - ps.y);

        // Magnetic draw
        if (dist < magnetRadius && dist > 14) {
          const pullForce = 220 * dt;
          node.x += ((ps.x - node.x) / dist) * pullForce;
          node.y += ((ps.y - node.y) / dist) * pullForce;
        }

        // Direct Collection
        if (dist < ps.radius + node.radius + 6) {
          ps.score += node.points;
          ps.coresCollected++;
          this.audio.playScore();

          const sparkColor = node.type === 'overclock' ? '#F59E0B' : node.type === 'core' ? '#A855F7' : '#38BDF8';
          this.particles.spawnSparks(node.x, node.y, sparkColor, 12);
          this.particles.showFloatingText(`+${node.points}`, node.x, node.y - 20, sparkColor, 18);

          // Overclock Core trigger: 8 cores triggers Hyper Overclock Mode!
          if (node.type === 'overclock' || ps.coresCollected % 8 === 0) {
            ps.overclockTimer = 5.0; // 5s Supercharge!
            this.audio.playBoost();
            this.particles.shake(5);
            this.particles.showFloatingText('⚡ HYPER OVERCLOCK!', ps.x, ps.y - 36, '#F59E0B', 24);
          }

          this.dataNodes.splice(i, 1);
        }
      }

      // 3. Laser Gate Interactions
      for (const gate of this.laserGates) {
        if (!gate.isActive) continue;

        // Check if player intersects line segment
        const distToSegment = this.distToSegment(ps.x, ps.y, gate.x1, gate.y1, gate.x2, gate.y2);
        if (distToSegment < ps.radius + 6) {
          if (ps.isBoosting || ps.overclockTimer > 0) {
            // BREACH & HACK THE GATE!
            if (gate.hackedBy !== ps.id) {
              gate.hackedBy = ps.id;
              ps.score += 5;
              this.audio.playLaser();
              this.particles.shake(4);
              this.particles.spawnSparks((gate.x1 + gate.x2) / 2, (gate.y1 + gate.y2) / 2, p.color, 16);
              this.particles.showFloatingText('⚡ GATE BREACHED! +5', ps.x, ps.y - 25, p.color, 20);

              // Spawn bonus scatter data packets
              for (let k = 0; k < 3; k++) {
                this.spawnDataNode(width, height, 'packet');
              }
            }
          } else if (gate.hackedBy !== ps.id) {
            // SHOCK / SLOWDOWN
            ps.vx *= 0.25;
            ps.vy *= 0.25;
            this.audio.playExplosion();
            this.particles.spawnSparks(ps.x, ps.y, '#EF4444', 12);
            this.particles.showFloatingText('⚠️ LASER SHOCK!', ps.x, ps.y - 20, '#EF4444', 18);
          }
        }
      }
    }

    // 4. Inter-Player EMP Knockout & Data Snatches
    const playersList = Array.from(this.playersState.values());
    for (let i = 0; i < playersList.length; i++) {
      for (let j = i + 1; j < playersList.length; j++) {
        const p1 = playersList[i];
        const p2 = playersList[j];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = p1.radius + p2.radius;

        if (dist < minDist && dist > 0) {
          const nx = dx / dist;
          const ny = dy / dist;

          // Push apart
          const overlap = minDist - dist + 20;
          p1.x -= nx * overlap * 0.5;
          p1.y -= ny * overlap * 0.5;
          p2.x += nx * overlap * 0.5;
          p2.y += ny * overlap * 0.5;

          const p1Attacking = p1.isBoosting || p1.overclockTimer > 0;
          const p2Attacking = p2.isBoosting || p2.overclockTimer > 0;

          if (p1Attacking || p2Attacking) {
            // EMP Shockwave Collision!
            const attacker = p1Attacking ? p1 : p2;
            const victim = p1Attacking ? p2 : p1;

            victim.stunTimer = 0.85;
            const blastDirX = p1Attacking ? nx : -nx;
            const blastDirY = p1Attacking ? ny : -ny;

            victim.vx = blastDirX * 360;
            victim.vy = blastDirY * 360;
            attacker.score += 4;

            // Victim drops data packets!
            const dropped = Math.min(3, victim.score);
            victim.score = Math.max(0, victim.score - dropped);

            for (let d = 0; d < dropped; d++) {
              this.dataNodes.push({
                id: ++this.nextNodeId,
                x: victim.x + (Math.random() - 0.5) * 45,
                y: victim.y + (Math.random() - 0.5) * 45,
                radius: 7,
                type: 'packet',
                points: 1,
                pulseAnim: 0
              });
            }

            this.audio.playExplosion();
            this.particles.shake(6);
            this.particles.spawnSparks(victim.x, victim.y, '#38BDF8', 22);
            this.particles.showFloatingText('💥 EMP SNATCH!', attacker.x, attacker.y - 25, '#38BDF8', 22);
          } else {
            // Standard hover bump
            p1.vx = -nx * 180;
            p1.vy = -ny * 180;
            p2.vx = nx * 180;
            p2.vy = ny * 180;
            this.audio.playBounce();
          }
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
      this.audio.playFanfare();
    }
  }

  public triggerPlayerBoost(ps: HoverRunner): void {
    if (ps.nitroEnergy < 35 || ps.isBoosting || ps.stunTimer > 0) return;

    ps.isBoosting = true;
    ps.boostDuration = 0.65;
    ps.nitroEnergy = Math.max(0, ps.nitroEnergy - 45);

    const boostSpeed = 440;
    ps.vx = Math.cos(ps.angle) * boostSpeed;
    ps.vy = Math.sin(ps.angle) * boostSpeed;

    this.audio.playBoost();
    this.particles.shake(3);
    this.particles.spawnSparks(ps.x - Math.cos(ps.angle) * 20, ps.y - Math.sin(ps.angle) * 20, '#06B6D4', 16);
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const bot = this.playersState.get(botId);
    if (!bot || bot.stunTimer > 0) return;

    let boostCd = (this.botBoostCooldowns.get(botId) || 0) - dt;
    if (boostCd > 0) this.botBoostCooldowns.set(botId, boostCd);

    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    // Reaction update intervals: Easy (0.55s), Normal (0.38s), Hard (0.18s)
    const interval = difficulty === 'bot_hard' ? 0.18 : difficulty === 'bot_normal' ? 0.38 : 0.55;
    this.botReactionTimers.set(botId, interval);

    // Target Selection:
    // Easy: only perceives nodes within 200px, 35% chance to wander
    // Normal: perceives nodes within 300px, 18% chance to drift, fair human-like competition
    // Hard: perceives nodes up to 520px
    const maxVisionDist = difficulty === 'bot_hard' ? 520 : difficulty === 'bot_normal' ? 300 : 200;
    const wanderChance = difficulty === 'bot_easy' ? 0.35 : difficulty === 'bot_normal' ? 0.18 : 0;

    let bestNode: DataNode | null = null;
    let bestScore = -Infinity;

    if (Math.random() > wanderChance && this.dataNodes.length > 0) {
      for (const node of this.dataNodes) {
        const dist = Math.hypot(node.x - bot.x, node.y - bot.y);
        if (dist > maxVisionDist) continue;

        // Weight points fairly: Normal bot seeks nearby nodes rather than cross-mapping high-value nodes
        const pointWeight = difficulty === 'bot_hard' ? 28 : difficulty === 'bot_normal' ? 10 : 4;
        const score = (node.points * pointWeight) - dist;
        if (score > bestScore) {
          bestScore = score;
          bestNode = node;
        }
      }
    }

    let targetX = width / 2;
    let targetY = (height + 50) / 2;

    if (bestNode) {
      targetX = bestNode.x;
      targetY = bestNode.y;
    } else {
      // Gentle patrol around center
      targetX += Math.sin(this.roundTimer * 1.5 + botId) * 120;
      targetY += Math.cos(this.roundTimer * 1.5 + botId) * 90;
    }

    let targetAngle = Math.atan2(targetY - bot.y, targetX - bot.x);

    // Add human-like steering imperfection
    if (difficulty === 'bot_easy') {
      targetAngle += (Math.random() - 0.5) * 0.65;
    } else if (difficulty === 'bot_normal') {
      targetAngle += (Math.random() - 0.5) * 0.32;
    }

    // Hazard Avoidance: Active laser gates
    for (const gate of this.laserGates) {
      if (gate.isActive && gate.hackedBy !== bot.id && !bot.isBoosting) {
        const d = this.distToSegment(bot.x, bot.y, gate.x1, gate.y1, gate.x2, gate.y2);
        if (d < 50) {
          // On Normal/Easy, bot occasionally misjudges gate timing
          if (difficulty !== 'bot_hard' && Math.random() < 0.18) {
            // Slight delay / misjudgment
          } else {
            const gateAngle = Math.atan2((gate.y1 + gate.y2) / 2 - bot.y, (gate.x1 + gate.x2) / 2 - bot.x);
            targetAngle = gateAngle + Math.PI * 0.8;
          }
        }
      }
    }

    // Wall repulsion so bot doesn't pin itself on arena edges
    const margin = 50;
    if (bot.x < 26 + margin) targetAngle = 0;
    else if (bot.x > width - 26 - margin) targetAngle = Math.PI;
    if (bot.y < 62 + margin) targetAngle = Math.PI / 2;
    else if (bot.y > height - 26 - margin) targetAngle = -Math.PI / 2;

    const steer = Math.cos(targetAngle);
    const throttle = -Math.sin(targetAngle); // Negative Y is up in InputRouter

    // Tactical Nitro Boost: Gated by energy and cooldown
    let wantsBoost = false;
    if (boostCd <= 0 && !bot.isBoosting && bot.nitroEnergy >= (difficulty === 'bot_hard' ? 50 : 75)) {
      if (difficulty === 'bot_hard') {
        const dist = bestNode ? Math.hypot(bestNode.x - bot.x, bestNode.y - bot.y) : 0;
        if (dist > 180 && Math.random() < 0.35) wantsBoost = true;
      } else if (difficulty === 'bot_normal') {
        // Normal bot only boosts if trailing or for rare high-value cores
        if (bestNode && bestNode.points >= 3) {
          const dist = Math.hypot(bestNode.x - bot.x, bestNode.y - bot.y);
          if (dist > 160 && dist < 280 && Math.random() < 0.20) {
            wantsBoost = true;
          }
        }
      }
    }

    if (wantsBoost) {
      this.botBoostCooldowns.set(botId, 3.8); // 3.8s cooldown on boost
    }

    // Supply input through the router so bot uses identical hovercraft physics as human
    this.input.setBotInput(botId, true, steer, throttle, wantsBoost);
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const scores = this.getActivePlayers().map((p) => {
      const ps = this.playersState.get(p.id);
      return {
        playerId: p.id,
        score: ps?.score || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topPts = scores[0]?.score || 0;
    const mvpHighlight =
      winnerId !== null
        ? `Player ${winnerId + 1} dominated the cyber grid with ${topPts} harvested data packets!`
        : 'Draw! Cyber network grid synchronized!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Dark Synthwave Cyber Grid Floor
    ctx.fillStyle = '#050512';
    ctx.fillRect(0, 0, width, height);

    // Glowing Cyan Grid Lines with Perspective
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.16)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 35) {
      ctx.beginPath();
      ctx.moveTo(x, 50);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 50; y < height; y += 35) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Outer Cyber Barrier Frame
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 50, width - 32, height - 66);

    // 2. Render Laser Gates
    for (const gate of this.laserGates) {
      ctx.save();
      const gateColor = !gate.isActive ? 'rgba(100, 116, 139, 0.35)' : gate.hackedBy !== null ? this.players[gate.hackedBy].color : '#EF4444';

      ctx.strokeStyle = gateColor;
      ctx.lineWidth = gate.isActive ? 4 : 2;
      if (!gate.isActive) ctx.setLineDash([6, 6]);

      ctx.beginPath();
      ctx.moveTo(gate.x1, gate.y1);
      ctx.lineTo(gate.x2, gate.y2);
      ctx.stroke();

      // Gate Pylons
      ctx.fillStyle = gateColor;
      ctx.beginPath();
      ctx.arc(gate.x1, gate.y1, 6, 0, Math.PI * 2);
      ctx.arc(gate.x2, gate.y2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Render Floating Cyber Data Nodes
    for (const node of this.dataNodes) {
      ctx.save();
      node.pulseAnim += 0.05;
      const pulseScale = 1 + Math.sin(node.pulseAnim) * 0.15;

      ctx.translate(node.x, node.y);
      ctx.scale(pulseScale, pulseScale);

      if (node.type === 'overclock') {
        // Golden Overclock Core (Rotating Octahedron)
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.moveTo(0, -node.radius);
        ctx.lineTo(node.radius, 0);
        ctx.lineTo(0, node.radius);
        ctx.lineTo(-node.radius, 0);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (node.type === 'core') {
        // Purple Cyber Core
        ctx.fillStyle = '#A855F7';
        ctx.beginPath();
        ctx.arc(0, 0, node.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#E9D5FF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        // Regular Cyan Data Packet (Diamond)
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.moveTo(0, -node.radius);
        ctx.lineTo(node.radius * 0.8, 0);
        ctx.lineTo(0, node.radius);
        ctx.lineTo(-node.radius * 0.8, 0);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    // 4. Render Hover Runner Trails
    for (const [, p] of this.playersState) {
      for (let i = 0; i < p.trail.length; i++) {
        const pt = p.trail[i];
        const alpha = (i / p.trail.length) * 0.7;
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
    }

    // 5. Render Hover Runners
    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.x, ps.y);
      ctx.rotate(ps.angle);

      // Supercharge Aura
      if (ps.overclockTimer > 0) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, ps.radius + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Hoverboard Deck
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.roundRect(-ps.radius - 2, -7, ps.radius * 2 + 4, 14, 5);
      ctx.fill();

      // Neon Deck Trim
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Cyber Pilot Visor / Core
      ctx.fillStyle = ps.isBoosting ? '#38BDF8' : '#FFFFFF';
      ctx.beginPath();
      ctx.arc(2, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      // Thruster Flame when boosting
      if (ps.isBoosting) {
        ctx.fillStyle = '#06B6D4';
        ctx.beginPath();
        ctx.moveTo(-ps.radius - 2, -4);
        ctx.lineTo(-ps.radius - 14, 0);
        ctx.lineTo(-ps.radius - 2, 4);
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();

      // Stunned indicator
      if (ps.stunTimer > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = '900 11px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💫 EMP STUN!', ps.x, ps.y - ps.radius - 10);
      } else {
        // Nitro Gauge above runner
        const barW = 34;
        const barH = 4;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.fillRect(ps.x - barW / 2, ps.y - ps.radius - 8, barW, barH);
        ctx.fillStyle = ps.nitroEnergy >= 35 ? '#06B6D4' : '#64748B';
        ctx.fillRect(ps.x - barW / 2, ps.y - ps.radius - 8, (ps.nitroEnergy / 100) * barW, barH);
      }
    }

    // 6. Draw On-Screen Touch Boost Button
    const p1 = this.playersState.get(0);
    const p1IsBot = this.getPlayer(0)?.type.startsWith('bot_');
    if (p1 && !p1IsBot) {
      ctx.save();
      const b = this.touchBtnRect;
      ctx.fillStyle = p1.nitroEnergy >= 35 ? '#0284C7' : '#334155';
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 10);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡ NITRO', b.x + b.w / 2, b.y + b.h / 2);
      ctx.restore();
    }

    // 7. Draw HUD
    this.renderHUD(ctx, width, height);
  }

  private renderHUD(ctx: CanvasRenderingContext2D, width: number, _height: number): void {
    ctx.save();
    // Clean HUD Banner (Positioned cleanly below top countdown timer pill)
    const bannerW = Math.min(580, width - 60);
    const bannerH = 46;
    const bannerX = (width - bannerW) / 2;
    const bannerY = 56;

    ctx.fillStyle = 'rgba(5, 5, 18, 0.90)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bannerX, bannerY, bannerW, bannerH, 10);
    else ctx.rect(bannerX, bannerY, bannerW, bannerH);
    ctx.fill();

    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 12px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡ CYBER GRID RUNNER: HARVEST DATA CORES • SPACE / TAP: NITRO BOOST', bannerX + bannerW / 2, bannerY + 15);

    // Live score pills in banner
    const active = this.getActivePlayers();
    const scoreStr = active.map(p => {
      const ps = this.playersState.get(p.id);
      const icon = ps && ps.overclockTimer > 0 ? '⚡' : '💾';
      return `${this.players[p.id].name}: ${icon} ${ps?.score || 0} pts`;
    }).join('   |   ');

    ctx.font = '700 11px Montserrat, sans-serif';
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(scoreStr, bannerX + bannerW / 2, bannerY + 31);

    ctx.restore();
  }
}

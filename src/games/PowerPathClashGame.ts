import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

export interface GateOption {
  type: 'enemy' | 'buff' | 'multiplier' | 'boss';
  label: string;
  sublabel: string;
  icon: string;
  requiredPower?: number; // for enemy/boss
  powerDelta: number; // added to power on victory
  multiplier?: number; // e.g. 1.5 or 2.0
  color: string;
}

export interface FloorGate {
  floorIndex: number;
  options: GateOption[];
  y: number;
  height: number;
}

export interface PathPlayerState {
  id: PlayerId;
  power: number;
  currentFloor: number;
  maxFloors: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  selectedOptionIndex: number; // 0 (left), 1 (center/right)
  readyForClash: boolean;
  score: number;
  clashX: number;
  clashY: number;
  isKo: boolean;
  scale: number;
}

export type GamePhase = 'path_selection' | 'clash_intro' | 'clash_combat' | 'clash_finisher' | 'finished';

export class PowerPathClashGame extends BaseGame {
  private playerStates: Map<PlayerId, PathPlayerState> = new Map();
  private towerFloors: Map<PlayerId, FloorGate[]> = new Map();
  private gamePhase: GamePhase = 'path_selection';
  private phaseTimer: number = 0;
  private clashStrikes: number = 0;
  private clashTimer: number = 0;
  private winnerPlayerId: PlayerId | null = null;
  private autoAdvanceTimer: number = 25.0; // timer for path phase

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

  public reset(width: number = 800, height: number = 600): void {
    this.roundTimer = 45.0;
    this.isFinished = false;
    this.gamePhase = 'path_selection';
    this.phaseTimer = 0;
    this.clashStrikes = 0;
    this.clashTimer = 0;
    this.winnerPlayerId = null;
    this.autoAdvanceTimer = 25.0;
    this.playerStates.clear();
    this.towerFloors.clear();

    this.input.setControlMode('directional');

    const active = this.getActivePlayers();
    const count = active.length;

    // Generate balanced 5-floor progression for each player's lane
    active.forEach((p, idx) => {
      // Lane boundaries
      const laneWidth = width / count;
      const laneCenterX = laneWidth * idx + laneWidth / 2;

      // Starting state
      this.playerStates.set(p.id, {
        id: p.id,
        power: 10, // Starting power
        currentFloor: 0,
        maxFloors: 5,
        x: laneCenterX,
        y: height - 60,
        targetX: laneCenterX,
        targetY: height - 60,
        selectedOptionIndex: 0,
        readyForClash: false,
        score: 0,
        clashX: laneCenterX,
        clashY: height / 2,
        isKo: false,
        scale: 1.0
      });

      // Generate 5 floors of choices
      this.generateFloorsForPlayer(p.id, height);
    });

    if (typeof window !== 'undefined') {
      (window as any).__POWER_PATH_CLASH_DEBUG__ = {
        game: this,
        getPhase: () => this.gamePhase,
        getPlayerState: (id: PlayerId) => this.playerStates.get(id),
        getFloors: (id: PlayerId) => this.towerFloors.get(id),
        selectChoice: (id: PlayerId, optionIndex: number) => {
          this.handlePlayerSelect(id, optionIndex);
        },
        forceClash: () => {
          this.startClashIntro();
        },
        setPower: (id: PlayerId, power: number) => {
          const ps = this.playerStates.get(id);
          if (ps) ps.power = power;
        }
      };
    }
  }

  private generateFloorsForPlayer(playerId: PlayerId, height: number): void {
    const floors: FloorGate[] = [];
    const floorH = (height - 150) / 5;

    // Floor 0: Entry Level (Easy choice)
    floors.push({
      floorIndex: 0,
      y: height - 130,
      height: floorH,
      options: [
        {
          type: 'enemy',
          label: 'Goblin',
          sublabel: '5 POW',
          icon: '👺',
          requiredPower: 5,
          powerDelta: 6,
          color: '#10B981'
        },
        {
          type: 'enemy',
          label: 'Wolf',
          sublabel: '7 POW',
          icon: '🐺',
          requiredPower: 7,
          powerDelta: 9,
          color: '#3B82F6'
        }
      ]
    });

    // Floor 1: Mid Level (Decision: Safe small enemy or riskier bigger enemy)
    floors.push({
      floorIndex: 1,
      y: height - 130 - floorH,
      height: floorH,
      options: [
        {
          type: 'enemy',
          label: 'Orc Brute',
          sublabel: '14 POW',
          icon: '👹',
          requiredPower: 14,
          powerDelta: 16,
          color: '#F59E0B'
        },
        {
          type: 'buff',
          label: 'Elixir',
          sublabel: '+10 POW',
          icon: '🧪',
          powerDelta: 10,
          color: '#A855F7'
        }
      ]
    });

    // Floor 2: High Stakes (Multiplier or Golem)
    floors.push({
      floorIndex: 2,
      y: height - 130 - floorH * 2,
      height: floorH,
      options: [
        {
          type: 'enemy',
          label: 'Stone Golem',
          sublabel: '25 POW',
          icon: '🗿',
          requiredPower: 25,
          powerDelta: 28,
          color: '#EF4444'
        },
        {
          type: 'multiplier',
          label: 'War Blade',
          sublabel: 'x1.5 POW',
          icon: '⚔️',
          powerDelta: 0,
          multiplier: 1.5,
          color: '#EC4899'
        }
      ]
    });

    // Floor 3: Elite Guardian
    floors.push({
      floorIndex: 3,
      y: height - 130 - floorH * 3,
      height: floorH,
      options: [
        {
          type: 'enemy',
          label: 'Wyvern',
          sublabel: '45 POW',
          icon: '🦇',
          requiredPower: 45,
          powerDelta: 50,
          color: '#F97316'
        },
        {
          type: 'multiplier',
          label: 'Thunder Rune',
          sublabel: 'x2.0 POW',
          icon: '⚡',
          powerDelta: 0,
          multiplier: 2.0,
          color: '#FACC15'
        }
      ]
    });

    // Floor 4: Final Tower Boss
    floors.push({
      floorIndex: 4,
      y: height - 130 - floorH * 4,
      height: floorH,
      options: [
        {
          type: 'boss',
          label: 'Inferno Drake',
          sublabel: '75 POW',
          icon: '🐉',
          requiredPower: 75,
          powerDelta: 90,
          color: '#DC2626'
        },
        {
          type: 'boss',
          label: 'Titan Lord',
          sublabel: '95 POW',
          icon: '👑',
          requiredPower: 95,
          powerDelta: 120,
          color: '#7C3AED'
        }
      ]
    });

    this.towerFloors.set(playerId, floors);
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    if (this.gamePhase === 'path_selection') {
      this.updatePathSelectionPhase(dt, width, height);
    } else if (this.gamePhase === 'clash_intro') {
      this.updateClashIntro(dt, width, height);
    } else if (this.gamePhase === 'clash_combat') {
      this.updateClashCombat(dt, width, height);
    } else if (this.gamePhase === 'clash_finisher') {
      this.updateClashFinisher(dt, width, height);
    }
  }

  private updatePathSelectionPhase(dt: number, width: number, height: number): void {
    this.roundTimer -= dt;
    this.autoAdvanceTimer -= dt;

    if (this.roundTimer <= 0 || this.autoAdvanceTimer <= 0) {
      // Force transition to clash
      this.startClashIntro();
      return;
    }

    this.updateBots(dt, width, height);

    const active = this.getActivePlayers();
    let allFinished = true;

    for (const p of active) {
      const ps = this.playerStates.get(p.id);
      if (!ps) continue;

      if (!ps.readyForClash) {
        allFinished = false;

        // Check player movement inputs to pick Left/Right or advance
        const rawSteer = this.input.getRawSteer(p.id);
        const steer = Math.abs(rawSteer) > 0 ? rawSteer : this.input.getSteer(p.id);
        const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
        const justUp = this.input.justUp(p.id);

        if (steer < -0.3) {
          ps.selectedOptionIndex = 0;
        } else if (steer > 0.3) {
          ps.selectedOptionIndex = 1;
        }

        // Advance through current door on Action or Up key
        if (justAction || justUp) {
          this.handlePlayerSelect(p.id, ps.selectedOptionIndex);
        }
      }

      // Smooth movement towards target
      ps.x += (ps.targetX - ps.x) * (1 - Math.exp(-12 * dt));
      ps.y += (ps.targetY - ps.y) * (1 - Math.exp(-12 * dt));
    }

    if (allFinished) {
      this.startClashIntro();
    }
  }

  public handlePlayerSelect(playerId: PlayerId, optionIndex: number): void {
    const ps = this.playerStates.get(playerId);
    const floors = this.towerFloors.get(playerId);
    if (!ps || !floors || ps.readyForClash) return;

    if (ps.currentFloor >= ps.maxFloors) {
      ps.readyForClash = true;
      return;
    }

    const currentGate = floors[ps.currentFloor];
    const option = currentGate.options[optionIndex];
    if (!option) return;

    const width = 800;
    const active = this.getActivePlayers();
    const laneWidth = width / active.length;
    const laneX = laneWidth * active.findIndex(p => p.id === playerId);
    const optX = laneX + (optionIndex === 0 ? laneWidth * 0.28 : laneWidth * 0.72);

    // Resolve Door Outcome
    if (option.type === 'enemy' || option.type === 'boss') {
      const req = option.requiredPower || 0;
      if (ps.power >= req) {
        // VICTORY! Absorbed enemy power!
        ps.power += option.powerDelta;
        this.audio.playTone(659.25, 0.09, 'triangle');
        setTimeout(() => this.audio.playTone(987.77, 0.12, 'sine'), 70);
        this.particles.spawnExplosion(optX, currentGate.y, option.color, 16);
        this.particles.showFloatingText(`+${option.powerDelta} POWER!`, optX, currentGate.y - 14, '#34D399', 18);
      } else {
        // OVERPOWERED! Player took damage!
        const loss = Math.max(3, Math.floor(ps.power * 0.4));
        ps.power = Math.max(1, ps.power - loss);
        this.audio.playBuzzer();
        this.particles.shake(0.25);
        this.particles.spawnExplosion(optX, currentGate.y, '#EF4444', 16);
        this.particles.showFloatingText(`-${loss} OVERPOWERED!`, optX, currentGate.y - 14, '#EF4444', 18);
      }
    } else if (option.type === 'buff') {
      ps.power += option.powerDelta;
      this.audio.playTone(783.99, 0.12, 'sine');
      this.particles.spawnSparks(optX, currentGate.y, '#A855F7', 12);
      this.particles.showFloatingText(`+${option.powerDelta} BUFF!`, optX, currentGate.y - 14, '#C084FC', 18);
    } else if (option.type === 'multiplier') {
      const mult = option.multiplier || 1.5;
      const boost = Math.round(ps.power * (mult - 1));
      ps.power = Math.round(ps.power * mult);
      this.audio.playTone(880, 0.14, 'square');
      this.particles.spawnSparks(optX, currentGate.y, '#FACC15', 14);
      this.particles.showFloatingText(`x${mult} MULTIPLIER!`, optX, currentGate.y - 14, '#FACC15', 20);
    }

    // Grow scale with power
    ps.scale = Math.min(1.8, 1.0 + (ps.power - 10) * 0.006);

    // Advance floor
    ps.currentFloor += 1;
    if (ps.currentFloor >= ps.maxFloors) {
      ps.readyForClash = true;
      ps.targetY = 70; // Stand proudly at summit
      ps.targetX = laneX + laneWidth / 2;
      this.audio.playTone(1046.5, 0.16, 'sine');
      this.particles.showFloatingText('👑 SUMMIT REACHED!', ps.targetX, 50, '#FBBF24', 22);
    } else {
      const nextGate = floors[ps.currentFloor];
      ps.targetY = nextGate.y + 25;
      ps.targetX = optX;
    }
  }

  private startClashIntro(): void {
    this.gamePhase = 'clash_intro';
    this.phaseTimer = 1.6;

    this.audio.playTone(220, 0.15, 'sawtooth');
    setTimeout(() => this.audio.playTone(440, 0.25, 'triangle'), 150);
    this.particles.shake(0.35);

    // Reposition players to opposite sides of the arena center
    const active = this.getActivePlayers();
    if (active.length >= 2) {
      const p0 = this.playerStates.get(active[0].id);
      const p1 = this.playerStates.get(active[1].id);
      if (p0) {
        p0.clashX = 220;
        p0.clashY = 300;
        p0.x = 220;
        p0.y = 300;
      }
      if (p1) {
        p1.clashX = 580;
        p1.clashY = 300;
        p1.x = 580;
        p1.y = 300;
      }
    }
  }

  private updateClashIntro(dt: number, width: number, height: number): void {
    this.phaseTimer -= dt;
    if (this.phaseTimer <= 0) {
      this.gamePhase = 'clash_combat';
      this.phaseTimer = 2.4;
      this.clashStrikes = 0;
      this.clashTimer = 0.35;
    }
  }

  private updateClashCombat(dt: number, width: number, height: number): void {
    this.phaseTimer -= dt;
    this.clashTimer -= dt;

    const active = this.getActivePlayers();
    const p0 = this.playerStates.get(active[0]?.id);
    const p1 = this.playerStates.get(active[1]?.id);

    // Multi-strike clash impacts
    if (this.clashTimer <= 0 && this.clashStrikes < 5) {
      this.clashStrikes++;
      this.clashTimer = 0.38;

      const strikeX = width / 2 + (Math.random() - 0.5) * 60;
      const strikeY = height / 2 + (Math.random() - 0.5) * 40;

      this.audio.playTone(300 + this.clashStrikes * 90, 0.08, 'square');
      this.particles.shake(0.22);
      this.particles.spawnExplosion(strikeX, strikeY, this.clashStrikes % 2 === 0 ? '#38BDF8' : '#EF4444', 16);

      // Flying clash damage sparks
      const dmg0 = p0 ? Math.round(p0.power * (0.8 + Math.random() * 0.4)) : 10;
      const dmg1 = p1 ? Math.round(p1.power * (0.8 + Math.random() * 0.4)) : 10;
      this.particles.showFloatingText(`${dmg0} DMG!`, strikeX - 35, strikeY - 18, '#38BDF8', 16);
      this.particles.showFloatingText(`${dmg1} DMG!`, strikeX + 35, strikeY + 18, '#EF4444', 16);
    }

    if (this.phaseTimer <= 0) {
      // Determine winner: highest damage person wins no matter what!
      this.gamePhase = 'clash_finisher';
      this.phaseTimer = 2.5;

      const power0 = p0?.power || 0;
      const power1 = p1?.power || 0;

      if (power0 > power1) {
        this.winnerPlayerId = active[0].id;
        if (p1) p1.isKo = true;
      } else if (power1 > power0) {
        this.winnerPlayerId = active[1].id;
        if (p0) p0.isKo = true;
      } else {
        // Exact tie - random decisive strike
        this.winnerPlayerId = active[0].id;
        if (p1) p1.isKo = true;
      }

      // Execute Finisher Impact!
      this.audio.playExplosion();
      this.particles.shake(0.5);
      this.particles.spawnExplosion(width / 2, height / 2, '#F59E0B', 32);

      const winPower = Math.max(power0, power1);
      this.particles.showFloatingText(`💥 ${winPower} CRITICAL FINISHER!`, width / 2, height / 2 - 40, '#FACC15', 28);
    }
  }

  private updateClashFinisher(dt: number, width: number, height: number): void {
    this.phaseTimer -= dt;

    // Knockback the loser
    const active = this.getActivePlayers();
    for (const p of active) {
      const ps = this.playerStates.get(p.id);
      if (!ps) continue;

      if (ps.isKo) {
        // Blasted off screen
        const launchDir = p.id === active[0].id ? -1 : 1;
        ps.clashX += launchDir * 350 * dt;
        ps.clashY += 80 * dt;
      } else {
        // Winner charges to center stage
        ps.clashX += (width / 2 - ps.clashX) * (1 - Math.exp(-8 * dt));
        ps.clashY += (height / 2 - ps.clashY) * (1 - Math.exp(-8 * dt));
      }
    }

    if (this.phaseTimer <= 0) {
      this.gamePhase = 'finished';
      this.isFinished = true;

      // Assign scores based on power
      for (const p of active) {
        const ps = this.playerStates.get(p.id);
        if (ps) {
          ps.score = ps.power + (p.id === this.winnerPlayerId ? 100 : 0);
        }
      }
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playerStates.get(botId);
    const floors = this.towerFloors.get(botId);
    if (!ps || !floors || ps.readyForClash) return;

    if (ps.currentFloor >= ps.maxFloors) return;

    // Rate-limit bot decisions (~350ms delay)
    if (Math.random() > 0.08) return;

    const currentGate = floors[ps.currentFloor];
    const opts = currentGate.options;

    // Evaluate choices
    let bestOptionIndex = 0;
    let bestResultingPower = -999;

    opts.forEach((opt, idx) => {
      let projectedPower = ps.power;

      if (opt.type === 'enemy' || opt.type === 'boss') {
        const req = opt.requiredPower || 0;
        if (ps.power >= req) {
          projectedPower += opt.powerDelta;
        } else {
          projectedPower = Math.max(1, ps.power - Math.floor(ps.power * 0.4));
        }
      } else if (opt.type === 'buff') {
        projectedPower += opt.powerDelta;
      } else if (opt.type === 'multiplier') {
        projectedPower = Math.round(ps.power * (opt.multiplier || 1.5));
      }

      if (difficulty === 'bot_easy' && Math.random() < 0.25) {
        // Easy bot occasionally picks randomly
        projectedPower += (Math.random() - 0.5) * 40;
      }

      if (projectedPower > bestResultingPower) {
        bestResultingPower = projectedPower;
        bestOptionIndex = idx;
      }
    });

    this.handlePlayerSelect(botId, bestOptionIndex);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const now = performance.now() * 0.001;

    if (this.gamePhase === 'path_selection') {
      this.renderPathSelection(ctx, width, height, now);
    } else {
      this.renderClashArena(ctx, width, height, now);
    }
  }

  private renderPathSelection(ctx: CanvasRenderingContext2D, width: number, height: number, now: number): void {
    // Cyber Dungeon Background
    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    const laneWidth = width / count;

    // Render each player's path lane
    active.forEach((p, idx) => {
      const laneX = laneWidth * idx;
      const floors = this.towerFloors.get(p.id) || [];
      const ps = this.playerStates.get(p.id);

      // Lane Divider
      if (idx > 0) {
        ctx.strokeStyle = '#1E293B';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(laneX, 40);
        ctx.lineTo(laneX, height);
        ctx.stroke();
      }

      // Summit Goal Platform at the top
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(laneX + 10, 48, laneWidth - 20, 36);
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(laneX + 10, 48, laneWidth - 20, 36);

      ctx.fillStyle = '#FDE68A';
      ctx.font = '900 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑 SUMMIT COLOSSEUM', laneX + laneWidth / 2, 70);

      // Render Floors & Doors
      floors.forEach((floor) => {
        const isCurrentFloor = ps?.currentFloor === floor.floorIndex;
        const isPassed = (ps?.currentFloor || 0) > floor.floorIndex;

        floor.options.forEach((opt, optIdx) => {
          const optW = laneWidth * 0.42;
          const optH = floor.height - 12;
          const optX = laneX + (optIdx === 0 ? laneWidth * 0.06 : laneWidth * 0.52);
          const optY = floor.y - optH / 2;

          ctx.save();

          // Door Box
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(optX, optY, optW, optH, 8);
          else ctx.rect(optX, optY, optW, optH);

          if (isPassed) {
            ctx.fillStyle = '#0F172A';
            ctx.fill();
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1;
            ctx.stroke();
          } else if (isCurrentFloor) {
            // Highlight active selectable doors
            const isSelected = ps?.selectedOptionIndex === optIdx;
            ctx.fillStyle = isSelected ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.85)';
            ctx.fill();
            ctx.strokeStyle = isSelected ? '#FACC15' : opt.color;
            ctx.lineWidth = isSelected ? 2.5 : 1.5;
            ctx.stroke();
          } else {
            // Locked future doors
            ctx.fillStyle = '#090D16';
            ctx.fill();
            ctx.strokeStyle = '#1E293B';
            ctx.lineWidth = 1;
            ctx.stroke();
          }

          // Door Icon & Labels
          ctx.font = '20px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(opt.icon, optX + optW / 2, optY + 24);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = '800 11px Montserrat, sans-serif';
          ctx.fillText(opt.label, optX + optW / 2, optY + 40);

          ctx.fillStyle = opt.color;
          ctx.font = '900 12px Montserrat, sans-serif';
          ctx.fillText(opt.sublabel, optX + optW / 2, optY + 54);

          ctx.restore();
        });
      });

      // Render Player Avatar & Power Badge
      if (ps) {
        ctx.save();
        ctx.translate(ps.x, ps.y);
        ctx.scale(ps.scale, ps.scale);

        // Power Glowing Aura
        const pulse = 1.0 + Math.sin(now * 6 + p.id) * 0.12;
        ctx.beginPath();
        ctx.arc(0, 0, 18 * pulse, 0, Math.PI * 2);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        this.drawPlayerMascot(ctx, p.id, 0, 0, 14, 'focused', now);

        // Floating Power Badge above head
        ctx.fillStyle = '#FACC15';
        ctx.font = '900 12px Montserrat, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`⚔️ ${ps.power} POW`, 0, -22);

        ctx.restore();
      }
    });

    // Top HUD Bar
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.5;
    ctx.fillRect(width / 2 - 190, 8, 380, 28);
    ctx.strokeRect(width / 2 - 190, 8, 380, 28);

    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    const timerSec = Math.max(0, Math.ceil(this.autoAdvanceTimer));
    ctx.fillText(`CHOOSE YOUR PATH • FIGHT TO ABSORB • CLASH IN ${timerSec}s`, width / 2, 26);
    ctx.restore();

    // Bottom Controls Hint
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1;
    ctx.fillRect(width / 2 - 240, height - 30, 480, 24);
    ctx.strokeRect(width / 2 - 240, height - 30, 480, 24);

    ctx.font = '700 10.5px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('P1: [A / D] Select Door • [W / SPACE] Enter  │  P2: [ARROWS] Select • [ENTER] Enter', width / 2, height - 14);
    ctx.restore();
  }

  private renderClashArena(ctx: CanvasRenderingContext2D, width: number, height: number, now: number): void {
    // Electric Colosseum Arena Background
    const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, width * 0.6);
    bgGrad.addColorStop(0, '#1E1B4B'); // Electric Indigo
    bgGrad.addColorStop(0.6, '#0F172A');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Combat Arena Center Ring
    ctx.save();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 160, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 110, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Central Title Banner
    ctx.save();
    ctx.font = '900 24px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FDE047';
    ctx.shadowColor = '#F59E0B';
    ctx.shadowBlur = 12;

    if (this.gamePhase === 'clash_intro') {
      ctx.fillText('⚔️ FINAL SHOWDOWN: CLASH! ⚔️', width / 2, 110);
    } else if (this.gamePhase === 'clash_combat') {
      ctx.fillText('💥 COMBO CLASH! 💥', width / 2, 110);
    } else {
      const winName = this.winnerPlayerId !== null ? this.players[this.winnerPlayerId].name : 'CHAMPION';
      ctx.fillText(`🏆 ${winName} WINS! 🏆`, width / 2, 110);
    }
    ctx.restore();

    // Render Clashing Combatants
    const active = this.getActivePlayers();
    for (const p of active) {
      const ps = this.playerStates.get(p.id);
      if (!ps) continue;

      ctx.save();
      ctx.translate(ps.clashX, ps.clashY);
      ctx.scale(ps.scale * 1.2, ps.scale * 1.2);

      // Aura
      const auraColor = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fillStyle = auraColor;
      ctx.globalAlpha = 0.25;
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = auraColor;
      ctx.lineWidth = 2;
      ctx.stroke();

      this.drawPlayerMascot(ctx, p.id, 0, 0, 16, ps.isKo ? 'shocked' : 'focused', now);

      // Huge Final Damage Stat Badge
      ctx.fillStyle = '#FACC15';
      ctx.font = '900 14px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`⚔️ ${ps.power} DMG`, 0, -28);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 11px Montserrat, sans-serif';
      ctx.fillText(p.name, 0, 32);

      ctx.restore();
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    let winnerId: PlayerId | null = this.winnerPlayerId;

    if (winnerId === null) {
      let maxPower = -1;
      active.forEach(p => {
        const ps = this.playerStates.get(p.id);
        if (ps && ps.power > maxPower) {
          maxPower = ps.power;
          winnerId = p.id;
        }
      });
    }

    const sorted = [...active].sort((a, b) => {
      const pA = this.playerStates.get(a.id)?.power || 0;
      const pB = this.playerStates.get(b.id)?.power || 0;
      return pB - pA;
    });

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      place: idx + 1,
      score: this.playerStates.get(p.id)?.power || 0
    }));

    const winPower = winnerId !== null ? this.playerStates.get(winnerId)?.power || 0 : 0;
    const winName = winnerId !== null ? this.players[winnerId].name : 'The Champion';

    return {
      winnerId,
      rankings,
      mvpHighlight: `${winName} built a massive ${winPower} DMG build and crushed the Final Showdown!`
    };
  }
}

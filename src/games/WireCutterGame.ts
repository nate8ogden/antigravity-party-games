import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export interface WireCutterTheme {
  name: string;
  bgGradStart: string;
  bgGradEnd: string;
  bombChassis: string;
  bombBorder: string;
  screenBg: string;
  screenBorder: string;
  screenText: string;
  themePillColor: string;
}

export const WIRE_CUTTER_THEMES: WireCutterTheme[] = [
  {
    name: 'Cyber Terminal ⚡',
    bgGradStart: '#090D16',
    bgGradEnd: '#020617',
    bombChassis: '#1E293B',
    bombBorder: '#475569',
    screenBg: '#020617',
    screenBorder: '#0284C7',
    screenText: '#38BDF8',
    themePillColor: '#38BDF8'
  },
  {
    name: 'Cold War C4 💣',
    bgGradStart: '#1C1917',
    bgGradEnd: '#0C0A09',
    bombChassis: '#292524',
    bombBorder: '#78716C',
    screenBg: '#1C1917',
    screenBorder: '#F59E0B',
    screenText: '#FDE047',
    themePillColor: '#F59E0B'
  },
  {
    name: 'Spaceship Core 🚀',
    bgGradStart: '#0F172A',
    bgGradEnd: '#030712',
    bombChassis: '#334155',
    bombBorder: '#94A3B8',
    screenBg: '#0F172A',
    screenBorder: '#10B981',
    screenText: '#6EE7B7',
    themePillColor: '#10B981'
  }
];

interface WireModule {
  instructionText: string;
  subPrompt?: string;
  type: 'single' | 'sequence' | 'all_except_then';
  sequence?: number[];
  exceptWireIndex?: number;
  correctWireIndex: number;
  avoidWireIndex?: number;
  wires: { color: string; label: string; keyHint: string }[];
  timer: number;
  maxTimer: number;
  totalSteps: number;
}

interface WirePlayer {
  id: PlayerId;
  score: number;
  stunTimer: number;
  feedbackText: string;
  feedbackColor: string;
  feedbackTimer: number;
  scissorsAngle: number;
  inputDebounceTimer: number;
  sequenceStep: number;
  cutWiresThisModule: Set<number>;
  lastDirection: number | null;
  activeKeysDown: Set<string>;
  pointerQueue: number[];
  isUnderdog: boolean;
  streak: number;
}

export class WireCutterGame extends BaseGame {
  private wirePlayers: WirePlayer[] = [];
  private currentModule: WireModule = {
    instructionText: '',
    type: 'single',
    correctWireIndex: 0,
    wires: [],
    timer: 4.0,
    maxTimer: 4.0,
    totalSteps: 1
  };

  private selectedWireIndex: number = 0;
  private botReactionTimers: Map<PlayerId, number> = new Map();
  private moduleRound: number = 0;

  // Polish & Theme Properties
  private currentThemeIndex: number = 0;
  private animTimer: number = 0;
  private suddenDeathAnnounced: boolean = false;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private pointerdownListener: ((e: PointerEvent) => void) | null = null;

  constructor(players: PlayerConfig[], input: InputRouter, audio: AudioEngine, particles: ParticleSystem) {
    super(players, input, audio, particles);
    this.roundTimer = 32.0;
  }

  public init(width: number, height: number): void {
    this.setupListeners();
    this.reset(width, height);
  }

  public destroy(): void {
    this.removeListeners();
    super.destroy();
    if (typeof window !== 'undefined' && (window as unknown as { __WIRE_CUTTER_DEBUG__?: unknown }).__WIRE_CUTTER_DEBUG__) {
      delete (window as unknown as { __WIRE_CUTTER_DEBUG__?: unknown }).__WIRE_CUTTER_DEBUG__;
    }
  }

  private setupListeners(): void {
    if (typeof window === 'undefined') return;
    this.removeListeners();

    this.keydownListener = (e: KeyboardEvent) => {
      if (this.isFinished) return;
      if (e.code === 'KeyT') {
        this.currentThemeIndex = (this.currentThemeIndex + 1) % WIRE_CUTTER_THEMES.length;
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
        this.currentThemeIndex = (this.currentThemeIndex + 1) % WIRE_CUTTER_THEMES.length;
        this.audio.playTap();
        return;
      }

      // Direct wire clicking
      const cx = canvas.width / 2;
      const bombH = Math.min(350, canvas.height * 0.65);
      const bombY = canvas.height / 2 - bombH / 2 - 10;
      const screenH = 65;
      const cy = bombY + 16 + screenH + (bombH - screenH - 32) / 2;
      const wireLength = 95;
      const wirePositions = [
        { idx: 0, x: cx, y: cy - wireLength },
        { idx: 1, x: cx + wireLength, y: cy },
        { idx: 2, x: cx, y: cy + wireLength },
        { idx: 3, x: cx - wireLength, y: cy }
      ];

      for (const w of wirePositions) {
        if (Math.hypot(clickX - w.x, clickY - w.y) <= 32) {
          const human = this.wirePlayers.find((wp) => {
            const pl = this.getPlayer(wp.id);
            return pl && !pl.type.startsWith('bot_');
          });
          if (human && human.stunTimer <= 0) {
            human.pointerQueue.push(w.idx);
          }
          break;
        }
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

  public reset(_width: number = 800, _height: number = 600): void {
    this.roundTimer = 32.0;
    this.isFinished = false;
    this.suddenDeathAnnounced = false;
    this.wirePlayers = [];
    this.botReactionTimers.clear();
    this.moduleRound = 0;
    this.animTimer = 0;

    const active = this.getActivePlayers();
    active.forEach((p) => {
      this.wirePlayers.push({
        id: p.id,
        score: 0,
        stunTimer: 0,
        feedbackText: '',
        feedbackColor: '#FFFFFF',
        feedbackTimer: 0,
        scissorsAngle: 0,
        inputDebounceTimer: 0,
        sequenceStep: 0,
        cutWiresThisModule: new Set(),
        lastDirection: null,
        activeKeysDown: new Set(),
        pointerQueue: [],
        isUnderdog: false,
        streak: 0
      });
    });

    // Expose debug hook for testing
    (window as any).__WIRE_CUTTER_DEBUG__ = {
      getCurrentModule: () => ({
        type: this.currentModule.type,
        prompt: this.currentModule.instructionText,
        subPrompt: this.currentModule.subPrompt,
        sequence: this.currentModule.sequence,
        exceptWireIndex: this.currentModule.exceptWireIndex,
        correctWireIndex: this.currentModule.correctWireIndex,
        totalSteps: this.currentModule.totalSteps
      }),
      cutWire: (pid: PlayerId, wireIndex: number) => {
        const wp = this.wirePlayers.find((p) => p.id === pid);
        if (wp) this.executeWireCut(wp, wireIndex, 800, 600);
      },
      getPlayerState: (pid: PlayerId) => {
        const wp = this.wirePlayers.find((p) => p.id === pid);
        return wp ? {
          score: wp.score,
          stunTimer: wp.stunTimer,
          sequenceStep: wp.sequenceStep,
          cutWiresThisModule: Array.from(wp.cutWiresThisModule),
          isUnderdog: wp.isUnderdog
        } : null;
      },
      setModule: (moduleConfig: Partial<WireModule>) => {
        Object.assign(this.currentModule, moduleConfig);
        this.wirePlayers.forEach((wp) => {
          wp.sequenceStep = 0;
          wp.cutWiresThisModule.clear();
          const p = this.getPlayer(wp.id);
          if (p && p.type.startsWith('bot_')) {
            let delay = 0.35;
            if (p.type === 'bot_easy') delay = 0.55 + Math.random() * 0.25;
            else if (p.type === 'bot_normal') delay = 0.28 + Math.random() * 0.16;
            else if (p.type === 'bot_hard') delay = 0.14 + Math.random() * 0.08;
            this.botReactionTimers.set(wp.id, delay);
          }
        });
      },
      getTheme: () => WIRE_CUTTER_THEMES[this.currentThemeIndex].name,
      setTheme: (idx: number) => {
        this.currentThemeIndex = Math.max(0, Math.min(idx, WIRE_CUTTER_THEMES.length - 1));
      }
    };

    this.generateNewModule();
  }

  private generateNewModule() {
    this.moduleRound++;
    const wireColors = [
      { color: '#EF4444', label: 'RED', keyHint: 'UP [W / ↑]' },
      { color: '#3B82F6', label: 'BLUE', keyHint: 'RIGHT [D / →]' },
      { color: '#10B981', label: 'GREEN', keyHint: 'DOWN [S / ↓]' },
      { color: '#F59E0B', label: 'YELLOW', keyHint: 'LEFT [A / ←]' }
    ];
    const dirs = ['UP', 'RIGHT', 'DOWN', 'LEFT'];

    const roll = Math.random();
    const isSuddenDeath = this.roundTimer <= 15;

    let moduleType: 'single' | 'sequence' | 'all_except_then' = 'single';
    let prompt = '';
    let subPrompt = '';
    let sequence: number[] | undefined = undefined;
    let exceptIdx: number | undefined = undefined;
    let targetIdx = 0;
    let avoidIdx: number | undefined = undefined;
    let timer = isSuddenDeath ? 2.6 : 3.6;
    let totalSteps = 1;

    if (roll < 0.35) {
      moduleType = 'sequence';
      const step1 = Math.floor(Math.random() * 4);
      let step2 = Math.floor(Math.random() * 4);
      while (step2 === step1) {
        step2 = Math.floor(Math.random() * 4);
      }
      sequence = [step1, step2];
      totalSteps = 2;
      timer = isSudmonDeath(isSuddenDeath) ? 3.4 : 4.8;

      const isDirection = Math.random() < 0.5;
      if (isDirection) {
        prompt = `⚡ CUT: ${dirs[step1]} ➔ ${dirs[step2]}!`;
        subPrompt = `Execute sequence: ${dirs[step1]} then ${dirs[step2]}`;
      } else {
        prompt = `✂️ CUT: ${wireColors[step1].label} ➔ ${wireColors[step2].label}!`;
        subPrompt = `Execute sequence: ${wireColors[step1].label} then ${wireColors[step2].label}`;
      }
      targetIdx = step1;
    } else if (roll < 0.60) {
      moduleType = 'all_except_then';
      exceptIdx = Math.floor(Math.random() * 4);
      targetIdx = exceptIdx;
      totalSteps = 4;
      timer = isSuddenDeath ? 4.2 : 5.8;

      prompt = `⚠️ CUT ALL BUT ${wireColors[exceptIdx].label}, THEN ${wireColors[exceptIdx].label}!`;
      subPrompt = `Cut the other 3 wires first, then snip ${wireColors[exceptIdx].label}!`;
    } else {
      moduleType = 'single';
      const types = ['direct', 'direct_color', 'avoid', 'direction'];
      const st = types[Math.floor(Math.random() * types.length)];
      targetIdx = Math.floor(Math.random() * 4);
      totalSteps = 1;
      timer = isSuddenDeath ? 2.4 : 3.4;

      if (st === 'direct') {
        prompt = `⚡ SNIP THE ${wireColors[targetIdx].label} WIRE!`;
      } else if (st === 'direct_color') {
        prompt = `✂️ CUT COLOR: ${wireColors[targetIdx].label}`;
      } else if (st === 'avoid') {
        avoidIdx = Math.floor(Math.random() * 4);
        targetIdx = (avoidIdx + 1) % 4;
        prompt = `⚠️ DO NOT CUT ${wireColors[avoidIdx].label}!`;
        subPrompt = `Cut any wire except ${wireColors[avoidIdx].label}`;
      } else {
        targetIdx = Math.floor(Math.random() * 4);
        prompt = `🎯 CUT DIRECTION: ${dirs[targetIdx]}`;
      }
    }

    this.currentModule = {
      instructionText: prompt,
      subPrompt,
      type: moduleType,
      sequence,
      exceptWireIndex: exceptIdx,
      correctWireIndex: targetIdx,
      avoidWireIndex: avoidIdx,
      wires: wireColors,
      timer,
      maxTimer: timer,
      totalSteps
    };

    this.wirePlayers.forEach((wp) => {
      wp.sequenceStep = 0;
      wp.cutWiresThisModule.clear();
      wp.lastDirection = null;
      wp.activeKeysDown.clear();
      wp.pointerQueue = [];

      const p = this.getPlayer(wp.id);
      if (p && p.type.startsWith('bot_')) {
        let delay = 0.35;
        if (p.type === 'bot_easy') delay = 0.55 + Math.random() * 0.25;
        else if (p.type === 'bot_normal') delay = 0.28 + Math.random() * 0.16;
        else if (p.type === 'bot_hard') delay = 0.14 + Math.random() * 0.08;
        this.botReactionTimers.set(wp.id, delay);
      }
    });

    this.audio.playTap();
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.animTimer += dt;
    const isSuddenDeath = this.roundTimer <= 15;

    if (isSuddenDeath && !this.suddenDeathAnnounced) {
      this.suddenDeathAnnounced = true;
      this.audio.playExplosion();
      this.particles.addTrauma(0.4);
      this.particles.showFloatingText('⚡ OVERCLOCK SUDDEN DEATH: 2X POINTS! ⚡', width / 2, height / 2 - 120, '#FACC15', 28);
    }

    this.selectedWireIndex = Math.floor(performance.now() * 0.0022) % 4;

    this.currentModule.timer -= dt;
    if (this.currentModule.timer <= 0) {
      this.audio.playExplosion();
      this.particles.spawnExplosion(width / 2, height / 2, '#EF4444', 24);
      this.generateNewModule();
      return;
    }

    // Determine Leader and Underdog
    let maxScore = -Infinity;
    let minScore = Infinity;
    for (const wp of this.wirePlayers) {
      if (wp.score > maxScore) maxScore = wp.score;
      if (wp.score < minScore) minScore = wp.score;
    }

    for (const wp of this.wirePlayers) {
      wp.isUnderdog = (maxScore - wp.score >= 2 && maxScore >= 2);
    }

    this.updateBots(dt, width, height);

    this.wirePlayers.forEach((wp) => {
      if (wp.stunTimer > 0) wp.stunTimer -= dt;
      if (wp.feedbackTimer > 0) wp.feedbackTimer -= dt;
      if (wp.inputDebounceTimer > 0) wp.inputDebounceTimer -= dt;

      // Handle Human Player Inputs
      const p = this.getPlayer(wp.id);
      if (p && p.type === 'human' && wp.stunTimer <= 0 && wp.inputDebounceTimer <= 0) {
        let chosen: number | null = null;

        if (wp.pointerQueue.length > 0) {
          chosen = wp.pointerQueue.shift()!;
        }

        if (chosen === null) {
          const keyMappings: { pad: number; codes: string[] }[] = [
            { pad: 0, codes: wp.id === 0 ? ['KeyW'] : wp.id === 1 ? ['ArrowUp'] : wp.id === 2 ? ['KeyI'] : ['Numpad8', 'KeyT'] },
            { pad: 1, codes: wp.id === 0 ? ['KeyD'] : wp.id === 1 ? ['ArrowRight'] : wp.id === 2 ? ['KeyL'] : ['Numpad6', 'KeyH'] },
            { pad: 2, codes: wp.id === 0 ? ['KeyS'] : wp.id === 1 ? ['ArrowDown'] : wp.id === 2 ? ['KeyK'] : ['Numpad2', 'Numpad5', 'KeyG'] },
            { pad: 3, codes: wp.id === 0 ? ['KeyA'] : wp.id === 1 ? ['ArrowLeft'] : wp.id === 2 ? ['KeyJ'] : ['Numpad4', 'KeyF'] }
          ];

          for (const mapping of keyMappings) {
            const isAnyCodeDown = mapping.codes.some((code) => this.input.isRawKeyPressed(code));
            if (isAnyCodeDown) {
              const wasAlreadyDown = mapping.codes.some((code) => wp.activeKeysDown.has(code));
              if (!wasAlreadyDown) {
                mapping.codes.forEach((code) => {
                  if (this.input.isRawKeyPressed(code)) wp.activeKeysDown.add(code);
                });
                if (chosen === null) chosen = mapping.pad;
              }
            } else {
              mapping.codes.forEach((code) => wp.activeKeysDown.delete(code));
            }
          }
        }

        const steer = this.input.getSteer(wp.id);
        const throttle = this.input.getThrottle(wp.id);
        const isNeutral = Math.abs(steer) < 0.25 && Math.abs(throttle) < 0.25;

        if (isNeutral) {
          wp.lastDirection = null;
        } else if (wp.lastDirection === null && chosen === null) {
          if (Math.abs(throttle) >= Math.abs(steer)) {
            if (throttle > 0.35) chosen = 0;
            else if (throttle < -0.35) chosen = 2;
          } else {
            if (steer > 0.35) chosen = 1;
            else if (steer < -0.35) chosen = 3;
          }
          if (chosen !== null) {
            wp.lastDirection = chosen;
          }
        }

        const action = this.input.justAction(wp.id) || this.input.justPressed(wp.id);
        if (chosen === null && action) {
          chosen = this.selectedWireIndex;
        }

        if (chosen !== null) {
          wp.inputDebounceTimer = 0.20;
          this.executeWireCut(wp, chosen, width, height);
        }
      }
    });

    const leader = this.wirePlayers.find((wp) => wp.score >= 5);
    if (leader || this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private scheduleBotNextStep(botId: PlayerId) {
    const p = this.getPlayer(botId);
    if (!p || !p.type.startsWith('bot_')) return;
    const diff = p.type;
    let followUp = 0.25;
    if (diff === 'bot_easy') followUp = 0.42 + Math.random() * 0.18;
    else if (diff === 'bot_normal') followUp = 0.20 + Math.random() * 0.12;
    else followUp = 0.10 + Math.random() * 0.08;
    this.botReactionTimers.set(botId, followUp);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const wp = this.wirePlayers.find((p) => p.id === botId);
    if (!wp || wp.stunTimer > 0) return;

    let timer = this.botReactionTimers.get(botId) || 0.4;
    timer -= dt;
    this.botReactionTimers.set(botId, timer);

    if (timer <= 0) {
      const errorRate = difficulty === 'bot_easy' ? 0.18 : difficulty === 'bot_normal' ? 0.05 : 0.01;
      const m = this.currentModule;

      let targetWire = 0;
      if (m.type === 'sequence' && m.sequence) {
        targetWire = m.sequence[wp.sequenceStep] ?? 0;
      } else if (m.type === 'all_except_then') {
        if (wp.cutWiresThisModule.size < 3) {
          const remainingSafe = [0, 1, 2, 3].filter(
            (i) => i !== m.exceptWireIndex && !wp.cutWiresThisModule.has(i)
          );
          targetWire = remainingSafe[Math.floor(Math.random() * remainingSafe.length)] ?? 0;
        } else {
          targetWire = m.exceptWireIndex!;
        }
      } else if (m.avoidWireIndex !== undefined) {
        const safeWires = [0, 1, 2, 3].filter((i) => i !== m.avoidWireIndex);
        targetWire = safeWires[Math.floor(Math.random() * safeWires.length)];
      } else {
        targetWire = m.correctWireIndex;
      }

      if (Math.random() < errorRate) {
        targetWire = (targetWire + 1 + Math.floor(Math.random() * 3)) % 4;
      }

      this.executeWireCut(wp, targetWire, width, height);

      if (!this.isFinished && wp.stunTimer <= 0) {
        let followUpDelay = 0.22;
        if (difficulty === 'bot_easy') followUpDelay = 0.42 + Math.random() * 0.20;
        else if (difficulty === 'bot_normal') followUpDelay = 0.20 + Math.random() * 0.12;
        else followUpDelay = 0.10 + Math.random() * 0.08;
        this.botReactionTimers.set(botId, followUpDelay);
      } else {
        this.botReactionTimers.set(botId, 99);
      }
    }
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  private executeWireCut(wp: WirePlayer, wireIndex: number, width: number, height: number) {
    if (wp.stunTimer > 0) return;

    const m = this.currentModule;
    const wire = m.wires[wireIndex];

    const cx = width / 2;
    const bombH = Math.min(350, height * 0.65);
    const bombY = height / 2 - bombH / 2 - 10;
    const screenH = 65;
    const cy = bombY + 16 + screenH + (bombH - screenH - 32) / 2;
    const wireLength = 95;
    const wirePositions = [
      { x: cx, y: cy - wireLength },
      { x: cx + wireLength, y: cy },
      { x: cx, y: cy + wireLength },
      { x: cx - wireLength, y: cy }
    ];
    const cutPos = wirePositions[wireIndex] || { x: cx, y: cy };

    if (m.type === 'sequence' && m.sequence) {
      const expectedWire = m.sequence[wp.sequenceStep];
      if (wireIndex === expectedWire) {
        wp.sequenceStep++;
        this.audio.playTap();
        this.particles.spawnSparks(cutPos.x, cutPos.y, wire.color, 14);

        if (wp.sequenceStep >= m.totalSteps) {
          this.awardDefusal(wp, width, height);
        } else {
          wp.feedbackText = `STEP ${wp.sequenceStep}/${m.totalSteps} ✓`;
          wp.feedbackColor = '#38BDF8';
          wp.feedbackTimer = 0.8;
          this.particles.showFloatingText(`✓ STEP ${wp.sequenceStep}`, cutPos.x, cutPos.y - 18, '#38BDF8', 16);
          this.scheduleBotNextStep(wp.id);
        }
      } else {
        this.penalizeMistake(wp, cutPos.x, cutPos.y);
      }
    } else if (m.type === 'all_except_then') {
      const forbiddenWire = m.exceptWireIndex!;
      if (wp.cutWiresThisModule.size < 3) {
        if (wireIndex === forbiddenWire) {
          wp.feedbackText = 'TOO EARLY! 💥';
          this.penalizeMistake(wp, cutPos.x, cutPos.y);
        } else if (wp.cutWiresThisModule.has(wireIndex)) {
          wp.feedbackText = 'ALREADY CUT!';
          wp.feedbackColor = '#94A3B8';
          wp.feedbackTimer = 0.5;
        } else {
          wp.cutWiresThisModule.add(wireIndex);
          this.audio.playTap();
          this.particles.spawnSparks(cutPos.x, cutPos.y, wire.color, 14);

          if (wp.cutWiresThisModule.size === 3) {
            wp.feedbackText = `NOW CUT ${m.wires[forbiddenWire].label}! ✂️`;
            wp.feedbackColor = '#FACC15';
            wp.feedbackTimer = 1.2;
            this.particles.showFloatingText(`NOW CUT ${m.wires[forbiddenWire].label}! ✂️`, cx, cy - 25, '#FACC15', 18);
          } else {
            wp.feedbackText = `${wp.cutWiresThisModule.size}/3 CLEARED`;
            wp.feedbackColor = '#38BDF8';
            wp.feedbackTimer = 0.8;
          }
          this.scheduleBotNextStep(wp.id);
        }
      } else {
        if (wireIndex === forbiddenWire) {
          this.awardDefusal(wp, width, height);
        } else {
          this.penalizeMistake(wp, cutPos.x, cutPos.y);
        }
      }
    } else {
      let isCorrect = false;
      if (m.avoidWireIndex !== undefined) {
        isCorrect = wireIndex !== m.avoidWireIndex;
      } else {
        isCorrect = wireIndex === m.correctWireIndex;
      }

      if (isCorrect) {
        this.awardDefusal(wp, width, height);
      } else {
        this.penalizeMistake(wp, cutPos.x, cutPos.y);
      }
    }
  }

  private awardDefusal(wp: WirePlayer, width: number, height: number) {
    const isSuddenDeath = this.roundTimer <= 15;
    const pointsEarned = isSuddenDeath ? 2 : 1;
    wp.score += pointsEarned;
    wp.streak++;

    wp.feedbackText = pointsEarned > 1 ? 'DEFUSED! +2 ⚡' : 'DEFUSED! +1';
    wp.feedbackColor = '#22C55E';
    wp.feedbackTimer = 1.0;
    this.audio.playScore();
    this.particles.spawnSparks(width / 2, height / 2, '#22C55E', 26);
    this.particles.showFloatingText(
      pointsEarned > 1 ? 'OVERCLOCK DEFUSED! +2 ⚡' : '+1 DEFUSED!',
      width / 2,
      height / 2 - 60,
      '#22C55E',
      22
    );
    this.generateNewModule();
  }

  private penalizeMistake(wp: WirePlayer, x: number, y: number) {
    wp.streak = 0;
    wp.stunTimer = wp.isUnderdog ? 0.75 : 1.5;
    if (this.currentModule.type === 'sequence') {
      wp.sequenceStep = 0;
    } else if (this.currentModule.type === 'all_except_then') {
      wp.cutWiresThisModule.clear();
    }
    wp.feedbackText = 'WRONG WIRE! 💥';
    wp.feedbackColor = '#EF4444';
    wp.feedbackTimer = 1.4;
    this.audio.playExplosion();
    this.particles.spawnExplosion(x, y, '#EF4444', 28);
    this.particles.addTrauma(0.35);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    const theme = WIRE_CUTTER_THEMES[this.currentThemeIndex];
    const isSuddenDeath = this.roundTimer <= 15;

    // 1. Theme Chamber Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, theme.bgGradStart);
    bgGrad.addColorStop(1, theme.bgGradEnd);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Center Bomb Unit
    const bombW = Math.min(520, width * 0.85);
    const bombH = Math.min(350, height * 0.65);
    const bombX = width / 2 - bombW / 2;
    const bombY = height / 2 - bombH / 2 - 10;

    // Metal Frame
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = theme.bombChassis;
    ctx.strokeStyle = isSuddenDeath ? '#EF4444' : theme.bombBorder;
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bombX, bombY, bombW, bombH, 16);
    else ctx.rect(bombX, bombY, bombW, bombH);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Digital Screen Header inside Bomb
    const hasSub = Boolean(this.currentModule.subPrompt);
    const screenH = hasSub ? 72 : 65;
    ctx.fillStyle = theme.screenBg;
    ctx.fillRect(bombX + 16, bombY + 16, bombW - 32, screenH);
    ctx.strokeStyle = theme.screenBorder;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bombX + 16, bombY + 16, bombW - 32, screenH);

    // Holographic Instruction
    ctx.fillStyle = isSuddenDeath ? '#F87171' : theme.screenText;
    ctx.font = '900 18px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    const textY = hasSub ? bombY + 38 : bombY + 44;
    ctx.fillText(this.currentModule.instructionText, width / 2, textY);

    if (hasSub) {
      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.fillText(this.currentModule.subPrompt!, width / 2, bombY + 58);
    }

    // Module Timer Bar
    const maxT = this.currentModule.maxTimer || 3.5;
    const timerPct = Math.max(0, this.currentModule.timer / maxT);
    const barW = (bombW - 32) * timerPct;
    ctx.fillStyle = timerPct > 0.3 ? '#22C55E' : '#EF4444';
    ctx.fillRect(bombX + 16, bombY + 16 + screenH - 6, barW, 6);

    // 2. Render 4 Directional Wires
    const cx = width / 2;
    const cy = bombY + 16 + screenH + (bombH - screenH - 32) / 2;
    const wireLength = 95;

    const wireDirs = [
      { idx: 0, x: cx, y: cy - wireLength, label: 'UP [W / ↑]' },
      { idx: 1, x: cx + wireLength, y: cy, label: 'RIGHT [D / →]' },
      { idx: 2, x: cx, y: cy + wireLength, label: 'DOWN [S / ↓]' },
      { idx: 3, x: cx - wireLength, y: cy, label: 'LEFT [A / ←]' }
    ];

    // Central Core
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.screenBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = theme.screenText;
    ctx.font = '900 11px Montserrat, sans-serif';
    ctx.fillText('CORE', cx, cy + 4);

    // Underdog target assistance wire hint
    let underdogTargetWire: number | null = null;
    const activeUnderdog = this.wirePlayers.find((wp) => wp.isUnderdog && wp.stunTimer <= 0);
    if (activeUnderdog) {
      if (this.currentModule.type === 'sequence' && this.currentModule.sequence) {
        underdogTargetWire = this.currentModule.sequence[activeUnderdog.sequenceStep];
      } else {
        underdogTargetWire = this.currentModule.correctWireIndex;
      }
    }

    wireDirs.forEach((w) => {
      const wireData = this.currentModule.wires[w.idx];

      // Cable line
      ctx.save();
      ctx.strokeStyle = wireData.color;
      ctx.shadowColor = wireData.color;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(w.x, w.y);
      ctx.stroke();
      ctx.restore();

      // Underdog pulse hint
      if (underdogTargetWire === w.idx) {
        ctx.save();
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(w.x, w.y, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Terminal Node
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.arc(w.x, w.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = wireData.color;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      if (w.idx === this.selectedWireIndex) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(w.x, w.y, 20, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 10px Montserrat, sans-serif';
      ctx.fillText(wireData.label, w.x, w.y + 3.5);

      ctx.fillStyle = '#94A3B8';
      ctx.font = 'bold 9px monospace';
      const textOffY = w.idx === 0 ? -22 : w.idx === 2 ? 26 : 22;
      ctx.fillText(w.label, w.x, w.y + textOffY);
    });

    // 3. Render Player Defusal Consoles with Mascot Avatars
    const active = this.getActivePlayers();
    const cardW = Math.min(150, (width * 0.85) / active.length);
    const totalW = active.length * cardW + (active.length - 1) * 10;
    const startX = width / 2 - totalW / 2;
    const podY = height - 90; // Cleanly above bottom bar (height - 44)

    this.wirePlayers.forEach((wp, idx) => {
      const p = this.getPlayer(wp.id);
      if (!p) return;
      const isBot = p.type.startsWith('bot_');
      const px = startX + idx * (cardW + 10);

      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, podY, cardW, 40, 8);
      else ctx.rect(px, podY, cardW, 40);
      ctx.fill();
      ctx.strokeStyle = wp.stunTimer > 0 ? '#EF4444' : (wp.isUnderdog ? '#F59E0B' : p.color);
      ctx.lineWidth = wp.isUnderdog ? 2 : 1.5;
      ctx.stroke();

      // Mascot Face
      let mood: CharacterMood = 'focused';
      if (wp.stunTimer > 0) {
        mood = 'shocked';
      } else if (wp.feedbackText.includes('DEFUSED')) {
        mood = 'happy';
      } else if (this.isFinished) {
        mood = 'triumph';
      }

      drawCharacter(ctx, px + 20, podY + 20, 13, wp.id, isBot, mood, this.animTimer);

      // Name & Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 11px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, px + 38, podY + 16);

      ctx.fillStyle = p.color;
      ctx.font = '900 12px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`✂️ ${wp.score}/5`, px + cardW - 8, podY + 16);

      // Status text
      if (wp.stunTimer > 0) {
        ctx.fillStyle = '#EF4444';
        ctx.font = 'bold 9.5px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`⚡ STUN (${wp.stunTimer.toFixed(1)}s)`, px + 38, podY + 31);
      } else if (wp.feedbackTimer > 0) {
        ctx.fillStyle = wp.feedbackColor;
        ctx.font = 'bold 9.5px Montserrat, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(wp.feedbackText, px + 38, podY + 31);
      } else {
        ctx.fillStyle = '#94A3B8';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('STANDBY', px + 38, podY + 31);
      }
      ctx.restore();
    });

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
        ? '⚡ OVERCLOCK SUDDEN DEATH! RAPID CUTS & 2X DEFUSAL PTS! ⚡'
        : 'READ SCREEN PROMPT • CUT CORRECT WIRE • FIRST TO 5 WINS!',
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
    ctx.fillText('WASD / Arrows / Direct Wire Click', width - 24, height - 28);
    ctx.restore();

    ctx.restore();
  }

  public getRoundResult(): RoundResult {
    const sorted = [...this.wirePlayers].sort((a, b) => b.score - a.score);
    const winnerId = sorted[0].score > sorted[1].score ? sorted[0].id : null;
    const winnerName = winnerId !== null ? (this.getPlayer(winnerId)?.name || 'Player') : '';

    return {
      winnerId,
      rankings: sorted.map((wp, idx) => ({ playerId: wp.id, place: (idx + 1) as 1 | 2 | 3 | 4, score: wp.score })),
      mvpHighlight: winnerId !== null
        ? `${winnerName} DEFUSED ${sorted[0].score} CYBER BOMBS!`
        : 'BOMB DEFUSAL DUEL TIED!'
    };
  }
}

function isSudmonDeath(isSuddenDeath: boolean): boolean {
  return isSuddenDeath;
}

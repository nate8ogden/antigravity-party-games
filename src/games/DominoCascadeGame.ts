import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';
import { drawCharacter, CharacterMood } from '../core/CharacterRenderer';

export type DominoTheme = 'synth' | 'mahogany' | 'clockwork';

interface ThemeConfig {
  id: DominoTheme;
  name: string;
  badge: string;
  bgGradient: [string, string];
  boardBorder: string;
  trackPathColor: string;
  dominoDefault: string;
  dominoGolden: string;
  accentGlow: string;
}

const THEME_CONFIGS: ThemeConfig[] = [
  {
    id: 'synth',
    name: 'Neon Circuit',
    badge: '⚡ NEON CIRCUIT',
    bgGradient: ['#0B0F19', '#030712'],
    boardBorder: '#06B6D4',
    trackPathColor: 'rgba(6, 182, 212, 0.20)',
    dominoDefault: '#38BDF8',
    dominoGolden: '#F59E0B',
    accentGlow: '#06B6D4'
  },
  {
    id: 'mahogany',
    name: 'Grand Mahogany',
    badge: '🏛️ GRAND MAHOGANY',
    bgGradient: ['#451A03', '#1C0A00'],
    boardBorder: '#D97706',
    trackPathColor: 'rgba(217, 119, 6, 0.22)',
    dominoDefault: '#FEF3C7',
    dominoGolden: '#F59E0B',
    accentGlow: '#F59E0B'
  },
  {
    id: 'clockwork',
    name: 'Clockwork Gears',
    badge: '⚙️ CLOCKWORK GEARS',
    bgGradient: ['#1C1917', '#0C0A09'],
    boardBorder: '#EA580C',
    trackPathColor: 'rgba(234, 88, 12, 0.20)',
    dominoDefault: '#D6D3D1',
    dominoGolden: '#F59E0B',
    accentGlow: '#F97316'
  }
];

interface DominoTile {
  x: number;
  y: number;
  angle: number;
  isToppled: boolean;
  toppleProgress: number; // 0..1
  isGolden: boolean;
  isIntersection: boolean;
}

interface PlayerDominoTrack {
  id: PlayerId;
  waypoints: { x: number; y: number }[];
  dominos: DominoTile[];
  currentIndex: number;
  isToppling: boolean;
  toppleIndex: number;
  toppleTimer: number;
  score: number;
  bellsRung: number;
  hasFinishedPlacing: boolean;
  botReactionTimer: number;
  mood: CharacterMood;
  moodTimer: number;
  isUnderdog: boolean;
  streak: number;
}

export class DominoCascadeGame extends BaseGame {
  private playerTracks: Map<PlayerId, PlayerDominoTrack> = new Map();
  private beatTimer: number = 0;
  private beatInterval: number = 0.42;
  private barrierProgress: number = 0;
  public currentTheme: DominoTheme = 'synth';
  private currentMapName: string = 'Serpentine S-Curves';
  private phase: 'PLACING' | 'TOPPLING' | 'FINISHED' = 'PLACING';
  private suddenDeathAnnounced: boolean = false;
  private animTimer: number = 0;

  private lastWidth: number = 960;
  private lastHeight: number = 540;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private boundPointerDown: ((e: PointerEvent) => void) | null = null;

  constructor(
    players: PlayerConfig[],
    input: InputRouter,
    audio: AudioEngine,
    particles: ParticleSystem
  ) {
    super(players, input, audio, particles);
  }

  public init(width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;
    this.bindKeyboardShortcuts();
    this.bindCanvasPointer();
    this.reset(width, height);
  }

  public reset(width: number, height: number): void {
    this.roundTimer = 35.0;
    this.isFinished = false;
    this.phase = 'PLACING';
    this.barrierProgress = 0;
    this.beatTimer = 0;
    this.suddenDeathAnnounced = false;
    this.animTimer = 0;

    const tracks = ['Serpentine S-Curves', 'Double Spiral Circuit', 'Zig-Zag Cascade', 'Looping Roller'];
    this.currentMapName = tracks[Math.floor(Math.random() * tracks.length)];

    this.playerTracks.clear();
    const active = this.getActivePlayers();

    const quadrantW = width / 2;
    const quadrantH = (height - 90) / 2;

    active.forEach((p, idx) => {
      let qx = 20;
      let qy = 86;
      if (idx === 1) qx = quadrantW + 20;
      else if (idx === 2) qy = 86 + quadrantH;
      else if (idx === 3) {
        qx = quadrantW + 20;
        qy = 86 + quadrantH;
      }

      const waypoints = this.generateWaypoints(qx, qy, quadrantW - 40, quadrantH - 34);

      this.playerTracks.set(p.id, {
        id: p.id,
        waypoints,
        dominos: [],
        currentIndex: 0,
        isToppling: false,
        toppleIndex: 0,
        toppleTimer: 0,
        score: 0,
        bellsRung: 0,
        hasFinishedPlacing: false,
        botReactionTimer: 0.15 + idx * 0.05,
        mood: 'idle',
        moodTimer: 0,
        isUnderdog: false,
        streak: 0
      });
    });

    this.syncDebug();
  }

  public syncDebug(): void {
    if (typeof window !== 'undefined') {
      const self = this;
      (window as any).__DOMINO_CASCADE_DEBUG__ = {
        get tracks() { return Array.from(self.playerTracks.values()); },
        get phase() { return self.phase; },
        get roundTimer() { return self.roundTimer; },
        get isFinished() { return self.isFinished; },
        get theme() { return self.currentTheme; },
        setTheme: (t: DominoTheme) => self.setDominoTheme(t),
        cycleTheme: () => self.cycleTheme(),
        startCascade: () => self.startCascade()
      };
    }
  }

  private bindKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;
    this.keydownListener = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 't' || e.key === 'T') {
        this.cycleTheme();
      } else if (e.key === '1') {
        this.setDominoTheme('synth');
      } else if (e.key === '2') {
        this.setDominoTheme('mahogany');
      } else if (e.key === '3') {
        this.setDominoTheme('clockwork');
      }
    };
    window.addEventListener('keydown', this.keydownListener);
  }

  private bindCanvasPointer(): void {
    if (typeof window === 'undefined') return;
    const canvas = this.input.getCanvas();
    if (!canvas) return;

    this.boundPointerDown = (e: PointerEvent) => {
      this.handlePointerDown(e);
    };
    canvas.addEventListener('pointerdown', this.boundPointerDown);
  }

  private handlePointerDown(e: PointerEvent): void {
    const canvas = this.input.getCanvas();
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * this.lastWidth;
    const clickY = ((e.clientY - rect.top) / rect.height) * this.lastHeight;

    // Check Theme Pill click at (20, height - 44, 170, 32)
    if (
      clickX >= 20 &&
      clickX <= 190 &&
      clickY >= this.lastHeight - 44 &&
      clickY <= this.lastHeight - 12
    ) {
      this.cycleTheme();
    }
  }

  public cycleTheme(): void {
    const curIdx = THEME_CONFIGS.findIndex((t) => t.id === this.currentTheme);
    const nextIdx = (curIdx + 1) % THEME_CONFIGS.length;
    this.setDominoTheme(THEME_CONFIGS[nextIdx].id);
  }

  public setDominoTheme(theme: DominoTheme): void {
    if (this.currentTheme === theme) return;
    this.currentTheme = theme;
    this.audio.playTap();
    this.particles.spawnExplosion(100, this.lastHeight - 28, '#06B6D4', 12);
  }

  public destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keydownListener) {
        window.removeEventListener('keydown', this.keydownListener);
        this.keydownListener = null;
      }
      const canvas = this.input.getCanvas();
      if (canvas && this.boundPointerDown) {
        canvas.removeEventListener('pointerdown', this.boundPointerDown);
        this.boundPointerDown = null;
      }
      delete (window as any).__DOMINO_CASCADE_DEBUG__;
    }
  }

  private generateWaypoints(
    startX: number,
    startY: number,
    w: number,
    h: number
  ): { x: number; y: number }[] {
    const pts: { x: number; y: number }[] = [];
    const count = 36;

    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const wx = startX + 28 + (w - 56) * t;
      const wy = startY + h / 2 + Math.sin(t * Math.PI * 3) * (h * 0.36);
      pts.push({ x: wx, y: wy });
    }
    return pts;
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;

    this.lastWidth = width;
    this.lastHeight = height;
    this.animTimer += dt;

    this.beatTimer += dt;
    if (this.beatTimer >= this.beatInterval) {
      this.beatTimer -= this.beatInterval;
    }

    // Update Underdog status (trailing by domino count or score >= 100 pts)
    this.updateUnderdogStatus();

    // Sudden Death Rush at 15s remaining
    if (this.roundTimer <= 15 && !this.suddenDeathAnnounced && this.phase === 'PLACING') {
      this.suddenDeathAnnounced = true;
      this.audio.playFanfare();
      this.particles.shake(0.35);
      this.particles.showFloatingText('HYDRAULIC RUSH! ⚡ 2X POINTS', width / 2, 78, '#F59E0B', 24);
    }

    if (this.phase === 'PLACING') {
      this.roundTimer -= dt;
      this.barrierProgress = 1 - Math.max(0, this.roundTimer / 35.0);

      // Handle Bot AI
      this.updateBots(dt, width, height);

      // Human inputs
      for (const p of this.getActivePlayers()) {
        const pt = this.playerTracks.get(p.id);
        if (!pt || pt.hasFinishedPlacing) continue;

        if (pt.moodTimer > 0) {
          pt.moodTimer = Math.max(0, pt.moodTimer - dt);
          if (pt.moodTimer <= 0) pt.mood = 'idle';
        }

        if (p.type === 'human') {
          const justPressed = this.input.justPressed(p.id) || this.input.justAction(p.id);
          const actionHeld = this.input.isActionPressed(p.id) || this.input.isPressed(p.id);

          // Push-your-luck early topple trigger: hold action when you have >= 12 tiles!
          if (actionHeld && pt.dominos.length >= 12 && !pt.hasFinishedPlacing) {
            pt.hasFinishedPlacing = true;
            this.particles.showFloatingText('EARLY TOPPLE! 💥', pt.waypoints[0].x, pt.waypoints[0].y - 20, '#F59E0B', 18);
            if (this.roundTimer > 4.0) this.roundTimer = 4.0;
          } else if (justPressed) {
            this.layDomino(pt);
          }
        }
      }

      // Check if time up or all finished
      const allDone = Array.from(this.playerTracks.values()).every((t) => t.hasFinishedPlacing);
      if (this.roundTimer <= 0 || allDone) {
        this.roundTimer = 0;
        this.startCascade();
      }
    } else if (this.phase === 'TOPPLING') {
      let stillToppling = false;

      for (const pt of this.playerTracks.values()) {
        if (!pt.isToppling) continue;

        pt.toppleTimer += dt;
        let toppleStepTime = 0.052;
        if (pt.isUnderdog) toppleStepTime *= 0.82; // Underdog faster cascade

        while (pt.toppleTimer >= toppleStepTime && pt.toppleIndex < pt.dominos.length) {
          pt.toppleTimer -= toppleStepTime;
          const currentDom = pt.dominos[pt.toppleIndex];
          currentDom.isToppled = true;
          currentDom.toppleProgress = 1.0;

          let pts = currentDom.isGolden ? 35 : 12;
          if (this.suddenDeathAnnounced) pts *= 2;
          pt.score += pts;

          this.audio.playTap();

          if (currentDom.isGolden) {
            pt.bellsRung++;
            this.audio.playChime();
          }

          this.particles.emit(currentDom.x, currentDom.y, 4, currentDom.isGolden ? '#F59E0B' : '#FFFFFF');
          pt.toppleIndex++;
        }

        if (pt.toppleIndex < pt.dominos.length) {
          stillToppling = true;
        } else {
          pt.isToppling = false;
          pt.mood = 'triumph';
          pt.moodTimer = 1.5;
        }
      }

      if (!stillToppling) {
        this.phase = 'FINISHED';
        this.isFinished = true;
        this.audio.playFanfare();
      }
    }
  }

  private updateUnderdogStatus(): void {
    const tracks = Array.from(this.playerTracks.values());
    if (tracks.length < 2) return;

    let maxTiles = -1;
    let minTiles = 999;
    let maxScore = -1;

    for (const t of tracks) {
      if (t.dominos.length > maxTiles) maxTiles = t.dominos.length;
      if (t.dominos.length < minTiles) minTiles = t.dominos.length;
      if (t.score > maxScore) maxScore = t.score;
    }

    for (const t of tracks) {
      t.isUnderdog = (maxTiles - t.dominos.length >= 6) || (maxScore - t.score >= 100);
    }
  }

  private layDomino(pt: PlayerDominoTrack): void {
    if (pt.currentIndex >= pt.waypoints.length) {
      pt.hasFinishedPlacing = true;
      return;
    }

    const curPt = pt.waypoints[pt.currentIndex];
    const nextPt = pt.waypoints[Math.min(pt.waypoints.length - 1, pt.currentIndex + 1)];
    const angle = Math.atan2(nextPt.y - curPt.y, nextPt.x - curPt.x);

    // Rhythm accuracy bonus
    const beatPhase = Math.abs(this.beatTimer - this.beatInterval / 2) / (this.beatInterval / 2);
    const rhythmSweetSpot = pt.isUnderdog ? 0.40 : 0.25;
    const isGolden =
      beatPhase < rhythmSweetSpot ||
      (pt.currentIndex > 0 && pt.currentIndex % 6 === 0) ||
      (pt.isUnderdog && pt.currentIndex % 3 === 0);

    if (isGolden) {
      pt.streak++;
      pt.mood = 'triumph';
      pt.moodTimer = 0.4;
      this.particles.emit(curPt.x, curPt.y, 4, '#F59E0B');
    } else {
      pt.streak = 0;
      pt.mood = 'focused';
      pt.moodTimer = 0.2;
    }

    pt.dominos.push({
      x: curPt.x,
      y: curPt.y,
      angle,
      isToppled: false,
      toppleProgress: 0,
      isGolden,
      isIntersection: pt.currentIndex === 18 // mid-track crossing
    });

    this.audio.playTap();
    pt.currentIndex++;

    if (pt.currentIndex >= pt.waypoints.length) {
      pt.hasFinishedPlacing = true;
      this.audio.playChime();
      if (this.roundTimer > 5.0) {
        this.roundTimer = 5.0; // Hurry-up countdown for rivals
      }
    }
  }

  private startCascade(): void {
    this.phase = 'TOPPLING';
    this.audio.playFanfare();
    for (const pt of this.playerTracks.values()) {
      pt.isToppling = true;
      pt.toppleIndex = 0;
      pt.toppleTimer = 0;
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    const pt = this.playerTracks.get(botId);
    if (!pt || pt.hasFinishedPlacing) return;

    pt.botReactionTimer -= dt;
    if (pt.botReactionTimer > 0) return;

    const beatPhase = Math.abs(this.beatTimer - this.beatInterval / 2) / (this.beatInterval / 2);

    if (difficulty === 'bot_hard') {
      // Sync with musical beat for maximum golden domino resonance
      if (beatPhase > 0.30 && pt.currentIndex < pt.waypoints.length - 2) {
        pt.botReactionTimer = 0.06;
        return;
      }
    }

    const baseDelay =
      difficulty === 'bot_hard'
        ? 0.18 + Math.random() * 0.04
        : difficulty === 'bot_normal'
        ? 0.28 + Math.random() * 0.08
        : 0.38 + Math.random() * 0.14;
    pt.botReactionTimer = baseDelay;

    this.layDomino(pt);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    this.lastWidth = width;
    this.lastHeight = height;

    const cfg = THEME_CONFIGS.find((t) => t.id === this.currentTheme) || THEME_CONFIGS[0];

    // 1. Stage Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, cfg.bgGradient[0]);
    bgGrad.addColorStop(1, cfg.bgGradient[1]);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Descending Hydraulic Barrier
    if (this.phase === 'PLACING') {
      const barrierY = 76 + this.barrierProgress * (height - 146);
      ctx.save();
      ctx.strokeStyle = '#EF4444';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(10, barrierY);
      ctx.lineTo(width - 10, barrierY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#EF4444';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('BARRIER DROPPING ▼', width - 20, barrierY - 6);
      ctx.restore();
    }

    // 3. Render Tracks & Dominos for each player
    for (const p of this.getActivePlayers()) {
      const pt = this.playerTracks.get(p.id);
      if (!pt) continue;

      // Draw guide path
      ctx.strokeStyle = cfg.trackPathColor;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      pt.waypoints.forEach((wp, idx) => {
        if (idx === 0) ctx.moveTo(wp.x, wp.y);
        else ctx.lineTo(wp.x, wp.y);
      });
      ctx.stroke();

      // Dominos (2.5D Tactile Tile Rendering)
      for (const dom of pt.dominos) {
        ctx.save();
        ctx.translate(dom.x, dom.y);
        ctx.rotate(dom.angle);

        const domW = 8;
        const domH = 22;

        if (dom.isToppled) {
          // Flattened with 3D drop shadow
          ctx.fillStyle = dom.isGolden ? cfg.dominoGolden : p.colorDark;
          ctx.fillRect(-domW / 2, -domH * 0.2, domW * 1.6, 5);
        } else {
          // 2.5D Standing Domino
          // Shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.fillRect(-domW / 2 + 3, -domH / 2 + 3, domW, domH);

          // Tile Face
          ctx.fillStyle = dom.isGolden ? cfg.dominoGolden : cfg.dominoDefault;
          ctx.fillRect(-domW / 2, -domH / 2, domW, domH);

          ctx.strokeStyle = dom.isGolden ? '#FFFFFF' : p.color;
          ctx.lineWidth = 1.2;
          ctx.strokeRect(-domW / 2, -domH / 2, domW, domH);

          // Center Divider Pip
          ctx.fillStyle = dom.isGolden ? '#FFFFFF' : '#475569';
          ctx.fillRect(-domW / 2 + 1, -1, domW - 2, 2);
        }

        ctx.restore();
      }
    }

    // 4. Corner Player Cards & Mascot Avatars
    this.renderPlayerCornerCards(ctx, width, height, cfg);

    // 5. Center Sub-Header Badge (y: 56, h: 26 - respects top-center y:12-44 safe zone)
    this.renderSubHeaderBadge(ctx, width, cfg);

    // 6. Interactive Theme Pill (bottom-left x: 20, y: height - 44, w: 170, h: 32)
    this.renderThemePill(ctx, height, cfg);

    // 7. Control Hints (bottom-right x: width - 20, y: height - 28, textAlign: right)
    this.renderControlsHUD(ctx, width, height);
  }

  private renderPlayerCornerCards(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    cfg: ThemeConfig
  ): void {
    for (const p of this.getActivePlayers()) {
      const pt = this.playerTracks.get(p.id);
      if (!pt) continue;

      let px = 20;
      let py = 16;
      let mascotX = px + 175;
      let mascotY = py + 36;

      if (p.corner === 'top-right') {
        px = width - 180;
        mascotX = px - 20;
      } else if (p.corner === 'bottom-left') {
        // Place neatly above theme pill (theme pill is at y: height - 44)
        py = height - 134;
        mascotY = py + 36;
      } else if (p.corner === 'bottom-right') {
        px = width - 180;
        py = height - 134;
        mascotX = px - 20;
        mascotY = py + 36;
      }

      // Container Card
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
      ctx.beginPath();
      ctx.roundRect(px, py, 160, 78, 8);
      ctx.fill();

      // Card border (dashed gold if Underdog)
      if (pt.isUnderdog) {
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([5, 3]);
      } else {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
      }
      ctx.stroke();
      ctx.restore();

      // Name & Score
      ctx.fillStyle = p.color;
      ctx.font = '700 12px Inter, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(p.name, px + 10, py + 18);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '800 13px Inter, monospace';
      ctx.fillText(`${pt.score} pts`, px + 10, py + 35);

      ctx.fillStyle = pt.hasFinishedPlacing ? '#10B981' : '#94A3B8';
      ctx.font = '700 11px Inter, sans-serif';
      const status = pt.hasFinishedPlacing
        ? 'READY! ✓'
        : `Tiles: ${pt.dominos.length}/${pt.waypoints.length}`;
      ctx.fillText(status, px + 10, py + 54);

      // Bells rung
      ctx.fillStyle = '#F59E0B';
      ctx.font = '600 10px Inter, sans-serif';
      ctx.fillText(`🔔 Bells: ${pt.bellsRung}`, px + 10, py + 70);

      // Render Mascot Avatar alongside the card
      const isBot = p.type !== 'human';
      ctx.save();
      drawCharacter(ctx, mascotX, mascotY, 13, pt.id, isBot, pt.mood, this.animTimer);
      ctx.restore();
    }
  }

  private renderSubHeaderBadge(ctx: CanvasRenderingContext2D, width: number, cfg: ThemeConfig): void {
    const podW = 340;
    const podH = 26;
    const podX = width / 2 - podW / 2;
    const podY = 56; // Safe zone below top-center timer y: 12-44

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(podX, podY, podW, podH, 13);
    ctx.fill();

    ctx.strokeStyle = cfg.boardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Map Name Badge
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F59E0B';
    ctx.fillText(`TRACK: ${cfg.name}`, podX + 16, podY + 17);

    // Status
    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    if (this.phase === 'TOPPLING') {
      ctx.fillStyle = '#10B981';
      ctx.fillText('⚡ CASCADE TOPPLE ACTIVE!', podX + podW - 16, podY + 17);
    } else if (this.suddenDeathAnnounced) {
      ctx.fillStyle = '#EF4444';
      ctx.fillText('⚡ RUSH: 2X POINTS', podX + podW - 16, podY + 17);
    } else {
      ctx.fillStyle = '#38BDF8';
      ctx.fillText('LAY IN RHYTHM', podX + podW - 16, podY + 17);
    }
    ctx.restore();
  }

  private renderThemePill(ctx: CanvasRenderingContext2D, height: number, cfg: ThemeConfig): void {
    const pillX = 20;
    const pillY = height - 44;
    const pillW = 170;
    const pillH = 32;

    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, 16);
    ctx.fill();

    ctx.strokeStyle = cfg.boardBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '700 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#F8FAFC';
    ctx.fillText(cfg.badge, pillX + 12, pillY + 20);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#94A3B8';
    ctx.fillText('[T]', pillX + pillW - 10, pillY + 20);
    ctx.restore();
  }

  private renderControlsHUD(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.70)';
    ctx.fillText('Tap in Rhythm: Lay Tile | Hold: Early Topple | Sync with Beat for Gold!', width - 20, height - 28);
    ctx.restore();
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const active = this.getActivePlayers();
    const sorted = [...active].sort((a, b) => {
      const sa = this.playerTracks.get(a.id)?.score || 0;
      const sb = this.playerTracks.get(b.id)?.score || 0;
      return sb - sa;
    });

    const winnerId = sorted.length > 0 ? sorted[0].id : null;
    const topScore = this.playerTracks.get(winnerId ?? 0)?.score || 0;

    const rankings = sorted.map((p, idx) => ({
      playerId: p.id,
      score: this.playerTracks.get(p.id)?.score || 0,
      place: idx + 1
    }));

    return {
      winnerId,
      rankings,
      mvpHighlight: `Spectacular domino run! Triggered a chain reaction of ${topScore} pts on ${this.currentTheme}!`
    };
  }
}

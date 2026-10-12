import { BaseGame } from './BaseGame';
import { PlayerId, PlayerConfig, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface FloatingHit {
  text: string;
  color: string;
  x: number;
  y: number;
  alpha: number;
  scale: number;
}

interface PopcornKernel {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: 'golden' | 'burnt' | 'rainbow';
  state: 'heating' | 'popped';
  heatTimer: number;
  scale: number;
  rotation: number;
  vRot: number;
}

interface PopperStation {
  id: PlayerId;
  x: number;
  y: number;
  kernels: PopcornKernel[];
  spawnTimer: number;
  score: number;
  kernelsSnagged: number;
  combo: number;
  snagAnim: number;
  jamTimer: number;
  jamMaxTimer: number;
  sootTimer: number;
  shakeTimer: number;
  floatingHits: FloatingHit[];
}

export class PopcornPopperGame extends BaseGame {
  public playersState: Map<PlayerId, PopperStation> = new Map();
  public currentMapName: string = 'Vintage Cinema Popcorn Kettle';

  private kernelIdCounter: number = 0;
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
    this.playersState.clear();
    this.botReactionTimers.clear();

    const active = this.getActivePlayers();
    const count = active.length;
    const spacing = width / (count + 1);

    const counterY = height * 0.56;
    active.forEach((p, idx) => {
      const initialKernels: PopcornKernel[] = [
        {
          id: ++this.kernelIdCounter,
          x: -12,
          y: 20,
          vx: 0,
          vy: 0,
          type: 'golden',
          state: 'heating',
          heatTimer: 0.3,
          scale: 0.6,
          rotation: 0.4,
          vRot: 0
        },
        {
          id: ++this.kernelIdCounter,
          x: 14,
          y: 21,
          vx: 0,
          vy: 0,
          type: 'golden',
          state: 'heating',
          heatTimer: 0.9,
          scale: 0.6,
          rotation: 1.2,
          vRot: 0
        },
        {
          id: ++this.kernelIdCounter,
          x: 2,
          y: -22,
          vx: 8,
          vy: -60,
          type: 'golden',
          state: 'popped',
          heatTimer: 0,
          scale: 1.0,
          rotation: 0.8,
          vRot: 2.5
        }
      ];

      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: counterY - 26,
        kernels: initialKernels,
        spawnTimer: 0.5 + Math.random() * 0.3,
        score: 0,
        kernelsSnagged: 0,
        combo: 0,
        snagAnim: 0,
        jamTimer: 0,
        jamMaxTimer: 0.85,
        sootTimer: 0,
        shakeTimer: 0,
        floatingHits: []
      });
      this.botReactionTimers.set(p.id, 0.2 + Math.random() * 0.2);
    });
  }

  public update(dt: number, _width: number, _height: number): void {
    if (this.isFinished) return;

    this.roundTimer = Math.max(0, this.roundTimer - dt);

    this.updateBots(dt, _width, _height);

    for (const p of this.getActivePlayers()) {
      const st = this.playersState.get(p.id);
      if (!st) continue;

      // Update cooldowns & animations
      if (st.snagAnim > 0) st.snagAnim = Math.max(0, st.snagAnim - dt * 6);
      if (st.jamTimer > 0) st.jamTimer = Math.max(0, st.jamTimer - dt);
      if (st.sootTimer > 0) st.sootTimer = Math.max(0, st.sootTimer - dt);
      if (st.shakeTimer > 0) st.shakeTimer = Math.max(0, st.shakeTimer - dt);

      // Update floating score texts
      for (let i = st.floatingHits.length - 1; i >= 0; i--) {
        const hit = st.floatingHits[i];
        hit.y -= dt * 32;
        hit.alpha -= dt * 1.5;
        hit.scale = Math.min(1.2, hit.scale + dt * 0.8);
        if (hit.alpha <= 0) {
          st.floatingHits.splice(i, 1);
        }
      }

      // Kernel spawner
      st.spawnTimer -= dt;
      if (st.spawnTimer <= 0 && st.kernels.length < 5) {
        st.spawnTimer = 0.55 + Math.random() * 0.45;

        // Determine kernel type: 65% golden butter, 23% smoldering burnt, 12% rainbow caramel
        const rand = Math.random();
        let type: 'golden' | 'burnt' | 'rainbow' = 'golden';
        if (rand < 0.23) {
          type = 'burnt';
        } else if (rand < 0.35) {
          type = 'rainbow';
        }

        st.kernels.push({
          id: ++this.kernelIdCounter,
          x: (Math.random() - 0.5) * 48,
          y: 20,
          vx: 0,
          vy: 0,
          type,
          state: 'heating',
          heatTimer: 0.6 + Math.random() * 0.8,
          scale: 0.6,
          rotation: Math.random() * Math.PI * 2,
          vRot: 0
        });
      }

      // Update kernels
      for (let i = st.kernels.length - 1; i >= 0; i--) {
        const k = st.kernels[i];

        if (k.state === 'heating') {
          k.heatTimer -= dt;
          k.x += (Math.random() - 0.5) * 2.0; // hot plate vibrating jitter

          if (k.heatTimer <= 0) {
            // POP! Launch into air
            k.state = 'popped';
            k.scale = 1.0;
            k.vy = -310 - Math.random() * 65;
            k.vx = (Math.random() - 0.5) * 45;
            k.vRot = (Math.random() - 0.5) * 8;

            this.audio.playTap();

            if (k.type === 'rainbow') {
              this.particles.spawnSparks(st.x + k.x, st.y + k.y, '#FFD700', 6);
            } else if (k.type === 'burnt') {
              this.particles.emit(st.x + k.x, st.y + k.y, 4, '#263238');
            } else {
              this.particles.emit(st.x + k.x, st.y + k.y, 5, '#FFF9C4');
            }
          }
        } else if (k.state === 'popped') {
          k.x += k.vx * dt;
          k.y += k.vy * dt;
          k.vy += 470 * dt; // gravity
          k.rotation += k.vRot * dt;

          // Kernel falls back onto hot plate without being snagged
          if (k.y > 24) {
            if (k.type === 'golden') {
              // Scorches away
              this.particles.emit(st.x + k.x, st.y + k.y, 3, '#4E342E');
            }
            st.kernels.splice(i, 1);
          }
        }
      }

      // Check player input
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      if (justAction) {
        this.handleSnag(st);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  /**
   * Snag mechanism with anti-spam whiff penalty and timing precision
   */
  private handleSnag(st: PopperStation): void {
    // 1. If popper is currently jammed, button mash is completely locked out
    if (st.jamTimer > 0) {
      this.audio.playTone(180, 0.06, 'sawtooth');
      return;
    }

    // Trigger visual scoop snap
    st.snagAnim = 1.0;

    // 2. Find eligible popped kernels in the catch window (y between -46 and -14)
    // Preference: closest to apex (y = -30)
    let bestIdx = -1;
    let bestDist = 9999;

    for (let i = 0; i < st.kernels.length; i++) {
      const k = st.kernels[i];
      if (k.state === 'popped' && k.y >= -48 && k.y <= -14) {
        const dist = Math.abs(k.y - (-30));
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
    }

    // 3. Evaluate catch outcome
    if (bestIdx !== -1) {
      const target = st.kernels[bestIdx];

      if (target.type === 'burnt') {
        // Punish player for catching smoldering burnt kernel!
        st.score = Math.max(0, st.score - 20);
        st.combo = 0;
        st.sootTimer = 0.9;
        st.shakeTimer = 0.4;
        st.kernels.splice(bestIdx, 1);

        this.audio.playExplosion();
        this.particles.emit(st.x + target.x, st.y + target.y, 10, '#212121');
        this.particles.spawnSparks(st.x + target.x, st.y + target.y, '#FF3D00', 8);

        st.floatingHits.push({
          text: 'BURNT! -20',
          color: '#FF1744',
          x: target.x,
          y: target.y - 10,
          alpha: 1.0,
          scale: 1.0
        });
      } else if (target.type === 'rainbow') {
        // High-value sweet caramel popcorn!
        st.combo++;
        st.kernelsSnagged++;
        const pts = 50 + st.combo * 5;
        st.score += pts;
        st.kernels.splice(bestIdx, 1);

        this.audio.playScore();
        this.particles.spawnSparks(st.x + target.x, st.y + target.y, '#FFD700', 12);
        this.particles.spawnSparks(st.x + target.x, st.y + target.y, '#00E676', 6);

        st.floatingHits.push({
          text: st.combo > 1 ? `CARAMEL! ${st.combo}x` : 'CARAMEL! +50',
          color: '#FFD700',
          x: target.x,
          y: target.y - 12,
          alpha: 1.0,
          scale: 1.15
        });
      } else {
        // Standard golden butter kernel
        const isPerfect = target.y >= -36 && target.y <= -24;
        st.combo++;
        st.kernelsSnagged++;

        if (isPerfect) {
          const pts = 25 + st.combo * 4;
          st.score += pts;
          this.audio.playScore();
          this.particles.spawnSparks(st.x + target.x, st.y + target.y, '#FFF9C4', 8);

          st.floatingHits.push({
            text: st.combo > 1 ? `PERFECT! ${st.combo}x` : 'PERFECT! +25',
            color: '#FFEE58',
            x: target.x,
            y: target.y - 12,
            alpha: 1.0,
            scale: 1.1
          });
        } else {
          const pts = 15 + st.combo * 2;
          st.score += pts;
          this.audio.playTap();
          this.particles.emit(st.x + target.x, st.y + target.y, 5, '#FFF9C4');

          st.floatingHits.push({
            text: 'GOOD! +15',
            color: '#FFFFFF',
            x: target.x,
            y: target.y - 10,
            alpha: 1.0,
            scale: 0.95
          });
        }

        st.kernels.splice(bestIdx, 1);
      }
    } else {
      // 4. WHIFF & SPAM PENALTY:
      // Tapping when no kernel is in the sweet spot jams the scoop lid shut!
      st.jamTimer = 0.85;
      st.jamMaxTimer = 0.85;
      st.combo = 0;
      st.shakeTimer = 0.25;

      this.audio.playBounce();
      this.particles.emit(st.x, st.y - 15, 4, '#90A4AE');

      st.floatingHits.push({
        text: 'JAMMED!',
        color: '#FF1744',
        x: 0,
        y: -25,
        alpha: 1.0,
        scale: 1.1
      });
    }
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    _width: number,
    _height: number
  ): void {
    let timer = (this.botReactionTimers.get(botId) || 0) - dt;
    if (timer > 0) {
      this.botReactionTimers.set(botId, timer);
      return;
    }

    const st = this.playersState.get(botId);
    if (!st) return;

    // If jammed, bot cannot act
    if (st.jamTimer > 0) {
      this.botReactionTimers.set(botId, 0.15);
      return;
    }

    // Inspect kernels in kettle
    const poppedKernels = st.kernels.filter(k => k.state === 'popped');

    let shouldSnag = false;
    let nextDelay = 0.2;

    if (difficulty === 'bot_easy') {
      nextDelay = 0.35 + Math.random() * 0.2;
      // Easy bot occasionally whiffs randomly or catches burnt kernels
      const inZone = poppedKernels.find(k => k.y >= -44 && k.y <= -14);
      if (inZone) {
        if (inZone.type === 'burnt' && Math.random() < 0.35) {
          shouldSnag = true; // mistake
        } else if (inZone.type !== 'burnt' && Math.random() < 0.65) {
          shouldSnag = true;
        }
      } else if (Math.random() < 0.08) {
        // Random bad tap that jams
        shouldSnag = true;
      }
    } else if (difficulty === 'bot_hard') {
      nextDelay = 0.10 + Math.random() * 0.08;
      // Hard bot precisely targets apex window and meticulously ignores burnt kernels
      const perfectKernel = poppedKernels.find(k => k.type !== 'burnt' && k.y >= -36 && k.y <= -24);
      if (perfectKernel && Math.random() * 0.94) {
        shouldSnag = true;
      }
    } else {
      // Normal bot
      nextDelay = 0.20 + Math.random() * 0.12;
      const goodKernel = poppedKernels.find(k => k.type !== 'burnt' && k.y >= -44 && k.y <= -16);
      if (goodKernel && Math.random() < 0.80) {
        shouldSnag = true;
      } else {
        // Rare mistake on burnt
        const burntInZone = poppedKernels.find(k => k.type === 'burnt' && k.y >= -35 && k.y <= -18);
        if (burntInZone && Math.random() < 0.12) {
          shouldSnag = true;
        }
      }
    }

    if (shouldSnag) {
      this.handleSnag(st);
    }

    this.botReactionTimers.set(botId, nextDelay);
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
        popcorn: st?.kernelsSnagged || 0
      };
    });

    scores.sort((a, b) => b.score - a.score);
    const winnerId = scores.length > 0 && scores[0].score > 0 ? scores[0].playerId : null;
    const rankings = scores.map((s, idx) => ({
      playerId: s.playerId,
      score: s.score,
      place: idx + 1
    }));

    const topPopcorn = scores[0]?.popcorn || 0;
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} snagged ${topPopcorn} gourmet cinema kernels with master crunch timing!`
      : 'The popcorn kettle scorched without a master popper!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Cinema Concession Stand Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#140806');
    bgGrad.addColorStop(0.4, '#240F0A');
    bgGrad.addColorStop(0.75, '#38160E');
    bgGrad.addColorStop(1, '#1A0B08');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Warm stage spotlight glow
    const spotlight = ctx.createRadialGradient(width / 2, height * 0.35, 40, width / 2, height * 0.35, width * 0.6);
    spotlight.addColorStop(0, 'rgba(255, 236, 179, 0.12)');
    spotlight.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = spotlight;
    ctx.fillRect(0, 0, width, height);

    // Concession Counter Tabletop along lower screen (kettles rest directly on this counter)
    const counterY = height * 0.56;
    const counterGrad = ctx.createLinearGradient(0, counterY, 0, height);
    counterGrad.addColorStop(0, '#5D4037');
    counterGrad.addColorStop(0.08, '#3E2723');
    counterGrad.addColorStop(1, '#271916');
    ctx.fillStyle = counterGrad;
    ctx.fillRect(0, counterY, width, height - counterY);

    // Polished brass counter rail
    ctx.fillStyle = '#FFD54F';
    ctx.fillRect(0, counterY - 4, width, 4);
    ctx.fillStyle = '#FFA000';
    ctx.fillRect(0, counterY, width, 2);

    // 2. Cinema Subtitle Header (cleanly below the top HUD)
    ctx.save();
    ctx.textAlign = 'center';

    // Instructions pill
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 250, 56, 500, 26, 13);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 213, 79, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '700 11px sans-serif';
    ctx.fillStyle = '#FFF59D';
    ctx.fillText('CRUNCH AT APEX! • BURNT = -20 PTS • MASHING WHIFFS = JAMMED SCOOP!', width / 2, 73);
    ctx.restore();

    // 3. Render Kettle Stations for Each Player
    for (const p of this.getActivePlayers()) {
      const st = this.playersState.get(p.id);
      if (!st) continue;

      ctx.save();

      // Station vibration shake when struck or jammed
      let shakeX = 0;
      let shakeY = 0;
      if (st.shakeTimer > 0) {
        shakeX = Math.sin(st.shakeTimer * 50) * 4;
        shakeY = Math.cos(st.shakeTimer * 40) * 2;
      }
      ctx.translate(st.x + shakeX, st.y + shakeY);

      // Glass Kettle Chamber
      const kettleW = 82;
      const kettleH = 104;
      const kettleTop = -78;

      // Behind-glass shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(-kettleW / 2, kettleTop, kettleW, kettleH);

      // Glass enclosure body with warm internal illumination
      ctx.fillStyle = 'rgba(255, 248, 225, 0.12)';
      ctx.fillRect(-kettleW / 2, kettleTop, kettleW, kettleH);

      // Soot layer if player recently caught a burnt kernel
      if (st.sootTimer > 0) {
        const sootAlpha = Math.min(0.65, st.sootTimer * 0.7);
        ctx.fillStyle = `rgba(30, 20, 20, ${sootAlpha})`;
        ctx.fillRect(-kettleW / 2, kettleTop, kettleW, kettleH);
      }

      // CRUNCH TARGET ZONE GUIDE
      // Drawn as subtle glowing horizontal reticle brackets between y = -38 and y = -20
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 213, 79, 0.55)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-kettleW / 2 + 6, -38, kettleW - 12, 18);
      ctx.setLineDash([]);

      ctx.fillStyle = '#FFEE58';
      ctx.font = '800 8.5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('CRUNCH ZONE', 0, -26);
      ctx.restore();

      // Vintage brass corner posts
      ctx.fillStyle = '#FFA000';
      ctx.fillRect(-kettleW / 2 - 2, kettleTop, 4, kettleH);
      ctx.fillRect(kettleW / 2 - 2, kettleTop, 4, kettleH);
      ctx.fillStyle = '#FFD54F';
      ctx.fillRect(-kettleW / 2 - 1, kettleTop, 2, kettleH);
      ctx.fillRect(kettleW / 2 - 1, kettleTop, 2, kettleH);

      // Glass border highlights
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-kettleW / 2, kettleTop, kettleW, kettleH);

      // Angled glass glare reflection
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.moveTo(-kettleW / 2 + 6, kettleTop + 2);
      ctx.lineTo(-kettleW / 2 + 18, kettleTop + 2);
      ctx.lineTo(-kettleW / 2 + 4, kettleTop + kettleH - 12);
      ctx.lineTo(-kettleW / 2 + 2, kettleTop + kettleH - 12);
      ctx.closePath();
      ctx.fill();

      // Hot bottom plate & heating element
      ctx.fillStyle = '#D32F2F';
      ctx.fillRect(-kettleW / 2 + 2, 20, kettleW - 4, 6);

      // Glowing radiant heating coils
      const pulse = Math.sin(Date.now() * 0.008) * 0.3 + 0.7;
      ctx.fillStyle = `rgba(255, 87, 34, ${pulse})`;
      ctx.fillRect(-kettleW / 2 + 6, 21, kettleW - 12, 4);

      // Render Kernels inside kettle
      for (const k of st.kernels) {
        ctx.save();
        ctx.translate(k.x, k.y);
        ctx.rotate(k.rotation);

        if (k.state === 'heating') {
          // Unpopped seed
          if (k.type === 'burnt') {
            // Dark charcoal coal
            ctx.fillStyle = '#263238';
            ctx.beginPath();
            ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
            ctx.fill();
            // Glowing red ember crack
            ctx.fillStyle = '#FF3D00';
            ctx.beginPath();
            ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
            ctx.fill();
          } else if (k.type === 'rainbow') {
            ctx.fillStyle = '#FF80AB';
            ctx.beginPath();
            ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(-1, -1, 2, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Golden yellow corn seed
            ctx.fillStyle = '#FFC107';
            ctx.beginPath();
            ctx.arc(0, 0, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#FFA000';
            ctx.beginPath();
            ctx.arc(-1, -1, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (k.state === 'popped') {
          // Fluffy multi-lobed popped kernel
          if (k.type === 'burnt') {
            // Smoldering charcoal popcorn!
            ctx.fillStyle = '#37474F';
            ctx.beginPath();
            ctx.arc(0, 0, 7, 0, Math.PI * 2);
            ctx.arc(-3, -3, 5, 0, Math.PI * 2);
            ctx.arc(3, -2, 5, 0, Math.PI * 2);
            ctx.fill();

            // Ember cracks
            ctx.fillStyle = '#FF3D00';
            ctx.beginPath();
            ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
            ctx.fill();
          } else if (k.type === 'rainbow') {
            // Sweet Caramel Glaze
            ctx.fillStyle = '#FFE082';
            ctx.beginPath();
            ctx.arc(0, 0, 8, 0, Math.PI * 2);
            ctx.arc(-4, -3, 6, 0, Math.PI * 2);
            ctx.arc(4, -2, 6, 0, Math.PI * 2);
            ctx.fill();

            // Caramel glaze
            ctx.fillStyle = '#FFB300';
            ctx.beginPath();
            ctx.arc(1, -1, 4, 0, Math.PI * 2);
            ctx.fill();

            // Glistening star glint
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-2, -3, 4, 1.5);
            ctx.fillRect(-1, -4.5, 2, 4.5);
          } else {
            // Fluffy Golden Butter Popcorn
            ctx.fillStyle = '#FFFDE7';
            ctx.beginPath();
            ctx.arc(0, 0, 7.5, 0, Math.PI * 2);
            ctx.arc(-3.5, -3, 5.5, 0, Math.PI * 2);
            ctx.arc(3.5, -2, 5.5, 0, Math.PI * 2);
            ctx.fill();

            // Rich melted butter core
            ctx.fillStyle = '#FFD54F';
            ctx.beginPath();
            ctx.arc(-0.5, -0.5, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();
      }

      // Kettle Top Brass Hood & Scoop Assembly
      ctx.fillStyle = '#FFA000';
      ctx.beginPath();
      ctx.roundRect(-kettleW / 2 - 4, kettleTop - 8, kettleW + 8, 10, [6, 6, 2, 2]);
      ctx.fill();
      ctx.fillStyle = '#FFD54F';
      ctx.fillRect(-kettleW / 2 - 2, kettleTop - 7, kettleW + 4, 3);

      // Active Snag Butter Scoop Arm
      if (st.snagAnim > 0) {
        ctx.save();
        const scoopProgress = Math.sin(st.snagAnim * Math.PI);
        const scoopY = -28 + scoopProgress * 12;

        ctx.fillStyle = '#CFD8DC';
        ctx.beginPath();
        ctx.roundRect(-kettleW / 2 + 8, scoopY, kettleW - 16, 7, 3);
        ctx.fill();
        ctx.fillStyle = '#ECEFF1';
        ctx.fillRect(-kettleW / 2 + 10, scoopY + 1, kettleW - 20, 2);
        ctx.restore();
      }

      // JAMMED LOCKOUT WARNING OVERLAY
      if (st.jamTimer > 0) {
        // Red flashing warning banner
        const jamRatio = st.jamTimer / st.jamMaxTimer;
        ctx.fillStyle = 'rgba(211, 47, 47, 0.85)';
        ctx.beginPath();
        ctx.roundRect(-kettleW / 2 + 4, -42, kettleW - 8, 26, 4);
        ctx.fill();
        ctx.strokeStyle = '#FFCDD2';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ JAMMED!', 0, -28);

        // Lockout progress bar
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(-kettleW / 2 + 8, -23, kettleW - 16, 4);
        ctx.fillStyle = '#FFEB3B';
        ctx.fillRect(-kettleW / 2 + 8, -23, (kettleW - 16) * (1 - jamRatio), 4);
      }

      // Floating hit texts
      for (const hit of st.floatingHits) {
        ctx.save();
        ctx.translate(hit.x, hit.y);
        ctx.scale(hit.scale, hit.scale);
        ctx.globalAlpha = Math.max(0, hit.alpha);
        ctx.font = '900 13px sans-serif';
        ctx.textAlign = 'center';

        // Dark text halo outline
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(hit.text, 0, 0);

        ctx.fillStyle = hit.color;
        ctx.fillText(hit.text, 0, 0);
        ctx.restore();
      }

      ctx.restore();

      // 4. Station Player Card & Scoreboard affixed to counter front
      ctx.save();
      const cardY = counterY + 14;
      const cardW = 100;
      const cardH = 54;

      // Card bevel background
      ctx.fillStyle = '#1E1513';
      ctx.beginPath();
      ctx.roundRect(st.x - cardW / 2, cardY, cardW, cardH, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Player name & score
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 12px sans-serif';
      ctx.fillText(p.name, st.x, cardY + 17);

      ctx.font = '900 18px monospace';
      ctx.fillStyle = '#FFD54F';
      ctx.fillText(`${st.score}`, st.x, cardY + 34);

      // Streak/combo or snag count badge
      if (st.combo >= 2) {
        ctx.fillStyle = '#FF7043';
        ctx.font = '800 10px monospace';
        ctx.fillText(`🔥 ${st.combo}x STREAK`, st.x, cardY + 47);
      } else {
        ctx.fillStyle = '#B0BEC5';
        ctx.font = '700 9px monospace';
        ctx.fillText(`Snagged: ${st.kernelsSnagged}`, st.x, cardY + 47);
      }

      ctx.restore();
    }
  }
}

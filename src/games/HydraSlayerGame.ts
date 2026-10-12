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

interface HydraHead {
  id: number;
  x: number;
  y: number; // -100 (high) to 20 (striking ground)
  vy: number;
  type: 'head' | 'venom';
  color: string;
  state: 'lunging' | 'severed';
}

interface SlayerStation {
  id: PlayerId;
  x: number;
  y: number;
  heads: HydraHead[];
  spawnTimer: number;
  swordAnim: number; // 0 to 1
  score: number;
  combo: number;
  headsSevered: number;
  stunTimer: number;
  shakeTimer: number;
  floatingHits: FloatingHit[];
}

export class HydraSlayerGame extends BaseGame {
  public playersState: Map<PlayerId, SlayerStation> = new Map();
  public currentMapName: string = 'Swamp of Lerna';

  private headIdCounter: number = 0;
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
    const groundY = height * 0.60;

    active.forEach((p, idx) => {
      this.playersState.set(p.id, {
        id: p.id,
        x: spacing * (idx + 1),
        y: groundY - 24,
        heads: [
          { id: ++this.headIdCounter, x: 0, y: -70, vy: 80, type: 'head', color: '#00E676', state: 'lunging' }
        ],
        spawnTimer: 0.8 + Math.random() * 0.4,
        swordAnim: 0,
        score: 0,
        combo: 0,
        headsSevered: 0,
        stunTimer: 0,
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

      if (st.swordAnim > 0) st.swordAnim = Math.max(0, st.swordAnim - dt * 6);
      if (st.stunTimer > 0) st.stunTimer = Math.max(0, st.stunTimer - dt);
      if (st.shakeTimer > 0) st.shakeTimer = Math.max(0, st.shakeTimer - dt);

      // Update floating texts
      for (let i = st.floatingHits.length - 1; i >= 0; i--) {
        const hit = st.floatingHits[i];
        hit.y -= dt * 32;
        hit.alpha -= dt * 1.5;
        hit.scale = Math.min(1.2, hit.scale + dt * 0.8);
        if (hit.alpha <= 0) {
          st.floatingHits.splice(i, 1);
        }
      }

      // Spawn hydra heads & venom spit
      st.spawnTimer -= dt;
      if (st.spawnTimer <= 0 && st.heads.length < 5) {
        st.spawnTimer = 0.75 + Math.random() * 0.55;

        const isVenom = Math.random() < 0.18;
        st.heads.push({
          id: ++this.headIdCounter,
          x: (Math.random() - 0.5) * 26,
          y: -110,
          vy: isVenom ? 160 : 100 + Math.random() * 45,
          type: isVenom ? 'venom' : 'head',
          color: isVenom ? '#E040FB' : (Math.random() < 0.25 ? '#FFD700' : '#00E676'),
          state: 'lunging'
        });
      }

      // Update lunging heads
      for (let i = st.heads.length - 1; i >= 0; i--) {
        const head = st.heads[i];
        head.y += head.vy * dt;

        // Reached player ground level
        if (head.y > 18) {
          if (head.type === 'venom') {
            this.particles.emit(st.x + head.x, st.y + 14, 4, '#E040FB');
          } else {
            // Hydra head bit the hero!
            st.combo = 0;
            st.score = Math.max(0, st.score - 10);
            st.stunTimer = 0.5;
            st.shakeTimer = 0.35;
            this.audio.playExplosion();
            this.particles.emit(st.x + head.x, st.y + 14, 6, '#D32F2F');

            st.floatingHits.push({
              text: 'BITTEN! -10',
              color: '#FF1744',
              x: head.x,
              y: 0,
              alpha: 1.0,
              scale: 1.0
            });
          }
          st.heads.splice(i, 1);
        }
      }

      // Check player input: Heroic sword slash
      const justAction = this.input.justAction(p.id) || this.input.justPressed(p.id);
      if (justAction) {
        this.handleSlash(st);
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  private handleSlash(st: SlayerStation): void {
    if (st.stunTimer > 0) return;

    st.swordAnim = 1.0;

    // Strike Zone: y between -26 and 14
    let bestIdx = -1;
    let bestDist = 9999;

    for (let i = 0; i < st.heads.length; i++) {
      const h = st.heads[i];
      if (h.y >= -28 && h.y <= 16) {
        const dist = Math.abs(h.y - (-4));
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
    }

    if (bestIdx !== -1) {
      const head = st.heads[bestIdx];

      if (head.type === 'venom') {
        // VENOM SPIT HIT!
        st.score = Math.max(0, st.score - 15);
        st.combo = 0;
        st.stunTimer = 0.8;
        st.shakeTimer = 0.4;
        st.heads.splice(bestIdx, 1);

        this.audio.playExplosion();
        this.particles.emit(st.x, st.y, 8, '#E040FB');

        st.floatingHits.push({
          text: 'VENOM POISON! -15 ☠️',
          color: '#E040FB',
          x: 0,
          y: -20,
          alpha: 1.0,
          scale: 1.15
        });
      } else {
        // SEVERED HYDRA HEAD!
        st.headsSevered++;
        st.combo++;
        const isGolden = head.color === '#FFD700';
        const basePts = isGolden ? 50 : 25;
        const totalPts = basePts + st.combo * 4;
        st.score += totalPts;

        this.audio.playScore();
        if (isGolden) {
          this.audio.playChime();
          this.particles.spawnSparks(st.x + head.x, st.y + head.y, '#FFD700', 14);
        } else {
          this.particles.spawnSparks(st.x + head.x, st.y + head.y, '#00E676', 8);
        }

        st.floatingHits.push({
          text: isGolden ? `GOLDEN HEAD! +${totalPts}` : (st.combo > 1 ? `SEVERED! ${st.combo}x` : `SEVERED! +${totalPts}`),
          color: isGolden ? '#FFD700' : '#69F0AE',
          x: head.x,
          y: head.y - 12,
          alpha: 1.0,
          scale: isGolden ? 1.2 : 1.0
        });

        st.heads.splice(bestIdx, 1);
      }
    } else {
      this.audio.playWhoosh();
      st.floatingHits.push({
        text: 'WHIFF!',
        color: '#9E9E9E',
        x: 0,
        y: -15,
        alpha: 0.7,
        scale: 0.85
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
    if (!st || st.stunTimer > 0) return;

    let shouldSlash = false;
    const inZone = st.heads.find(h => h.y >= -24 && h.y <= 14);

    if (inZone) {
      if (inZone.type === 'venom') {
        if (difficulty === 'bot_easy' && Math.random() < 0.28) shouldSlash = true;
      } else {
        if (difficulty === 'bot_easy') shouldSlash = Math.random() < 0.65;
        else if (difficulty === 'bot_hard') shouldSlash = Math.random() < 0.95;
        else shouldSlash = Math.random() < 0.82;
      }
    }

    if (shouldSlash) {
      this.handleSlash(st);
    }

    const nextDelay = difficulty === 'bot_hard' ? 0.10 : difficulty === 'bot_normal' ? 0.18 : 0.32;
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
        severed: st?.headsSevered || 0
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
    const mvpHighlight = winnerId !== null
      ? `Player ${winnerId + 1} severed ${topSevered} mythical Hydra heads!`
      : 'The multi-headed Hydra overwhelmed the ancient heroes!';

    return {
      winnerId,
      rankings,
      mvpHighlight
    };
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Mythological Greek Swamp Backdrop
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#06130B');
    bgGrad.addColorStop(0.35, '#0E2417');
    bgGrad.addColorStop(0.7, '#153623');
    bgGrad.addColorStop(1, '#08170D');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Ancient Stone Temple ruins along lower screen
    const groundY = height * 0.60;
    const groundGrad = ctx.createLinearGradient(0, groundY, 0, height);
    groundGrad.addColorStop(0, '#37474F');
    groundGrad.addColorStop(0.06, '#263238');
    groundGrad.addColorStop(1, '#1A2327');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, groundY, width, height - groundY);

    // Marble temple pediment trim
    ctx.fillStyle = '#CFD8DC';
    ctx.fillRect(0, groundY - 4, width, 4);
    ctx.fillStyle = '#90A4AE';
    ctx.fillRect(0, groundY, width, 2);

    // 2. Instructions Pill
    ctx.save();
    ctx.textAlign = 'center';

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.roundRect(width / 2 - 255, 56, 510, 26, 13);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 230, 118, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.font = '700 11px sans-serif';
    ctx.fillStyle = '#B9F6CA';
    ctx.fillText('STRIKE LUNGING HYDRA HEADS • DODGE PURPLE VENOM • SLAY THE BEAST!', width / 2, 73);
    ctx.restore();

    // 3. Render Slayer Stations
    for (const p of this.getActivePlayers()) {
      const st = this.playersState.get(p.id);
      if (!st) continue;

      ctx.save();

      let shakeX = 0;
      let shakeY = 0;
      if (st.shakeTimer > 0) {
        shakeX = Math.sin(st.shakeTimer * 50) * 4;
        shakeY = Math.cos(st.shakeTimer * 40) * 2;
      }
      ctx.translate(st.x + shakeX, st.y + shakeY);

      // Marble Altar Base
      ctx.fillStyle = '#455A64';
      ctx.beginPath();
      ctx.roundRect(-38, 4, 76, 20, [4, 4, 0, 0]);
      ctx.fill();

      // STRIKE ZONE GUIDE
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 230, 118, 0.45)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-36, -22, 72, 26);
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(185, 246, 202, 0.7)';
      ctx.font = '800 8.5px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('STRIKE ZONE', 0, -10);
      ctx.restore();

      // Render Hydra Heads lunging
      for (const head of st.heads) {
        ctx.save();
        ctx.translate(head.x, head.y);

        if (head.type === 'venom') {
          // Purple toxic venom orb
          ctx.fillStyle = '#E040FB';
          ctx.beginPath();
          ctx.arc(0, 0, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#EA80FC';
          ctx.beginPath();
          ctx.arc(-1, -1, 3, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Mythical Serpentine Hydra Head
          ctx.fillStyle = head.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, 9, 13, 0, 0, Math.PI * 2);
          ctx.fill();

          // Fierce Red Glowing Eyes
          ctx.fillStyle = '#FF1744';
          ctx.beginPath();
          ctx.arc(-3, -3, 2, 0, Math.PI * 2);
          ctx.arc(3, -3, 2, 0, Math.PI * 2);
          ctx.fill();

          // Serpent neck connecting above
          ctx.strokeStyle = head.color;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(0, -13);
          ctx.quadraticCurveTo(-4, -25, 0, -40);
          ctx.stroke();
        }

        ctx.restore();
      }

      // Heroic Spartan Sword & Shield
      ctx.save();
      const slashProgress = Math.sin(st.swordAnim * Math.PI);
      const swordAngle = -0.4 + slashProgress * 1.6;
      ctx.translate(0, -4);
      ctx.rotate(swordAngle);

      // Golden Spartan Gladius Sword
      ctx.fillStyle = '#FFD700';
      ctx.fillRect(-2, -32, 4, 30);
      ctx.fillStyle = '#FFA000';
      ctx.fillRect(-6, -6, 12, 3);
      ctx.fillStyle = '#795548';
      ctx.fillRect(-1.5, -3, 3, 7);
      ctx.restore();

      // STUN OVERLAY
      if (st.stunTimer > 0) {
        ctx.fillStyle = 'rgba(211, 47, 47, 0.85)';
        ctx.beginPath();
        ctx.roundRect(-36, -35, 72, 24, 4);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('STUNNED!', 0, -20);
      }

      // Floating hit texts
      for (const hit of st.floatingHits) {
        ctx.save();
        ctx.translate(hit.x, hit.y);
        ctx.scale(hit.scale, hit.scale);
        ctx.globalAlpha = Math.max(0, hit.alpha);
        ctx.font = '900 12px sans-serif';
        ctx.textAlign = 'center';

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeText(hit.text, 0, 0);

        ctx.fillStyle = hit.color;
        ctx.fillText(hit.text, 0, 0);
        ctx.restore();
      }

      ctx.restore();

      // 4. Station Player Card affixed to ground front
      ctx.save();
      const cardY = groundY + 14;
      const cardW = 100;
      const cardH = 54;

      ctx.fillStyle = '#1B262C';
      ctx.beginPath();
      ctx.roundRect(st.x - cardW / 2, cardY, cardW, cardH, 8);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 12px sans-serif';
      ctx.fillText(p.name, st.x, cardY + 17);

      ctx.font = '900 18px monospace';
      ctx.fillStyle = '#FFD54F';
      ctx.fillText(`${st.score}`, st.x, cardY + 34);

      if (st.combo >= 2) {
        ctx.fillStyle = '#00E676';
        ctx.font = '800 10px monospace';
        ctx.fillText(`⚡ ${st.combo}x STRIKE`, st.x, cardY + 47);
      } else {
        ctx.fillStyle = '#B9F6CA';
        ctx.font = '700 9px monospace';
        ctx.fillText(`⚔️ Severed: ${st.headsSevered}`, st.x, cardY + 47);
      }

      ctx.restore();
    }
  }
}

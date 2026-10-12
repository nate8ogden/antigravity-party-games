import { BaseGame } from './BaseGame';
import { PlayerConfig, PlayerId, RoundResult } from '../core/Types';
import { InputRouter } from '../core/InputRouter';
import { AudioEngine } from '../core/AudioEngine';
import { ParticleSystem } from '../core/ParticleSystem';

interface MirrorEncounter {
  type: 'CURSED_PHANTOM' | 'GUARDIAN_SPIRIT';
  revealTimer: number; // time until strike/blessing
  isActive: boolean;
  resolved: boolean;
}

interface MirrorPlayer {
  id: PlayerId;
  encounter: MirrorEncounter | null;
  encounterCooldown: number;
  shatterAnim: number;
  score: number;
}

export class PhantomMirrorGazeGame extends BaseGame {
  private playersState: Map<PlayerId, MirrorPlayer> = new Map();

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
    this.roundTimer = 30;
    this.playersState.clear();

    const active = this.getActivePlayers();
    active.forEach((p) => {
      this.playersState.set(p.id, {
        id: p.id,
        encounter: null,
        encounterCooldown: 0.5 + Math.random() * 1.5,
        shatterAnim: 0,
        score: 0
      });
    });
  }

  public update(dt: number, width: number, height: number): void {
    if (this.isFinished) return;
    this.roundTimer = Math.max(0, this.roundTimer - dt);
    this.updateBots(dt, width, height);

    for (const p of this.getActivePlayers()) {
      const ps = this.playersState.get(p.id);
      if (!ps) continue;

      if (ps.shatterAnim > 0) ps.shatterAnim = Math.max(0, ps.shatterAnim - dt * 2);

      // Handle encounter spawning
      if (!ps.encounter) {
        ps.encounterCooldown -= dt;
        if (ps.encounterCooldown <= 0) {
          const isCursed = Math.random() < 0.6;
          ps.encounter = {
            type: isCursed ? 'CURSED_PHANTOM' : 'GUARDIAN_SPIRIT',
            revealTimer: 1.3,
            isActive: true,
            resolved: false
          };
          this.audio.playWhoosh();
        }
      } else {
        const enc = ps.encounter;
        enc.revealTimer -= dt;

        // Player mallet tap to shatter mirror
        const tap = this.input.justPressed(p.id);
        if (tap && !enc.resolved) {
          enc.resolved = true;
          ps.shatterAnim = 1.0;
          this.audio.playExplosion();

          if (enc.type === 'CURSED_PHANTOM') {
            // Correctly banished cursed phantom!
            ps.score += 35;
            this.audio.playScore();
            this.particles.showFloatingText('PHANTOM BANISHED! +35', width / 2, height / 2, '#EF4444', 22);
            this.particles.spawnExplosion(width / 2, height / 2, '#A855F7', 12);
          } else {
            // Shattered friendly guardian blessing!
            ps.score = Math.max(0, ps.score - 20);
            this.audio.playStun();
            this.particles.showFloatingText('SHATTERED BLESSING! -20', width / 2, height / 2, '#F59E0B', 20);
          }

          ps.encounter = null;
          ps.encounterCooldown = 1.2 + Math.random() * 1.2;
          continue;
        }

        // Timer expired naturally
        if (enc.revealTimer <= 0 && !enc.resolved) {
          enc.resolved = true;

          if (enc.type === 'GUARDIAN_SPIRIT') {
            // Patiently allowed guardian spirit to bless!
            ps.score += 45;
            this.audio.playScore();
            this.particles.showFloatingText('SPIRIT BLESSED! +45', width / 2, height / 2, '#10B981', 24);
            this.particles.spawnConfetti(width / 2, height / 2, 14);
          } else {
            // Cursed phantom struck because player did not shatter!
            ps.score = Math.max(0, ps.score - 25);
            this.audio.playStun();
            this.particles.showFloatingText('CURSED BY PHANTOM! -25', width / 2, height / 2, '#EF4444', 22);
            this.particles.spawnExplosion(width / 2, height / 2, '#EF4444', 14);
          }

          ps.encounter = null;
          ps.encounterCooldown = 1.2 + Math.random() * 1.2;
        }
      }
    }

    if (this.roundTimer <= 0) {
      this.isFinished = true;
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // 1. Haunted Victorian Hall of Vanity Mirrors
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#1E1B4B');
    bgGrad.addColorStop(0.5, '#0F172A');
    bgGrad.addColorStop(1, '#020617');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const active = this.getActivePlayers();
    const count = active.length;
    const zoneW = width / count;

    active.forEach((p, idx) => {
      const ps = this.playersState.get(p.id);
      if (!ps) return;
      const zoneCenterX = zoneW * idx + zoneW / 2;
      const mirrorY = height * 0.52;
      const mirrorW = Math.min(zoneW * 0.78, 130);
      const mirrorH = Math.min(height * 0.65, 220);

      ctx.save();
      ctx.translate(zoneCenterX, mirrorY);

      // Ornate Silver Mirror Frame
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.roundRect(-mirrorW / 2 - 8, -mirrorH / 2 - 8, mirrorW + 16, mirrorH + 16, 20);
      ctx.fill();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.stroke();

      // Mirror Glass Surface
      const glassGrad = ctx.createLinearGradient(0, -mirrorH / 2, 0, mirrorH / 2);
      glassGrad.addColorStop(0, '#1E293B');
      glassGrad.addColorStop(0.5, '#334155');
      glassGrad.addColorStop(1, '#0F172A');
      ctx.fillStyle = glassGrad;
      ctx.beginPath();
      ctx.roundRect(-mirrorW / 2, -mirrorH / 2, mirrorW, mirrorH, 14);
      ctx.fill();

      // Player Reflection Face
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 20, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Eyes
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(-8, 16, 4, 0, Math.PI * 2);
      ctx.arc(8, 16, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(-8, 16, 2, 0, Math.PI * 2);
      ctx.arc(8, 16, 2, 0, Math.PI * 2);
      ctx.fill();

      // Apparition in mirror
      if (ps.encounter) {
        const enc = ps.encounter;
        const appY = -40;

        if (enc.type === 'CURSED_PHANTOM') {
          // Creepy Red Phantom Apparition Looming
          ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
          ctx.shadowColor = '#EF4444';
          ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.arc(0, appY, 24, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Phantom glowing eyes & mouth
          ctx.fillStyle = '#FEF08A';
          ctx.beginPath();
          ctx.arc(-8, appY - 4, 4, 0, Math.PI * 2);
          ctx.arc(8, appY - 4, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#000000';
          ctx.beginPath();
          ctx.arc(0, appY + 10, 6, 0, Math.PI);
          ctx.fill();

          // Warning
          ctx.fillStyle = '#EF4444';
          ctx.font = '900 10px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('SHATTER IT!!', 0, -mirrorH / 2 - 14);
        } else {
          // Golden Guardian Angel Spirit
          ctx.fillStyle = 'rgba(251, 191, 36, 0.85)';
          ctx.shadowColor = '#FBBF24';
          ctx.shadowBlur = 18;
          ctx.beginPath();
          ctx.arc(0, appY, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;

          // Halo
          ctx.strokeStyle = '#FEF08A';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(0, appY - 26, 16, 6, 0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = '#10B981';
          ctx.font = '900 10px Montserrat, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('DO NOT SHATTER!', 0, -mirrorH / 2 - 14);
        }
      }

      // Glass Shatter effect
      if (ps.shatterAnim > 0) {
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-mirrorW * 0.4, -mirrorH * 0.4);
        ctx.lineTo(0, 0);
        ctx.lineTo(mirrorW * 0.4, -mirrorH * 0.2);
        ctx.moveTo(0, 0);
        ctx.lineTo(-mirrorW * 0.3, mirrorH * 0.3);
        ctx.moveTo(0, 0);
        ctx.lineTo(mirrorW * 0.35, mirrorH * 0.4);
        ctx.stroke();
      }
      ctx.restore();

      // Score
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 12px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${p.name}: ${ps.score}`, zoneCenterX, mirrorY + mirrorH / 2 + 24);
    });

    // 2. Header HUD
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 20px Montserrat, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TIME: ${Math.ceil(this.roundTimer)}s`, width / 2, 28);
  }

  protected updateBotAI(
    dt: number,
    botId: PlayerId,
    difficulty: 'bot_easy' | 'bot_normal' | 'bot_hard',
    width: number,
    height: number
  ): void {
    const ps = this.playersState.get(botId);
    if (!ps || !ps.encounter) {
      this.input.setBotInput(botId, false, 0, 0, false);
      return;
    }

    const enc = ps.encounter;
    if (enc.type === 'CURSED_PHANTOM') {
      // Must shatter!
      const reactionDelay = difficulty === 'bot_hard' ? 0.3 : difficulty === 'bot_normal' ? 0.6 : 0.9;
      if (1.3 - enc.revealTimer > reactionDelay) {
        this.input.setBotInput(botId, true, 0, 0, true);
      } else {
        this.input.setBotInput(botId, false, 0, 0, false);
      }
    } else {
      // Guardian spirit -> do NOT shatter!
      // Occasional mistake on easy
      if (difficulty === 'bot_easy' && Math.random() < 0.05) {
        this.input.setBotInput(botId, true, 0, 0, true);
      } else {
        this.input.setBotInput(botId, false, 0, 0, false);
      }
    }
  }

  public getScore(playerId: PlayerId): number {
    return this.playersState.get(playerId)?.score ?? 0;
  }

  public isRoundOver(): boolean {
    return this.isFinished;
  }

  public getRoundResult(): RoundResult {
    const rankings = Array.from(this.playersState.entries())
      .map(([playerId, ps]) => ({ playerId, score: ps.score, place: 1 }))
      .sort((a, b) => b.score - a.score);

    rankings.forEach((entry, idx) => {
      entry.place = idx + 1;
    });

    const winnerId = rankings.length > 0 && rankings[0].score > 0 ? rankings[0].playerId : null;
    return {
      winnerId,
      rankings,
      mvpHighlight: winnerId ? `${winnerId} banished cursed phantoms and welcomed guardian spirit blessings!` : 'Tied phantom gaze!'
    };
  }
}

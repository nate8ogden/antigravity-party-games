/**
 * Sumo.js
 * Physics-Driven Sumo Dohyo Ring Combat (Sumo Arcade) for Retro Arcade Studio.
 * Features Vector2 momentum & center-of-mass ring-out physics, stamina-dependent
 * friction-drag decay, dynamic ring-edge tension visuals, and the 3-action combat
 * triangle: Shove (Action A), Tsuppari Slap (Action B), and Henka Sidestep (Perp + Action B).
 */
import { Vector2 } from '../engine/Vector2.js';
import { PALETTE, FONTS, HighScoreStore } from '../engine/Renderer.js';

const RANKS = [
  { name: 'MAEGASHIRA', aiName: 'TAKAYAMA', mass: 1.0, power: 0.92, reaction: 0.58, mawashi: PALETTE.BLUE },
  { name: 'KOMUSUBI', aiName: 'KOTONAMI', mass: 1.08, power: 1.0, reaction: 0.46, mawashi: PALETTE.GREEN },
  { name: 'SEKIWAKE', aiName: 'RAIDEN', mass: 1.15, power: 1.08, reaction: 0.36, mawashi: PALETTE.ORANGE },
  { name: 'OZEKI', aiName: 'KAIOH', mass: 1.24, power: 1.16, reaction: 0.28, mawashi: PALETTE.PURPLE },
  { name: 'YOKOZUNA', aiName: 'HAKUHO-X', mass: 1.35, power: 1.26, reaction: 0.21, mawashi: PALETTE.GOLD }
];

export class Sumo {
  constructor(renderer, input, audio) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;

    this.id = 'sumo';
    this.title = 'Sumo Arcade';

    this.width = 960;
    this.height = 540;

    // Dohyo Ring geometry
    this.ringCenter = new Vector2(480, 300);
    this.ringRadius = 195;
    this.baseDrag = 6.8;

    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;

    this.state = 'PLAYING';
    this.boutBannerTimer = 0;
    this.boutBannerText = '';
    this.kimariteSubtext = '';
    this.animTime = 0;

    this.shockwaves = [];
    this.particles = [];
    this.afterimages = [];
    this.tawaraCount = 44;

    this.reset();
  }

  setState(nextState) {
    this.state = nextState;
  }

  reset() {
    this.score = 0;
    this.highScore = HighScoreStore.get(this.id);
    this.lives = 3;
    this.level = 1;
    this.state = 'PLAYING';
    this._initBout('HAKKEYOI! NOKOTTA!');
  }

  _getCurrentRank() {
    return RANKS[Math.min(RANKS.length - 1, this.level - 1)];
  }

  _createWrestler({ isPlayer, x, y, facingX, mass, mawashiColor, name }) {
    return {
      isPlayer,
      name,
      pos: new Vector2(x, y),
      centerOfMass: new Vector2(x, y),
      vel: new Vector2(0, 0),
      facing: new Vector2(facingX, 0),
      radius: 26,
      mass,
      stamina: 100,
      balance: 100,
      stunTimer: 0,
      shoveTimer: 0,
      slapTimer: 0,
      henkaTimer: 0,
      cooldown: 0,
      lastHitBy: 'YORIKIRI',
      mawashiColor
    };
  }

  _initBout(banner = 'HAKKEYOI! NOKOTTA!') {
    const rank = this._getCurrentRank();

    this.player = this._createWrestler({
      isPlayer: true,
      x: this.ringCenter.x - 74,
      y: this.ringCenter.y,
      facingX: 1,
      mass: 1.12,
      mawashiColor: PALETTE.CYAN,
      name: 'RIKISHI 1P'
    });

    this.opponent = this._createWrestler({
      isPlayer: false,
      x: this.ringCenter.x + 74,
      y: this.ringCenter.y,
      facingX: -1,
      mass: rank.mass + Math.max(0, this.level - 5) * 0.05,
      mawashiColor: rank.mawashi,
      name: rank.aiName
    });

    this.aiDecisionTimer = 0.25;
    this.aiStrafeSign = 1;
    this.boutBannerText = banner;
    this.kimariteSubtext = `RANK: ${rank.name} VS ${rank.aiName}`;
    this.boutBannerTimer = 1.15;

    this.shockwaves = [];
    this.particles = [];
    this.afterimages = [];

    // Ceremonial salt scatter (Shio) burst at bout start from East & West corners
    for (let i = 0; i < 20; i++) {
      const side = i < 10 ? -1 : 1;
      const sx = this.ringCenter.x + side * 120 + (Math.random() - 0.5) * 24;
      const sy = this.ringCenter.y + (Math.random() - 0.5) * 40;
      this.particles.push({
        x: sx,
        y: sy,
        vx: -side * (35 + Math.random() * 85),
        vy: (Math.random() - 0.5) * 70 - 15,
        color: '#F8FAFC',
        size: 2.5,
        life: 0.75 + Math.random() * 0.35,
        maxLife: 1.1
      });
    }
  }

  update(dt) {
    const clampedDt = Math.min(dt, 0.05);
    this.animTime += clampedDt;

    if (this.input.isJustPressed('pause')) {
      if (this.state === 'PLAYING') {
        this.state = 'PAUSED';
        this.audio.playMenuSelect();
        return;
      } else if (this.state === 'PAUSED') {
        this.state = 'PLAYING';
        this.audio.playMenuSelect();
        return;
      }
    }

    if (this.state === 'MENU') {
      if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.state === 'PAUSED') {
      if (this.input.isJustPressed('actionA')) {
        this.audio.playMenuSelect();
        this.state = 'PLAYING';
      }
      return;
    }

    if (this.state === 'GAMEOVER') {
      if (this.input.isJustPressed('actionA') || this.input.pointer.justPressed) {
        this.audio.playMenuSelect();
        this.reset();
        this.state = 'PLAYING';
      }
      return;
    }

    this._updateEffects(clampedDt);

    if (this.boutBannerTimer > 0) {
      this.boutBannerTimer -= clampedDt;
      if (this.boutBannerTimer <= 0 && this.boutOutcome) {
        const outcome = this.boutOutcome;
        this.boutOutcome = null;
        if (outcome === 'WIN') {
          this.level += 1;
          this._initBout('NEXT BOUT — HAKKEYOI!');
        } else {
          this.lives -= 1;
          if (this.lives <= 0) {
            HighScoreStore.submit(this.id, this.score);
            this.state = 'GAMEOVER';
            this.audio.playGameOver();
          } else {
            this._initBout('REMATCH — NOKOTTA!');
          }
        }
        return;
      }
      if (this.boutOutcome) {
        // Still allow defeated wrestler to slide outside the Tawara during slow-mo banner
        this._updateWrestlerPhysics(this.player, clampedDt * 0.35);
        this._updateWrestlerPhysics(this.opponent, clampedDt * 0.35);
        return;
      }
    }

    this._handlePlayerInput(clampedDt);
    this._updateAI(clampedDt);

    this._updateWrestlerPhysics(this.player, clampedDt);
    this._updateWrestlerPhysics(this.opponent, clampedDt);

    this._resolveGrappleCollision(clampedDt);
    this._checkRingOut();
  }

  _handlePlayerInput(dt) {
    const p = this.player;
    const opp = this.opponent;

    if (p.stunTimer > 0) return;

    const axis = this.input.getAxis();
    const moveVec = new Vector2(axis.x, axis.y);

    // Compute unit vector toward opponent for natural Sumo stance orientation
    const toOpp = Vector2.sub(opp.pos, p.pos);
    const distToOpp = toOpp.len();
    const dirToOpp = distToOpp > 0.001 ? toOpp.clone().normalize() : new Vector2(1, 0);

    // Steering movement force
    if (moveVec.lenSq() > 0.01) {
      const driveForce = 680 * (0.65 + 0.35 * (p.stamina / 100));
      p.vel.addScaled(moveVec, driveForce * dt);
      p.facing.lerp(moveVec.clone().normalize(), 0.35).normalize();
    } else {
      p.facing.lerp(dirToOpp, 0.25).normalize();
    }

    if (p.cooldown > 0) return;

    // Action A (Z / Space): High-Impulse Forward Shove
    if (this.input.isJustPressed('actionA')) {
      this._performShove(p, opp);
      return;
    }

    // Action B (X / Shift): Henka Sidestep (when moving perpendicular) OR Tsuppari Slap
    if (this.input.isJustPressed('actionB')) {
      const perp = new Vector2(-dirToOpp.y, dirToOpp.x);
      const perpAlignment = Math.abs(moveVec.dot(perp));
      const isMovingPerp = moveVec.lenSq() > 0.1 && perpAlignment > 0.38;

      if (isMovingPerp || (opp.shoveTimer > 0 && moveVec.lenSq() > 0.1)) {
        const sign = moveVec.dot(perp) >= 0 ? 1 : -1;
        this._performHenkaSidestep(p, opp, perp.scale(sign));
      } else {
        this._performSlap(p, opp);
      }
    }
  }

  _performShove(attacker, defender) {
    const staminaRatio = Math.max(0.25, attacker.stamina / 100);
    attacker.stamina = Math.max(0, attacker.stamina - 18);
    attacker.shoveTimer = 0.24;
    attacker.cooldown = 0.28;

    const toDef = Vector2.sub(defender.pos, attacker.pos);
    const dist = toDef.len();
    const lungeDir = dist < 130 && dist > 1 ? toDef.clone().normalize() : attacker.facing.clone().normalize();
    attacker.facing.copy(lungeDir);

    // Forward lunge impulse
    attacker.vel.addScaled(lungeDir, 360 * staminaRatio);
    this.audio.playShove();

    // Direct shove hit if within striking reach and defender is not evading via Henka
    if (dist <= attacker.radius + defender.radius + 28 && defender.henkaTimer <= 0) {
      const defTiredMult = 1.0 + (1.0 - defender.stamina / 100) * 0.75;
      const defStunMult = defender.stunTimer > 0 ? 1.45 : 1.0;
      const defBalanceMult = 1.0 + (1.0 - defender.balance / 100) * 0.45;
      const impulse = (470 / defender.mass) * staminaRatio * defTiredMult * defStunMult * defBalanceMult;

      defender.vel.addScaled(lungeDir, impulse);
      defender.balance = Math.max(0, defender.balance - 26);
      defender.stamina = Math.max(0, defender.stamina - 8);
      defender.lastHitBy = 'OSHIDASHI';

      const contactPt = Vector2.lerp(attacker.pos, defender.pos, 0.5);
      this._spawnShockwave(contactPt.x, contactPt.y, attacker.mawashiColor, 54);
      this._spawnParticles(contactPt.x, contactPt.y, PALETTE.GOLD, 16);
      this.renderer.shake(7, 0.18);

      if (attacker.isPlayer) {
        this._addScore(50);
      }
    } else if (defender.henkaTimer > 0) {
      // Attacker's shove misses an evading Henka opponent — attacker's own momentum carries them forward!
      attacker.vel.addScaled(lungeDir, 210);
      attacker.balance = Math.max(0, attacker.balance - 25);
      attacker.lastHitBy = 'HATAKIKOMI';
    }
  }

  _performSlap(attacker, defender) {
    attacker.stamina = Math.max(0, attacker.stamina - 9);
    attacker.slapTimer = 0.2;
    attacker.cooldown = 0.24;

    const toDef = Vector2.sub(defender.pos, attacker.pos);
    const dist = toDef.len();
    const strikeDir = dist > 1 ? toDef.clone().normalize() : attacker.facing.clone().normalize();
    attacker.facing.copy(strikeDir);

    this.audio.playSlap();

    if (dist <= attacker.radius + defender.radius + 34 && defender.henkaTimer <= 0) {
      // Tsuppari palm strike stuns target briefly and drains stamina/balance
      defender.stunTimer = 0.55;
      defender.stamina = Math.max(0, defender.stamina - 16);
      defender.balance = Math.max(0, defender.balance - 32);
      defender.vel.addScaled(strikeDir, 195 / defender.mass);
      defender.lastHitBy = 'HATAKIKOMI';

      const contactPt = Vector2.lerp(attacker.pos, defender.pos, 0.5);
      this._spawnShockwave(contactPt.x, contactPt.y, PALETTE.PINK, 42);
      this._spawnParticles(contactPt.x, contactPt.y, PALETTE.PINK, 18);
      this.renderer.shake(5, 0.14);

      if (attacker.isPlayer) {
        this._addScore(75);
      }
    }
  }

  _performHenkaSidestep(wrestler, opponent, tangentDir) {
    wrestler.stamina = Math.max(0, wrestler.stamina - 12);
    wrestler.henkaTimer = 0.30;
    wrestler.cooldown = 0.32;

    // Tangential dash impulse around the line of attack
    wrestler.vel.addScaled(tangentDir, 440);
    wrestler.facing.copy(Vector2.sub(opponent.pos, wrestler.pos).normalize());
    this.audio.playHop();

    // If opponent was charging or close, pull them forward along their own momentum (Hatakikomi!)
    const dist = Vector2.dist(wrestler.pos, opponent.pos);
    if (dist < 110) {
      const oppForward = opponent.vel.len() > 25
        ? opponent.vel.clone().normalize()
        : Vector2.sub(wrestler.pos, opponent.pos).normalize();
      opponent.vel.addScaled(oppForward, 260 / opponent.mass);
      opponent.balance = Math.max(0, opponent.balance - 30);
      opponent.lastHitBy = 'HATAKIKOMI';
    }

    for (let i = 0; i < 3; i++) {
      this.afterimages.push({
        x: wrestler.pos.x - tangentDir.x * i * 10,
        y: wrestler.pos.y - tangentDir.y * i * 10,
        radius: wrestler.radius,
        color: wrestler.mawashiColor,
        life: 0.25,
        maxLife: 0.25
      });
    }
  }

  _updateAI(dt) {
    const ai = this.opponent;
    const player = this.player;
    const rank = this._getCurrentRank();

    if (ai.stunTimer > 0) return;

    const toPlayer = Vector2.sub(player.pos, ai.pos);
    const dist = toPlayer.len();
    const dirToPlayer = dist > 0.001 ? toPlayer.clone().normalize() : new Vector2(-1, 0);

    // AI awareness of ring center so it tries not to back itself out of the Dohyo
    const toCenter = Vector2.sub(this.ringCenter, ai.pos);
    const distFromCenter = toCenter.len();
    const nearEdge = distFromCenter > this.ringRadius * 0.68;

    const steer = dirToPlayer.clone();
    if (nearEdge) {
      steer.addScaled(toCenter.normalize(), 0.85).normalize();
    } else if (dist < 92) {
      const perp = new Vector2(-dirToPlayer.y * this.aiStrafeSign, dirToPlayer.x * this.aiStrafeSign);
      steer.addScaled(perp, 0.35).normalize();
    }

    const aiDrive = 560 * rank.power * (0.65 + 0.35 * (ai.stamina / 100));
    ai.vel.addScaled(steer, aiDrive * dt);
    ai.facing.lerp(dirToPlayer, 0.28).normalize();

    this.aiDecisionTimer -= dt;
    if (this.aiDecisionTimer <= 0 && ai.cooldown <= 0) {
      this.aiDecisionTimer = rank.reaction + Math.random() * 0.18;
      this.aiStrafeSign = Math.random() < 0.5 ? 1 : -1;

      if (dist <= ai.radius + player.radius + 32) {
        if (nearEdge && Math.random() < 0.35) {
          const perp = new Vector2(-dirToPlayer.y * this.aiStrafeSign, dirToPlayer.x * this.aiStrafeSign);
          this._performHenkaSidestep(ai, player, perp);
        } else if (player.stunTimer <= 0 && Math.random() < 0.38) {
          this._performSlap(ai, player);
        } else if (ai.stamina >= 18) {
          this._performShove(ai, player);
        }
      } else if (dist < 120 && ai.stamina > 35 && Math.random() < 0.45) {
        this._performShove(ai, player);
      }
    }
  }

  _updateWrestlerPhysics(w, dt) {
    if (w.stunTimer > 0) w.stunTimer = Math.max(0, w.stunTimer - dt);
    if (w.shoveTimer > 0) w.shoveTimer = Math.max(0, w.shoveTimer - dt);
    if (w.slapTimer > 0) w.slapTimer = Math.max(0, w.slapTimer - dt);
    if (w.henkaTimer > 0) w.henkaTimer = Math.max(0, w.henkaTimer - dt);
    if (w.cooldown > 0) w.cooldown = Math.max(0, w.cooldown - dt);

    // Friction-drag coefficient that decreases as stamina depletes:
    // Tired Rikishi lose foot traction on the clay Dohyo and slide much further!
    const drag = this.baseDrag * (0.45 + 0.55 * (w.stamina / 100));
    const damping = Math.exp(-drag * dt);
    w.vel.scale(damping);

    w.pos.addScaled(w.vel, dt);

    // Center-of-mass vector shifts dynamically with velocity lean and balance state
    const leanFactor = 0.045 * (1.25 - 0.5 * (w.balance / 100));
    w.centerOfMass.set(
      w.pos.x + w.vel.x * leanFactor,
      w.pos.y + w.vel.y * leanFactor
    );

    // Passive stamina and balance recovery when not stunned
    if (w.stunTimer <= 0) {
      w.stamina = Math.min(100, w.stamina + 13.5 * dt);
      w.balance = Math.min(100, w.balance + 18.0 * dt);
    }
  }

  _resolveGrappleCollision(dt) {
    const p = this.player;
    const o = this.opponent;

    // During Henka evasion window, wrestlers slip past each other tangentially
    if (p.henkaTimer > 0 || o.henkaTimer > 0) return;

    const delta = Vector2.sub(o.pos, p.pos);
    const dist = delta.len();
    const minDist = p.radius + o.radius;

    if (dist < minDist && dist > 0.0001) {
      const normal = delta.clone().scale(1 / dist);
      const overlap = minDist - dist;

      const totalMass = p.mass + o.mass;
      p.pos.addScaled(normal, -overlap * (o.mass / totalMass));
      o.pos.addScaled(normal, overlap * (p.mass / totalMass));

      // Relative velocity along collision normal
      const relVel = Vector2.sub(p.vel, o.vel);
      const sepSpeed = relVel.dot(normal);
      if (sepSpeed > 0) {
        const restitution = 0.55;
        const j = ((1 + restitution) * sepSpeed) / (1 / p.mass + 1 / o.mass);
        const impulseVec = normal.clone().scale(j);

        p.vel.addScaled(impulseVec, -1 / p.mass);
        o.vel.addScaled(impulseVec, 1 / o.mass);

        // Yorikiri belt-grapple push drain
        p.stamina = Math.max(0, p.stamina - 4 * dt);
        o.stamina = Math.max(0, o.stamina - 4 * dt);

        if (sepSpeed > 95) {
          const mid = Vector2.lerp(p.pos, o.pos, 0.5);
          this._spawnParticles(mid.x, mid.y, PALETTE.WHITE, 6);
          this.audio.playShove();
        }
      }
    }
  }

  _checkRingOut() {
    if (this.boutOutcome) return;

    const playerDist = Vector2.dist(this.player.centerOfMass, this.ringCenter);
    const oppDist = Vector2.dist(this.opponent.centerOfMass, this.ringCenter);

    if (oppDist > this.ringRadius) {
      this.boutOutcome = 'WIN';
      const kimarite = this.opponent.lastHitBy || 'YORIKIRI';
      const roundBonus = Math.floor(500 + this.level * 250 + this.player.stamina * 3);
      this._addScore(roundBonus);
      this.boutBannerText = `KIMARITE: ${kimarite}!`;
      this.kimariteSubtext = `YOU DEFEATED ${this.opponent.name} (+${roundBonus} PTS)`;
      this.boutBannerTimer = 2.1;
      this.renderer.shake(10, 0.3);
      this._spawnShockwave(this.opponent.centerOfMass.x, this.opponent.centerOfMass.y, PALETTE.GOLD, 90);
      this.audio.playStageClear();
    } else if (playerDist > this.ringRadius) {
      this.boutOutcome = 'LOSE';
      const kimarite = this.player.lastHitBy || 'YORIKIRI';
      this.boutBannerText = `RING OUT — ${kimarite}!`;
      this.kimariteSubtext = `${this.opponent.name} WINS THE BOUT`;
      this.boutBannerTimer = 2.0;
      this.renderer.shake(10, 0.3);
      this._spawnShockwave(this.player.centerOfMass.x, this.player.centerOfMass.y, PALETTE.RED, 90);
      this.audio.playHit();
    }
  }

  _addScore(points) {
    this.score += points;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      HighScoreStore.submit(this.id, this.score);
    }
  }

  _spawnShockwave(x, y, color, maxRadius = 60) {
    this.shockwaves.push({
      x,
      y,
      r: 12,
      maxR: maxRadius,
      color,
      life: 0.32,
      maxLife: 0.32
    });
  }

  _spawnParticles(x, y, color, count = 12) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const spd = 40 + Math.random() * 130;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        color,
        size: 2 + Math.floor(Math.random() * 3),
        life: 0.3 + Math.random() * 0.2,
        maxLife: 0.5
      });
    }
  }

  _updateEffects(dt) {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.life -= dt;
      s.r = s.maxR * (1 - s.life / s.maxLife);
      if (s.life <= 0) this.shockwaves.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const a = this.afterimages[i];
      a.life -= dt;
      if (a.life <= 0) this.afterimages.splice(i, 1);
    }
  }

  render(ctx = this.renderer.ctx) {
    this.renderer.clear(PALETTE.BG);

    // 1. Dohyo Ring, Clay Surface, Shikiri-sen lines, and Tawara straw bales
    this._drawDohyoRing(ctx);

    // 2. Dynamic Ring-Edge Tension Visuals when either Rikishi approaches boundary (>72% radius)
    this._drawRingEdgeTension(ctx, this.player);
    this._drawRingEdgeTension(ctx, this.opponent);

    // 3. Henka afterimages & Shockwaves
    this._drawEffects(ctx);

    // 4. Both Rikishi (Wrestlers) + Stun stars + Center-of-Mass indicators
    this._drawWrestler(ctx, this.opponent);
    this._drawWrestler(ctx, this.player);

    // 5. Side Stamina, Balance & Action HUD panels
    this._drawCombatPanels(ctx);

    // 6. Gyoji referee call / Kimarite banner
    if (this.boutBannerTimer > 0) {
      this._drawBoutBanner(ctx);
    }

    // 7. Standard Top Arcade HUD
    const rank = this._getCurrentRank();
    this.renderer.drawHUD({
      title: 'SUMO ARCADE',
      score: this.score,
      highScore: this.highScore,
      lives: this.lives,
      level: this.level,
      extraLabel: rank.name,
      accent: PALETTE.GOLD
    });

    this.renderer.drawStateOverlay(this.state, {
      title: 'SUMO ARCADE',
      subtitle: 'DOHYO MOMENTUM, STAMINA DRAG & KIMARITE COMBAT',
      controls: 'ARROWS/WASD: GRAPPLE  |  Z/SPACE: SHOVE  |  X: SLAP (STUN)  |  PERP+X: HENKA SIDESTEP',
      score: this.score,
      highScore: this.highScore,
      accent: PALETTE.GOLD
    });
  }

  _drawDohyoRing(ctx) {
    const cx = this.ringCenter.x;
    const cy = this.ringCenter.y;
    const r = this.ringRadius;

    ctx.save();

    // Outer square clay mound (Dohyo platform) with bevel border
    ctx.fillStyle = '#241B15';
    ctx.strokeStyle = '#5C4332';
    ctx.lineWidth = 4;
    ctx.fillRect(cx - r - 44, cy - r - 32, (r + 44) * 2, (r + 32) * 2);
    ctx.strokeRect(cx - r - 44, cy - r - 32, (r + 44) * 2, (r + 32) * 2);

    // 4 Ceremonial Tsuri-yane corner tassel markers (Ao-dusa, Aka-dusa, Shiro-dusa, Kuro-dusa)
    const corners = [
      { x: cx + r + 28, y: cy - r - 18, color: '#38BDF8' }, // NE Blue
      { x: cx + r + 28, y: cy + r + 18, color: '#EF4444' }, // SE Red
      { x: cx - r - 28, y: cy + r + 18, color: '#F8FAFC' }, // SW White
      { x: cx - r - 28, y: cy - r - 18, color: '#FACC15' }  // NW Gold/Black
    ];
    for (const c of corners) {
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Janome-no-suna (swept sand ring outside the Tawara bales)
    ctx.strokeStyle = '#6B513E';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 9, 0, Math.PI * 2);
    ctx.stroke();

    // Packed Arakida clay circle
    const grad = ctx.createRadialGradient(cx, cy, 18, cx, cy, r);
    grad.addColorStop(0, '#594233');
    grad.addColorStop(0.72, '#3E2E23');
    grad.addColorStop(1, '#291E17');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Subtle concentric broom-swept clay texture rings
    ctx.strokeStyle = 'rgba(254, 215, 170, 0.08)';
    ctx.lineWidth = 1;
    for (let rr = 45; rr < r - 10; rr += 36) {
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ceremonial salt scatter (Shio) crystals on East & West approaches
    ctx.fillStyle = 'rgba(248, 250, 252, 0.65)';
    for (let i = 0; i < 28; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const sx = cx + side * (86 + ((i * 19) % 72));
      const sy = cy + (((i * 37) % 84) - 42);
      ctx.fillRect(sx, sy, 2, 2);
    }

    // Danger zone 72% threshold ring (subtle tactical guide)
    ctx.strokeStyle = 'rgba(255, 136, 0, 0.18)';
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Authentic White Shikiri-sen starting lines in the center of the Dohyo
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#7C2D12';
    ctx.lineWidth = 1.5;
    ctx.fillRect(cx - 59, cy - 36, 6, 72);
    ctx.strokeRect(cx - 59, cy - 36, 6, 72);
    ctx.fillRect(cx + 53, cy - 36, 6, 72);
    ctx.strokeRect(cx + 53, cy - 36, 6, 72);

    // Tawara straw bales around the Dohyo perimeter with woven bindings
    for (let i = 0; i < this.tawaraCount; i++) {
      const a = (Math.PI * 2 * i) / this.tawaraCount;
      // N/S/E/W Toku-dawara bales sit slightly recessed outward for drainage/stepping
      const isToku = i % (this.tawaraCount / 4) === 0;
      const baleR = isToku ? r + 5 : r;
      const bx = cx + Math.cos(a) * baleR;
      const by = cy + Math.sin(a) * baleR;

      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(a + Math.PI / 2);

      // Straw bale cylinder
      ctx.fillStyle = i % 2 === 0 ? '#D97706' : '#F59E0B';
      ctx.fillRect(-12, -5.5, 24, 11);
      // Highlight stripe along top of straw bale
      ctx.fillStyle = '#FDE68A';
      ctx.fillRect(-11, -3.5, 22, 2.5);
      // Dark woven straw rope bindings
      ctx.fillStyle = '#78350F';
      ctx.fillRect(-7, -5.5, 2, 11);
      ctx.fillRect(-1, -5.5, 2, 11);
      ctx.fillRect(5, -5.5, 2, 11);

      ctx.strokeStyle = '#451A03';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-12, -5.5, 24, 11);
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Renders the Ring-Edge Tension Visual whenever a wrestler's center of mass exceeds 72% radius
   */
  _drawRingEdgeTension(ctx, wrestler) {
    const com = wrestler.centerOfMass;
    const toEdge = Vector2.sub(com, this.ringCenter);
    const dist = toEdge.len();
    const threshold = this.ringRadius * 0.72;

    if (dist <= threshold) return;

    const tension = Math.min(1, (dist - threshold) / (this.ringRadius - threshold));
    const angle = toEdge.angle();
    const arcSpan = 0.35 + tension * 0.45;
    const pulse = 0.65 + 0.35 * Math.sin(this.animTime * (14 + tension * 12));
    const dangerColor = wrestler.isPlayer ? PALETTE.RED : PALETTE.GOLD;

    ctx.save();

    // 1. Pulsing neon danger arc along the nearest Tawara straw bale boundary
    ctx.strokeStyle = dangerColor;
    ctx.lineWidth = 4 + tension * 5;
    ctx.shadowColor = dangerColor;
    ctx.shadowBlur = 14 + tension * 12;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(this.ringCenter.x, this.ringCenter.y, this.ringRadius + 6, angle - arcSpan, angle + arcSpan);
    ctx.stroke();

    // 2. Radial tension force vector & chevrons between wrestler COM and ring boundary
    const edgePt = Vector2.fromAngle(angle, this.ringRadius).add(this.ringCenter);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(com.x, com.y);
    ctx.lineTo(edgePt.x, edgePt.y);
    ctx.stroke();

    // 3. Screen-edge heartbeat vignette if player is in critical ring-out danger
    if (wrestler.isPlayer && tension > 0.35) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(255, 42, 85, ${(tension * 0.45 * pulse).toFixed(3)})`;
      ctx.lineWidth = 12;
      ctx.strokeRect(6, 44, this.width - 12, this.height - 50);

      this.renderer.drawText('DANGER: TAWARA EDGE!', this.ringCenter.x, 522, {
        font: FONTS.HEADER,
        size: 11,
        color: PALETTE.RED,
        align: 'center',
        glow: 10
      });
    }

    ctx.restore();
  }

  _drawWrestler(ctx, w) {
    const x = w.pos.x;
    const y = w.pos.y;
    const r = w.radius;
    const angle = w.facing.angle();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Lunge / Slap visual extension
    const armReach = w.shoveTimer > 0 ? 12 : w.slapTimer > 0 ? 15 : 4;

    // Outstretched grappling arms & taped wrists
    ctx.fillStyle = '#FDBA74';
    ctx.strokeStyle = '#7C2D12';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(8 + armReach, -r * 0.68, 9, 0, Math.PI * 2);
    ctx.arc(8 + armReach, r * 0.68, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // White wrist tape bands
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(4 + armReach, -r * 0.68 - 4, 4, 8);
    ctx.fillRect(4 + armReach, r * 0.68 - 4, 4, 8);

    // Rikishi muscular torso & back shoulders
    ctx.fillStyle = '#FED7AA';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#9A3412';
    ctx.stroke();

    // Ceremonial silk Mawashi belt with rear knot & front Sagari fringes
    ctx.fillStyle = w.mawashiColor;
    ctx.shadowColor = w.mawashiColor;
    ctx.shadowBlur = 8;
    ctx.fillRect(-11, -r + 2, 15, (r - 2) * 2);
    ctx.shadowBlur = 0;

    // Mawashi folded silk seams & rear bow knot
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(-11, -r + 2, 15, (r - 2) * 2);
    ctx.fillStyle = w.mawashiColor;
    ctx.fillRect(-16, -8, 6, 16);
    ctx.strokeRect(-16, -8, 6, 16);

    // Front Sagari fringes along belt edge
    ctx.fillStyle = PALETTE.GOLD;
    for (let sy = -r + 6; sy <= r - 8; sy += 7) {
      ctx.fillRect(4, sy, 4, 2.5);
    }

    // Detailed Chonmage topknot (dark hair crown + Oicho-mage ginkgo fan + white paper tie)
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.arc(-1, 0, 11.5, 0, Math.PI * 2);
    ctx.fill();

    // Oicho-mage fan-shaped topknot tail folded forward
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.moveTo(-6, -2);
    ctx.lineTo(6, -5.5);
    ctx.lineTo(6, 5.5);
    ctx.lineTo(-6, 2);
    ctx.closePath();
    ctx.fill();

    // White motoyui paper cord binding
    ctx.fillStyle = PALETTE.WHITE;
    ctx.fillRect(-2, -3, 4, 6);

    ctx.restore();

    // Center-of-Mass (COM) vector crosshair marker
    ctx.save();
    ctx.fillStyle = w.mawashiColor;
    ctx.beginPath();
    ctx.arc(w.centerOfMass.x, w.centerOfMass.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // Orbiting stun stars when hit by Tsuppari Slap
    if (w.stunTimer > 0) {
      for (let i = 0; i < 4; i++) {
        const sa = this.animTime * 9 + (Math.PI * 2 * i) / 4;
        const sx = x + Math.cos(sa) * (r + 8);
        const sy = y + Math.sin(sa) * (r + 8);
        ctx.fillStyle = PALETTE.GOLD;
        ctx.shadowColor = PALETTE.GOLD;
        ctx.shadowBlur = 8;
        ctx.fillRect(sx - 3, sy - 3, 6, 6);
      }
      this.renderer.drawText('STUNNED!', x, y - r - 12, {
        font: FONTS.HEADER,
        size: 8,
        color: PALETTE.GOLD,
        align: 'center',
        glow: 6
      });
    }

    ctx.restore();
  }

  _drawEffects(ctx) {
    ctx.save();
    for (const a of this.afterimages) {
      ctx.globalAlpha = (a.life / a.maxLife) * 0.45;
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (const s of this.shockwaves) {
      ctx.globalAlpha = Math.max(0, s.life / s.maxLife);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.restore();
  }

  _drawCombatPanels(ctx) {
    const rank = this._getCurrentRank();

    // Left Panel: Player (1P) telemetry
    this._drawRikishiCard(ctx, {
      x: 22,
      y: 66,
      wrestler: this.player,
      subtitle: 'CHALLENGER',
      accent: PALETTE.CYAN
    });

    // Right Panel: AI Opponent telemetry
    this._drawRikishiCard(ctx, {
      x: 742,
      y: 66,
      wrestler: this.opponent,
      subtitle: rank.name,
      accent: rank.mawashi
    });

    // Bottom combat technique legend
    ctx.save();
    ctx.fillStyle = 'rgba(19, 27, 46, 0.88)';
    ctx.fillRect(22, 430, 196, 92);
    ctx.strokeStyle = PALETTE.CYAN;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(22, 430, 196, 92);

    this.renderer.drawText('KIMARITE MOVES', 34, 450, {
      font: FONTS.HEADER,
      size: 9,
      color: PALETTE.GOLD
    });
    this.renderer.drawText('[Z/SPACE] SHOVE PUSH', 34, 472, {
      font: FONTS.HUD,
      size: 12,
      color: PALETTE.WHITE
    });
    this.renderer.drawText('[X] TSUPPARI SLAP (STUN)', 34, 491, {
      font: FONTS.HUD,
      size: 12,
      color: PALETTE.PINK
    });
    this.renderer.drawText('[DIR+X] HENKA SIDESTEP', 34, 510, {
      font: FONTS.HUD,
      size: 12,
      color: PALETTE.CYAN
    });
    ctx.restore();
  }

  _drawRikishiCard(ctx, { x, y, wrestler, subtitle, accent }) {
    const w = 196;
    const h = 168;
    const dragPct = Math.round((0.45 + 0.55 * (wrestler.stamina / 100)) * 100);
    const edgePct = Math.min(
      100,
      Math.round((Vector2.dist(wrestler.centerOfMass, this.ringCenter) / this.ringRadius) * 100)
    );

    ctx.save();
    ctx.fillStyle = 'rgba(19, 27, 46, 0.9)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    this.renderer.drawText(wrestler.name, x + 12, y + 24, {
      font: FONTS.HEADER,
      size: 10,
      color: accent,
      glow: 6
    });
    this.renderer.drawText(subtitle, x + 12, y + 42, {
      font: FONTS.HUD,
      size: 12,
      color: PALETTE.MUTED
    });

    // Stamina Bar
    this.renderer.drawText(`STAMINA (${Math.round(wrestler.stamina)}%)`, x + 12, y + 66, {
      font: FONTS.HUD,
      size: 11,
      color: PALETTE.WHITE
    });
    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(x + 12, y + 72, w - 24, 12);
    ctx.fillStyle = wrestler.stamina < 30 ? PALETTE.RED : PALETTE.GREEN;
    ctx.fillRect(x + 12, y + 72, ((w - 24) * wrestler.stamina) / 100, 12);

    // Balance / Foot Traction Bar
    this.renderer.drawText(`FOOT GRIP: ${dragPct}%`, x + 12, y + 106, {
      font: FONTS.HUD,
      size: 11,
      color: PALETTE.WHITE
    });
    ctx.fillStyle = '#0B0F19';
    ctx.fillRect(x + 12, y + 112, w - 24, 10);
    ctx.fillStyle = PALETTE.GOLD;
    ctx.fillRect(x + 12, y + 112, ((w - 24) * wrestler.balance) / 100, 10);

    // Ring-Edge Proximity Readout
    this.renderer.drawText(`RING EDGE: ${edgePct}%`, x + 12, y + 148, {
      font: FONTS.HUD,
      size: 12,
      color: edgePct >= 72 ? PALETTE.RED : PALETTE.CYAN
    });

    ctx.restore();
  }

  _drawBoutBanner(ctx) {
    ctx.save();
    const bx = 250;
    const by = 64;
    const bw = 460;
    const bh = 58;

    ctx.fillStyle = 'rgba(11, 15, 25, 0.92)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = PALETTE.GOLD;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    this.renderer.drawText(this.boutBannerText, this.width / 2, by + 26, {
      font: FONTS.HEADER,
      size: 13,
      color: PALETTE.GOLD,
      align: 'center',
      glow: 10
    });
    this.renderer.drawText(this.kimariteSubtext, this.width / 2, by + 46, {
      font: FONTS.HUD,
      size: 13,
      color: PALETTE.WHITE,
      align: 'center'
    });
    ctx.restore();
  }

  destroy() {
    this.shockwaves = [];
    this.particles = [];
    this.afterimages = [];
  }
}

export default Sumo;

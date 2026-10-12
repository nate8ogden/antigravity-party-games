export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  shape: 'circle' | 'square' | 'ring' | 'spark';
}

export interface FloatingText {
  text: string;
  x: number;
  y: number;
  vy: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  fontSize: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private floatingTexts: FloatingText[] = [];
  private trauma: number = 0; // 0 to 1 for screen shake
  private traumaDecay: number = 2.5;

  public shakeIntensity: number = 1.0; // 1.0 = Full, 0.5 = Reduced, 0 = Off
  public particleDensity: number = 1.0; // 1.0 = High, 0.5 = Low, 0 = Off

  public update(dt: number) {
    // Screen shake decay
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - this.traumaDecay * dt);
    }

    // High-performance in-place particle array compaction (0 allocations, no splice shifts)
    let aliveParticles = 0;
    const pLen = this.particles.length;
    for (let i = 0; i < pLen; i++) {
      const p = this.particles[i];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= dt;
      p.alpha = Math.max(0, p.life / p.maxLife);
      if (p.life > 0) {
        this.particles[aliveParticles++] = p;
      }
    }
    this.particles.length = aliveParticles;

    // In-place floating text compaction
    let aliveTexts = 0;
    const tLen = this.floatingTexts.length;
    for (let i = 0; i < tLen; i++) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt * 60;
      ft.life -= dt;
      ft.alpha = Math.max(0, ft.life / ft.maxLife);
      if (ft.life > 0) {
        this.floatingTexts[aliveTexts++] = ft;
      }
    }
    this.floatingTexts.length = aliveTexts;
  }

  public render(ctx: CanvasRenderingContext2D) {
    if (this.particles.length === 0 && this.floatingTexts.length === 0) return;
    ctx.save();
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = p.color;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'square') {
        ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
      } else if (p.shape === 'ring') {
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const currentRadius = p.size * (1 + (1 - p.alpha) * 2);
        ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.shape === 'spark') {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2);
        ctx.stroke();
      }
    }

    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = ft.alpha;
      ctx.font = `900 ${ft.fontSize}px 'Montserrat', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Outline
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, ft.x, ft.y);

      // Fill
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.restore();
  }

  public addTrauma(amount: number) {
    this.trauma = Math.min(1.0, this.trauma + amount);
    if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(Math.min(50, Math.floor(amount * 50)));
      } catch {
        // ignore vibrate permissions if restricted
      }
    }
  }

  public getShakeOffset(): { x: number; y: number } {
    if (this.trauma <= 0.01 || this.shakeIntensity <= 0) return { x: 0, y: 0 };
    const maxOffset = 18 * (this.trauma * this.trauma) * this.shakeIntensity;
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.cos(angle) * maxOffset,
      y: Math.sin(angle) * maxOffset
    };
  }

  public spawnExplosion(x: number, y: number, color: string, count = 28) {
    this.addTrauma(0.4);
    // Shockwave ring
    this.addParticleSafely({
      x,
      y,
      vx: 0,
      vy: 0,
      size: 16,
      color,
      alpha: 1,
      life: 0.35,
      maxLife: 0.35,
      shape: 'ring'
    });

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5);
      const speed = 2.5 + Math.random() * 6.5;
      const palette = [color, '#FFFFFF', '#FFAA00', '#FF3300'];
      const pColor = palette[Math.floor(Math.random() * palette.length)];

      this.addParticleSafely({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 5,
        color: pColor,
        alpha: 1,
        life: 0.3 + Math.random() * 0.45,
        maxLife: 0.75,
        shape: Math.random() > 0.5 ? 'circle' : 'spark'
      });
    }
  }

  public spawnSparks(x: number, y: number, color: string, count = 10) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 4;
      this.addParticleSafely({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color,
        alpha: 1,
        life: 0.2 + Math.random() * 0.3,
        maxLife: 0.5,
        shape: 'spark'
      });
    }
  }

  public spawnSmoke(x: number, y: number, color = 'rgba(200,200,200,0.6)') {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random() * 1.5;
    this.addParticleSafely({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 4 + Math.random() * 6,
      color,
      alpha: 0.8,
      life: 0.25 + Math.random() * 0.25,
      maxLife: 0.5,
      shape: 'circle'
    });
  }

  public showFloatingText(text: string, x: number, y: number, color = '#FFF', fontSize = 24) {
    this.floatingTexts.push({
      text,
      x,
      y,
      vy: -1.8,
      color,
      alpha: 1,
      life: 0.8,
      maxLife: 0.8,
      fontSize
    });
  }

  public shake(amount = 0.4) {
    this.addTrauma(amount);
  }

  public emit(x: number, y: number, count = 10, color = '#FFFFFF') {
    this.spawnSparks(x, y, color, count);
  }

  public spawnImpactShockwave(x: number, y: number, color = '#FFFFFF', radius = 24) {
    this.addParticleSafely({
      x,
      y,
      vx: 0,
      vy: 0,
      size: radius,
      color,
      alpha: 1.0,
      life: 0.32,
      maxLife: 0.32,
      shape: 'ring'
    });
  }

  public spawnGoBlast(x: number, y: number) {
    this.addTrauma(0.28);
    // Expanding rings
    this.addParticleSafely({
      x,
      y,
      vx: 0,
      vy: 0,
      size: 20,
      color: '#38BDF8',
      alpha: 1,
      life: 0.45,
      maxLife: 0.45,
      shape: 'ring'
    });
    this.addParticleSafely({
      x,
      y,
      vx: 0,
      vy: 0,
      size: 32,
      color: '#F59E0B',
      alpha: 1,
      life: 0.55,
      maxLife: 0.55,
      shape: 'ring'
    });

    const colors = ['#38BDF8', '#F59E0B', '#10B981', '#EC4899', '#FFFFFF'];
    for (let i = 0; i < 40; i++) {
      const angle = (Math.PI * 2 * i) / 40 + (Math.random() - 0.5) * 0.4;
      const speed = 3.5 + Math.random() * 6.5;
      this.addParticleSafely({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + Math.random() * 4,
        color: colors[i % colors.length],
        alpha: 1,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        shape: i % 2 === 0 ? 'spark' : 'circle'
      });
    }
  }

  public spawnConfetti(x: number, y: number, count = 25) {
    const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const speed = 2.0 + Math.random() * 5.0;
      this.addParticleSafely({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        size: 3 + Math.random() * 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
        shape: 'square'
      });
    }
  }

  public spawnWinnerCelebration(x: number, y: number, color: string) {
    this.addTrauma(0.25);
    // Floating "+1 POINT!" text
    this.showFloatingText('+1 POINT!', x, y - 25, color, 24);

    // Tumbling colorful confetti burst
    const colors = [color, '#FFFFFF', '#F59E0B', '#3B82F6', '#10B981', '#EC4899'];
    for (let i = 0; i < 35; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const speed = 3.0 + Math.random() * 6.5;
      this.addParticleSafely({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2.0,
        size: 3.5 + Math.random() * 4.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1.0,
        life: 0.8 + Math.random() * 0.6,
        maxLife: 1.4,
        shape: 'square'
      });
    }
  }

  public spawnDust(x: number, y: number, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      this.addParticleSafely({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color: 'rgba(203, 213, 225, 0.7)',
        alpha: 0.7,
        life: 0.2 + Math.random() * 0.25,
        maxLife: 0.45,
        shape: 'circle'
      });
    }
  }

  private addParticleSafely(p: Particle) {
    if (this.particles.length >= 320) {
      this.particles.splice(0, 32); // Batch drop 32 oldest particles at once (32x fewer memory shifts)
    }
    this.particles.push(p);
  }

  public clear() {
    this.particles = [];
    this.floatingTexts = [];
    this.trauma = 0;
  }
}

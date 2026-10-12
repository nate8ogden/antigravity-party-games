import { EconomyManager } from './EconomyManager';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  rewardCoins: number;
  category: 'victory' | 'skill' | 'collection' | 'tournament';
  iconGlyph: string; // procedural badge indicator
}

export interface AchievementToast {
  id: string;
  title: string;
  description: string;
  rewardCoins: number;
  timer: number;
  maxTimer: number;
  alpha: number;
  yOffset: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_win',
    title: 'First Taste of Victory',
    description: 'Win your first minigame round.',
    rewardCoins: 25,
    category: 'victory',
    iconGlyph: 'WIN'
  },
  {
    id: 'tournament_champion',
    title: 'Crown of Kings',
    description: 'Win a full Tournament Cup championship.',
    rewardCoins: 50,
    category: 'tournament',
    iconGlyph: 'CUP'
  },
  {
    id: 'skin_collector',
    title: 'Fashion Forward',
    description: 'Unlock your first custom mascot skin in the shop.',
    rewardCoins: 30,
    category: 'collection',
    iconGlyph: 'SKIN'
  },
  {
    id: 'coin_hoarder',
    title: 'Treasure Vault',
    description: 'Amass 100 or more in-game Coins.',
    rewardCoins: 40,
    category: 'collection',
    iconGlyph: 'GOLD'
  },
  {
    id: 'party_veteran',
    title: 'Party Veteran',
    description: 'Play 10 minigame matches in a single session.',
    rewardCoins: 45,
    category: 'victory',
    iconGlyph: 'STAR'
  },
  {
    id: 'multi_skin',
    title: 'Wardrobe Stylist',
    description: 'Unlock 3 distinct custom skins in the shop.',
    rewardCoins: 60,
    category: 'collection',
    iconGlyph: 'LOCK'
  },
  {
    id: 'hard_bot_slayer',
    title: 'Robot Conqueror',
    description: 'Defeat a Hard AI bot in single-player combat.',
    rewardCoins: 50,
    category: 'skill',
    iconGlyph: 'BOT'
  },
  {
    id: 'sumo_master',
    title: 'Rooftop Sovereign',
    description: 'Ring out opponents in Skyline Sumo.',
    rewardCoins: 35,
    category: 'skill',
    iconGlyph: 'SUMO'
  },
  {
    id: 'blade_legend',
    title: 'Parry Master',
    description: 'Successfully clash and parry in Blade Parry.',
    rewardCoins: 40,
    category: 'skill',
    iconGlyph: 'PARRY'
  },
  {
    id: 'speed_demon',
    title: 'Speed Demon',
    description: 'Hit turbo velocity in Micro Turbo GP.',
    rewardCoins: 30,
    category: 'skill',
    iconGlyph: 'TURBO'
  },
  {
    id: 'tank_sniper',
    title: 'Laser Ace',
    description: 'Score a laser ricochet strike in Cyber Tanks.',
    rewardCoins: 35,
    category: 'skill',
    iconGlyph: 'TANK'
  },
  {
    id: 'perfectionist',
    title: 'Flawless Champion',
    description: 'Reach a 3-0 clean sweep in a Tournament Cup.',
    rewardCoins: 100,
    category: 'tournament',
    iconGlyph: 'CROWN'
  }
];

export class AchievementManager {
  private static instance: AchievementManager | null = null;
  private unlockedIds: Set<string> = new Set();
  private toasts: AchievementToast[] = [];
  private matchesPlayedSession: number = 0;
  private listeners: ((unlockedCount: number) => void)[] = [];

  constructor() {
    this.load();
  }

  public static getInstance(): AchievementManager {
    if (!AchievementManager.instance) {
      AchievementManager.instance = new AchievementManager();
    }
    return AchievementManager.instance;
  }

  public addListener(fn: (unlockedCount: number) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notifyListeners(): void {
    const count = this.unlockedIds.size;
    this.listeners.forEach((fn) => {
      try {
        fn(count);
      } catch (_) {}
    });
  }

  public getUnlockedList(): string[] {
    return Array.from(this.unlockedIds);
  }

  public resetForTesting(): void {
    this.unlockedIds.clear();
    this.toasts = [];
    this.matchesPlayedSession = 0;
    this.save();
    this.notifyListeners();
  }

  private load(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      const saved = localStorage.getItem('antigravity_achievements');
      if (saved) {
        const list = JSON.parse(saved);
        if (Array.isArray(list)) {
          list.forEach((id) => this.unlockedIds.add(id));
        }
      }
    } catch (_) {
      // Fallback
    }
  }

  private save(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return;
      localStorage.setItem('antigravity_achievements', JSON.stringify(Array.from(this.unlockedIds)));
    } catch (_) {
      // Ignore
    }
  }

  public isUnlocked(id: string): boolean {
    return this.unlockedIds.has(id);
  }

  public getUnlockedCount(): number {
    return this.unlockedIds.size;
  }

  public getTotalCount(): number {
    return ACHIEVEMENTS.length;
  }

  public recordMatchPlayed(): void {
    this.matchesPlayedSession++;
    if (this.matchesPlayedSession >= 10) {
      this.unlock('party_veteran');
    }
  }

  public checkCoinMilestones(coins: number): void {
    if (coins >= 100) {
      this.unlock('coin_hoarder');
    }
  }

  public checkSkinMilestones(unlockedCount: number): void {
    if (unlockedCount >= 2) { // 1 beyond classic
      this.unlock('skin_collector');
    }
    if (unlockedCount >= 4) { // 3 beyond classic
      this.unlock('multi_skin');
    }
  }

  public unlock(id: string): boolean {
    if (this.unlockedIds.has(id)) return false;
    const ach = ACHIEVEMENTS.find((a) => a.id === id);
    if (!ach) return false;

    this.unlockedIds.add(id);
    this.save();
    this.notifyListeners();

    // Reward bounty coins through EconomyManager
    EconomyManager.getInstance().addCoins(ach.rewardCoins);

    // Queue celebratory toast
    this.toasts.push({
      id: ach.id,
      title: ach.title,
      description: ach.description,
      rewardCoins: ach.rewardCoins,
      timer: 3.8,
      maxTimer: 3.8,
      alpha: 0,
      yOffset: -30
    });

    return true;
  }

  public update(dt: number): void {
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      t.timer -= dt;

      // Entrance animation (spring down)
      const progress = 1 - t.timer / t.maxTimer;
      if (progress < 0.15) {
        t.alpha = progress / 0.15;
        t.yOffset = -30 * (1 - t.alpha);
      } else if (t.timer < 0.4) {
        // Exit animation (fade out up)
        t.alpha = Math.max(0, t.timer / 0.4);
        t.yOffset = -15 * (1 - t.alpha);
      } else {
        t.alpha = 1.0;
        t.yOffset = 0;
      }

      if (t.timer <= 0) {
        this.toasts.splice(i, 1);
      }
    }
  }

  public renderToasts(ctx: CanvasRenderingContext2D, w: number, _h: number): void {
    if (this.toasts.length === 0) return;

    ctx.save();
    let curY = 68;
    for (const t of this.toasts) {
      const toastW = 340;
      const toastH = 54;
      const toastX = w / 2 - toastW / 2;
      const toastY = curY + t.yOffset;

      ctx.globalAlpha = t.alpha;

      // 3D Toast Card Shadow & Body
      ctx.shadowColor = 'rgba(245, 158, 11, 0.4)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 4;

      // Bevel
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(toastX, toastY + 3, toastW, toastH, 12);
      else ctx.rect(toastX, toastY + 3, toastW, toastH);
      ctx.fillStyle = '#B45309';
      ctx.fill();

      // Card Face
      const grad = ctx.createLinearGradient(toastX, toastY, toastX, toastY + toastH);
      grad.addColorStop(0, '#FFFBEB');
      grad.addColorStop(1, '#FEF3C7');
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(toastX, toastY, toastW, toastH, 12);
      else ctx.rect(toastX, toastY, toastW, toastH);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Golden Trophy Emblem
      const iconCenterX = toastX + 28;
      const iconCenterY = toastY + toastH / 2;
      ctx.beginPath();
      ctx.arc(iconCenterX, iconCenterY, 15, 0, Math.PI * 2);
      ctx.fillStyle = '#F59E0B';
      ctx.fill();
      ctx.strokeStyle = '#FEF3C7';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Mini cup polygon
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(iconCenterX - 6, iconCenterY - 7);
      ctx.lineTo(iconCenterX + 6, iconCenterY - 7);
      ctx.lineTo(iconCenterX + 4, iconCenterY + 1);
      ctx.lineTo(iconCenterX - 4, iconCenterY + 1);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(iconCenterX - 1.5, iconCenterY + 1, 3, 4);
      ctx.fillRect(iconCenterX - 5, iconCenterY + 5, 10, 2);

      // Toast Text
      ctx.fillStyle = '#B45309';
      ctx.font = '900 10px Montserrat, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('🏆 TROPHY UNLOCKED!', toastX + 52, toastY + 19);

      ctx.fillStyle = '#0F172A';
      ctx.font = '900 13px Montserrat, sans-serif';
      ctx.fillText(t.title, toastX + 52, toastY + 34);

      // Coin Bounty Badge on right
      const coinBadgeX = toastX + toastW - 68;
      const coinBadgeY = toastY + 16;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(coinBadgeX, coinBadgeY, 56, 22, 6);
      else ctx.rect(coinBadgeX, coinBadgeY, 56, 22);
      ctx.fillStyle = '#D97706';
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 10.5px Montserrat, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`+${t.rewardCoins}`, coinBadgeX + 28, coinBadgeY + 15);

      curY += toastH + 10;
    }
    ctx.restore();
  }
}

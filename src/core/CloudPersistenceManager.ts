/**
 * CloudPersistenceManager - Firebase Realtime DB + Local-First Persistence
 *
 * Manages:
 * 1. Game Star Ratings (1 to 5 stars, community + player rating)
 * 2. Saved / Bookmarked Games (❤️ Favorites)
 * 3. High Scores, Win Counts, Fastest Win Times, and Play Counts per Minigame
 * 4. Catalog Ranking & Sorting (Featured, Top Rated, High Scores, Saved, Most Played)
 * 5. Optional Firebase Realtime Database REST Sync (via VITE_FIREBASE_DATABASE_URL or window.__FIREBASE_CONFIG__)
 */

export type CatalogSortMode = 'default' | 'rating' | 'highscore' | 'saved' | 'most_played';

export interface GameStatsRecord {
  gameId: string;
  userRating: number; // 0 = unrated by user, 1-5 = user star rating
  communityRating: number; // 1.0 - 5.0 average
  ratingCount: number;
  saved: boolean; // Bookmarked / Favorited by user
  saveCount: number; // Community saves
  highScore: number; // Personal best score / rating points
  wins: number;
  plays: number;
  fastestWinSec: number | null;
  lastPlayedAt: number;
}

export interface FirebaseConfig {
  databaseURL?: string;
  projectId?: string;
  apiKey?: string;
}

const STORAGE_KEY = 'antigravity_cloud_stats_v1';
const FIREBASE_URL_KEY = 'antigravity_firebase_db_url';

// Deterministic hash for seeding realistic initial community ratings & save counts
function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class CloudPersistenceManager {
  private static instance: CloudPersistenceManager;
  private records: Record<string, GameStatsRecord> = {};
  private firebaseDatabaseUrl: string | null = null;
  public syncStatus: 'local_only' | 'syncing' | 'synced' | 'offline_cached' = 'local_only';
  public lastSyncedAt: number | null = null;

  private constructor() {
    this.detectFirebaseConfig();
    this.loadFromLocal();
    if (this.firebaseDatabaseUrl) {
      this.pullFromFirebase();
    }
    if (typeof window !== 'undefined') {
      (window as unknown as { __CLOUD_PERSISTENCE__: CloudPersistenceManager }).__CLOUD_PERSISTENCE__ = this;
    }
  }

  public static getInstance(): CloudPersistenceManager {
    if (!CloudPersistenceManager.instance) {
      CloudPersistenceManager.instance = new CloudPersistenceManager();
    }
    return CloudPersistenceManager.instance;
  }

  private detectFirebaseConfig(): void {
    try {
      if (typeof window !== 'undefined') {
        const winCfg = (window as unknown as { __FIREBASE_CONFIG__?: FirebaseConfig }).__FIREBASE_CONFIG__;
        const storedUrl = localStorage.getItem(FIREBASE_URL_KEY);
        const envUrl = (import.meta as unknown as { env?: Record<string, string> })?.env?.VITE_FIREBASE_DATABASE_URL;
        const url = winCfg?.databaseURL || storedUrl || envUrl || null;
        if (url && url.startsWith('https://')) {
          this.firebaseDatabaseUrl = url.replace(/\/$/, '');
          this.syncStatus = 'offline_cached';
        }
      }
    } catch {
      // Ignore storage access errors in restricted frames
    }
  }

  public setFirebaseDatabaseUrl(url: string | null): void {
    this.firebaseDatabaseUrl = url ? url.trim().replace(/\/$/, '') : null;
    try {
      if (this.firebaseDatabaseUrl) {
        localStorage.setItem(FIREBASE_URL_KEY, this.firebaseDatabaseUrl);
        this.pullFromFirebase();
      } else {
        localStorage.removeItem(FIREBASE_URL_KEY);
        this.syncStatus = 'local_only';
      }
    } catch {
      // Ignore storage errors
    }
  }

  public getFirebaseDatabaseUrl(): string | null {
    return this.firebaseDatabaseUrl;
  }

  private createDefaultRecord(gameId: string): GameStatsRecord {
    const h = hashString(gameId);
    // Flagship games get 4.8-4.9 baseline; others get deterministic 4.1-4.9 baseline
    const isFlagship =
      gameId === 'skyline_sumo' ||
      gameId === 'sumo_lode_runner' ||
      gameId === 'tanks' ||
      gameId === 'hovercraft' ||
      gameId === 'gold_miner' ||
      gameId === 'sumo_iceberg' ||
      gameId === 'micro_gp' ||
      gameId === 'orbital';
    const baseRating = isFlagship ? 4.8 + (h % 2) * 0.1 : 4.1 + ((h % 85) / 100);
    const ratingCount = isFlagship ? 180 + (h % 140) : 24 + (h % 95);
    const saveCount = Math.round(ratingCount * (0.35 + ((h >> 4) % 30) / 100));

    return {
      gameId,
      userRating: 0,
      communityRating: Number(baseRating.toFixed(1)),
      ratingCount,
      saved: false,
      saveCount,
      highScore: 0,
      wins: 0,
      plays: 0,
      fastestWinSec: null,
      lastPlayedAt: 0
    };
  }

  public initializeCatalog(gameIds: string[]): void {
    for (const id of gameIds) {
      if (!this.records[id]) {
        this.records[id] = this.createDefaultRecord(id);
      }
    }
  }

  public getRecord(gameId: string): GameStatsRecord {
    if (!this.records[gameId]) {
      this.records[gameId] = this.createDefaultRecord(gameId);
    }
    return this.records[gameId];
  }

  public getGameStats(gameId: string): GameStatsRecord {
    return this.getRecord(gameId);
  }

  public getEffectiveRating(gameId: string): number {
    const r = this.getRecord(gameId);
    if (r.userRating > 0) {
      // Blend user rating prominently so player's own rating immediately drives Top Rated ranking
      const blended = r.userRating * 0.92 + r.communityRating * 0.08;
      return Number(blended.toFixed(2));
    }
    return r.communityRating;
  }

  /**
   * Sets a 1-5 star rating for a game and syncs to localStorage + Firebase
   */
  public rateGame(gameId: string, stars: number): GameStatsRecord {
    const clamped = Math.max(1, Math.min(5, Math.round(stars)));
    const rec = this.getRecord(gameId);
    if (rec.userRating === 0) {
      rec.ratingCount += 1;
    }
    rec.userRating = clamped;
    this.saveToLocal();
    this.pushRecordToFirebase(rec);
    return rec;
  }

  public setRating(gameId: string, stars: number): GameStatsRecord {
    return this.rateGame(gameId, stars);
  }

  /**
   * Toggles Saved / Bookmarked state (❤️) for a game
   */
  public toggleSaveGame(gameId: string): boolean {
    const rec = this.getRecord(gameId);
    rec.saved = !rec.saved;
    rec.saveCount = Math.max(0, rec.saveCount + (rec.saved ? 1 : -1));
    this.saveToLocal();
    this.pushRecordToFirebase(rec);
    return rec.saved;
  }

  public toggleSave(gameId: string): boolean {
    return this.toggleSaveGame(gameId);
  }

  /**
   * Records a completed game round, updating high score, play count, wins, and fastest time
   */
  public recordRoundComplete(
    gameId: string,
    scorePoints: number,
    humanWon: boolean,
    elapsedSeconds: number
  ): { isNewHighScore: boolean; record: GameStatsRecord } {
    const rec = this.getRecord(gameId);
    rec.plays += 1;
    rec.lastPlayedAt = Date.now();
    if (humanWon) {
      rec.wins += 1;
      if (elapsedSeconds > 1 && (rec.fastestWinSec === null || elapsedSeconds < rec.fastestWinSec)) {
        rec.fastestWinSec = Number(elapsedSeconds.toFixed(1));
      }
    }

    // Compute arcade performance score (combines points, time bonus, and win bonus)
    const timeBonus = humanWon ? Math.max(10, Math.round(Math.max(0, 60 - elapsedSeconds) * 15)) : 0;
    const computedScore = Math.max(scorePoints, (humanWon ? 1000 : 250) + timeBonus + rec.wins * 50);

    const isNewHighScore = computedScore > rec.highScore;
    if (isNewHighScore) {
      rec.highScore = computedScore;
    }

    this.saveToLocal();
    this.pushRecordToFirebase(rec);
    return { isNewHighScore, record: rec };
  }

  /**
   * Sorts a list of games according to the active CatalogSortMode
   */
  public sortCatalog<T extends { id: string }>(games: T[], mode: CatalogSortMode): T[] {
    if (mode === 'default') return games;

    const copy = [...games];
    if (mode === 'saved') {
      // If user has saved games, filter to saved games; if none saved yet, rank by community saveCount
      const userSaved = copy.filter((g) => this.getRecord(g.id).saved);
      if (userSaved.length > 0) {
        return userSaved;
      }
      return copy.sort((a, b) => this.getRecord(b.id).saveCount - this.getRecord(a.id).saveCount);
    }

    if (mode === 'rating') {
      return copy.sort((a, b) => {
        const diff = this.getEffectiveRating(b.id) - this.getEffectiveRating(a.id);
        if (Math.abs(diff) > 0.001) return diff;
        return this.getRecord(b.id).ratingCount - this.getRecord(a.id).ratingCount;
      });
    }

    if (mode === 'highscore') {
      return copy.sort((a, b) => {
        const ra = this.getRecord(a.id);
        const rb = this.getRecord(b.id);
        if (rb.highScore !== ra.highScore) return rb.highScore - ra.highScore;
        if (rb.wins !== ra.wins) return rb.wins - ra.wins;
        return this.getEffectiveRating(b.id) - this.getEffectiveRating(a.id);
      });
    }

    if (mode === 'most_played') {
      return copy.sort((a, b) => {
        const ra = this.getRecord(a.id);
        const rb = this.getRecord(b.id);
        if (rb.plays !== ra.plays) return rb.plays - ra.plays;
        return rb.saveCount - ra.saveCount;
      });
    }

    return copy;
  }

  public getSavedCount(): number {
    return Object.values(this.records).filter((r) => r.saved).length;
  }

  private loadFromLocal(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.records = parsed;
        }
      }
    } catch {
      // Ignore corrupt local storage
    }
  }

  private saveToLocal(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch {
      // Ignore quota errors
    }
  }

  /**
   * Asynchronous non-blocking Firebase Realtime Database REST pull
   */
  public async pullFromFirebase(): Promise<void> {
    if (!this.firebaseDatabaseUrl || typeof fetch === 'undefined') return;
    try {
      this.syncStatus = 'syncing';
      const res = await fetch(`${this.firebaseDatabaseUrl}/antigravity_cloud/games.json`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      if (!res.ok) {
        this.syncStatus = 'offline_cached';
        return;
      }
      const cloudData = await res.json();
      if (cloudData && typeof cloudData === 'object') {
        for (const [gameId, cloudRec] of Object.entries(cloudData as Record<string, Partial<GameStatsRecord>>)) {
          const local = this.getRecord(gameId);
          if (typeof cloudRec.highScore === 'number' && cloudRec.highScore > local.highScore) {
            local.highScore = cloudRec.highScore;
          }
          if (typeof cloudRec.communityRating === 'number') {
            local.communityRating = cloudRec.communityRating;
          }
          if (typeof cloudRec.ratingCount === 'number' && cloudRec.ratingCount > local.ratingCount) {
            local.ratingCount = cloudRec.ratingCount;
          }
          if (typeof cloudRec.saveCount === 'number' && cloudRec.saveCount > local.saveCount) {
            local.saveCount = cloudRec.saveCount;
          }
        }
        this.saveToLocal();
      }
      this.syncStatus = 'synced';
      this.lastSyncedAt = Date.now();
    } catch {
      this.syncStatus = 'offline_cached';
    }
  }

  /**
   * Asynchronous non-blocking Firebase Realtime Database REST push
   */
  private async pushRecordToFirebase(rec: GameStatsRecord): Promise<void> {
    if (!this.firebaseDatabaseUrl || typeof fetch === 'undefined') return;
    try {
      this.syncStatus = 'syncing';
      const res = await fetch(`${this.firebaseDatabaseUrl}/antigravity_cloud/games/${encodeURIComponent(rec.gameId)}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          communityRating: this.getEffectiveRating(rec.gameId),
          ratingCount: rec.ratingCount,
          saveCount: rec.saveCount,
          highScore: rec.highScore,
          plays: rec.plays,
          updatedAt: Date.now()
        })
      });
      this.syncStatus = res.ok ? 'synced' : 'offline_cached';
      if (res.ok) this.lastSyncedAt = Date.now();
    } catch {
      this.syncStatus = 'offline_cached';
    }
  }
}

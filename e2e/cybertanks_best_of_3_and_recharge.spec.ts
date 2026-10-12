import { test, expect } from '@playwright/test';

test.describe('CyberTanks - Dense Map Obstacles, Best of 3, and Longer Bullet Recharge', () => {
  test('Map has dense obstacles across the entire arena but clear spawn zones', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const mapData = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('tanks');
      gm.state = 'PLAYING';
      const game = gm.activeGame;

      const obstacles = (game as any).obstacles;
      const arena = (game as any).arenaBounds;
      const spawnOffsets = [
        { x: arena.x + 60, y: arena.y + 60 },
        { x: arena.x + arena.w - 60, y: arena.y + 60 },
        { x: arena.x + 60, y: arena.y + arena.h - 60 },
        { x: arena.x + arena.w - 60, y: arena.y + arena.h - 60 }
      ];

      // Check how many obstacles infringe on spawn zones (radius 100px)
      let spawnInfringements = 0;
      for (const sp of spawnOffsets) {
        for (const obs of obstacles) {
          const obsCenterX = obs.x + obs.w / 2;
          const obsCenterY = obs.y + obs.h / 2;
          if (Math.hypot(obsCenterX - sp.x, obsCenterY - sp.y) < 100) {
            spawnInfringements++;
          }
        }
      }

      return {
        obstacleCount: obstacles.length,
        spawnInfringements,
        mapName: (game as any).currentMapName,
        isMultiRound: (game as any).isMultiRound,
        targetWins: (game as any).targetWins
      };
    });

    expect(pageErrors).toEqual([]);
    expect(mapData.obstacleCount).toBeGreaterThanOrEqual(35);
    expect(mapData.spawnInfringements).toBe(0);
    expect(mapData.isMultiRound).toBe(true);
    expect(mapData.targetWins).toBe(2);
  });

  test('Bullet cooldown is 1.2s and blocks spam firing', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const cooldownData = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('tanks');
      gm.state = 'PLAYING';
      const game = gm.activeGame;

      const p1Tank = (game as any).tanks.get(0);
      const initialCooldown = p1Tank.cooldown;

      // Fire a bullet
      (game as any).fireBullet(p1Tank);
      const cooldownAfterFire = p1Tank.cooldown;
      const maxCooldown = p1Tank.maxCooldown;
      const bulletCountAfterFire1 = (game as any).bullets.length;

      // Try firing again immediately (should be blocked by recharge)
      (game as any).fireBullet(p1Tank);
      const bulletCountAfterSpam = (game as any).bullets.length;

      // Advance by 0.5s (still on cooldown)
      p1Tank.cooldown = Math.max(0, p1Tank.cooldown - 0.5);
      const canShootAtHalfSecond = p1Tank.cooldown <= 0;

      // Advance past 1.2s
      p1Tank.cooldown = 0;
      (game as any).fireBullet(p1Tank);
      const bulletCountAfterRecharge = (game as any).bullets.length;

      return {
        initialCooldown,
        cooldownAfterFire,
        maxCooldown,
        bulletCountAfterFire1,
        bulletCountAfterSpam,
        canShootAtHalfSecond,
        bulletCountAfterRecharge
      };
    });

    expect(cooldownData.initialCooldown).toBe(0);
    expect(cooldownData.cooldownAfterFire).toBeCloseTo(1.2, 1);
    expect(cooldownData.maxCooldown).toBeCloseTo(1.2, 1);
    expect(cooldownData.bulletCountAfterFire1).toBe(1);
    expect(cooldownData.bulletCountAfterSpam).toBe(1); // blocked
    expect(cooldownData.canShootAtHalfSecond).toBe(false);
    expect(cooldownData.bulletCountAfterRecharge).toBe(2);
  });

  test('Best of 3 progression: round 1 win advances to round 2, two wins completes match', async ({ page }) => {
    await page.goto('http://localhost:5173/');
    await page.waitForSelector('#game-canvas');
    await page.waitForTimeout(300);

    const roundProgression = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      gm.startGame('tanks');
      gm.state = 'PLAYING';
      const game = gm.activeGame as any;

      // Round 1 start state
      const round1 = game.currentRound;
      const r1P1Wins = game.roundWins.get(0);
      const r1P2Wins = game.roundWins.get(1);

      // Kill P2 tank in round 1
      const p2Tank = game.tanks.get(1);
      p2Tank.alive = false;
      p2Tank.lives = 0;

      // Run update to trigger round over
      game.update(0.1, 980, 600);
      const roundState1 = game.roundState;
      const roundWinner1 = game.roundWinnerId;
      const p1WinsAfterR1 = game.roundWins.get(0);
      const isFinishedAfterR1 = game.isFinished;

      // Advance roundEndTimer to trigger transition to round 2
      game.update(2.5, 980, 600);
      const round2 = game.currentRound;
      const roundState2 = game.roundState;
      const p2TankRound2Alive = game.tanks.get(1).alive;
      const p2TankRound2Lives = game.tanks.get(1).lives;

      // Kill P2 tank in round 2 (giving P1 their 2nd win -> Best of 3 champion)
      const p2TankR2 = game.tanks.get(1);
      p2TankR2.alive = false;
      p2TankR2.lives = 0;
      game.update(0.1, 980, 600);
      const roundWinner2 = game.roundWinnerId;
      const p1WinsAfterR2 = game.roundWins.get(0);

      // Advance roundEndTimer to finish the match
      game.update(2.5, 980, 600);
      const isFinishedMatch = game.isFinished;
      const finalRoundState = game.roundState;

      const roundResult = game.getRoundResult();

      return {
        round1,
        r1P1Wins,
        r1P2Wins,
        roundState1,
        roundWinner1,
        p1WinsAfterR1,
        isFinishedAfterR1,
        round2,
        roundState2,
        p2TankRound2Alive,
        p2TankRound2Lives,
        roundWinner2,
        p1WinsAfterR2,
        isFinishedMatch,
        finalRoundState,
        finalMatchWinnerId: roundResult.winnerId
      };
    });

    expect(roundProgression.round1).toBe(1);
    expect(roundProgression.r1P1Wins).toBe(0);
    expect(roundProgression.roundState1).toBe('ROUND_END');
    expect(roundProgression.roundWinner1).toBe(0);
    expect(roundProgression.p1WinsAfterR1).toBe(1);
    expect(roundProgression.isFinishedAfterR1).toBe(false); // Match not over yet!

    expect(roundProgression.round2).toBe(2);
    expect(roundProgression.roundState2).toBe('PLAYING');
    expect(roundProgression.p2TankRound2Alive).toBe(true);
    expect(roundProgression.p2TankRound2Lives).toBe(3);

    expect(roundProgression.roundWinner2).toBe(0);
    expect(roundProgression.p1WinsAfterR2).toBe(2);
    expect(roundProgression.isFinishedMatch).toBe(true);
    expect(roundProgression.finalRoundState).toBe('MATCH_OVER');
    expect(roundProgression.finalMatchWinnerId).toBe(0);
  });
});

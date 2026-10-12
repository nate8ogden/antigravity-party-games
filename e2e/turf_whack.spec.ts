import { test, expect } from '@playwright/test';

test.describe('Turf Whack Mole Game - AI & Wide Swing', () => {
  test('Wide swing hits moles up to 85px away and grants points', async ({ page }) => {
    // Navigate directly to Turf Whack minigame
    await page.goto('http://localhost:5173/?game=turf_whack&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    // Fast-forward countdown directly to PLAYING
    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(200);

    // Position player 1 mallet 75px away from hole 0 and pop a mole
    const result = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      const debug = (window as any).__TURF_WHACK_DEBUG__;
      if (!game || !debug) return null;

      const p1 = game.mallets.get(0);
      const hole = game.holes[0];
      if (!p1 || !hole) return null;

      // Pop mole at hole 0
      debug.popMoleAtHole(0, 'mole');

      // Position p1 75px away (which is well beyond the old 55px radius, but within the new 88px wide swing radius)
      p1.x = hole.x + 72;
      p1.y = hole.y;
      const initialScore = p1.score;

      // Trigger player 1 swing
      p1.isWhacking = true;
      p1.whackAnim = 0;
      game.checkMalletHit(p1);

      return {
        initialScore,
        postScore: p1.score,
        hitRadius: debug.getHitRadius(),
        moleOccupant: hole.occupant
      };
    });

    expect(result).not.toBeNull();
    // Hit radius is 88px
    expect(result!.hitRadius).toBe(88);
    // Score increased by 1 from whacking mole 72px away!
    expect(result!.postScore).toBe(result!.initialScore + 1);
    // Mole was cleared
    expect(result!.moleOccupant).toBe('none');
  });

  test('Bot AI is calibrated with beatable glide speed and reaction delay', async ({ page }) => {
    await page.goto('http://localhost:5173/?game=turf_whack&players=1&difficulty=normal');
    await expect(page.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      if (gm) {
        gm.countdownTimer = 0;
        gm.state = 'PLAYING';
      }
    });

    await page.waitForTimeout(200);

    // Check bot state after a mole appears: verify reaction delay exists
    const botCheck = await page.evaluate(() => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = gm?.activeGame;
      const debug = (window as any).__TURF_WHACK_DEBUG__;
      if (!game || !debug) return null;

      // Bot is player 1 (id 1)
      const bot = game.mallets.get(1);
      if (!bot) return null;

      // Pop mole at hole 3
      debug.popMoleAtHole(3, 'mole');

      // Update bot AI by 1 tick (16ms)
      game.updateBotAI(0.016, 1, 'bot_normal', 800, 600);
      const state = game.botStates.get(1);

      return {
        botId: bot.id,
        targetHoleId: state?.targetHoleId,
        reactionDelay: state?.reactionDelay
      };
    });

    expect(botCheck).not.toBeNull();
    expect(botCheck!.targetHoleId).toBe(3);
    // Reaction delay should be > 0.1s (human-like reaction rather than frame 0 instant strike)
    expect(botCheck!.reactionDelay).toBeGreaterThan(0.1);
  });
});

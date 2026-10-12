import './style.css';
import { GameManager, GAME_CATALOG } from './core/GameManager';
import { EconomyManager } from './core/EconomyManager';
import { AchievementManager } from './core/AchievementManager';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Game canvas not found');

  const gameManager = new GameManager(canvas);
  (window as unknown as { __GAME_MANAGER__: GameManager }).__GAME_MANAGER__ = gameManager;
  (window as unknown as { __ECONOMY_MANAGER__: EconomyManager }).__ECONOMY_MANAGER__ = EconomyManager.getInstance();
  (window as unknown as { __ACHIEVEMENT_MANAGER__: AchievementManager }).__ACHIEVEMENT_MANAGER__ = AchievementManager.getInstance();
  (window as unknown as { GAME_CATALOG: typeof GAME_CATALOG }).GAME_CATALOG = GAME_CATALOG;

  // Unlock Web Audio context seamlessly on first user gesture
  const unlockAudio = () => {
    gameManager.audio.playTap();
  };
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });

  // Bind Canvas click/pointer for UI interaction (Lobby cards, modal, buttons)
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    gameManager.handleCanvasClick(x, y);
  });

  // Bind Mouse Move for dynamic hover cursor styling
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    gameManager.handleMouseMove(x, y);
  });

  // Bind Mouse Wheel for Lobby and Shop Vertical Scrolling
  canvas.addEventListener('wheel', (e) => {
    if (gameManager.state === 'LOBBY' || gameManager.isShopOpen) {
      e.preventDefault();
      gameManager.handleScroll(e.deltaY);
    }
  }, { passive: false });

  // Bind Touch Drag for Lobby and Shop Vertical Scrolling
  let lobbyTouchStartY = 0;
  canvas.addEventListener('touchstart', (e) => {
    if ((gameManager.state === 'LOBBY' || gameManager.isShopOpen) && e.touches.length === 1) {
      lobbyTouchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if ((gameManager.state === 'LOBBY' || gameManager.isShopOpen) && e.touches.length === 1) {
      const deltaY = lobbyTouchStartY - e.touches[0].clientY;
      lobbyTouchStartY = e.touches[0].clientY;
      gameManager.handleScroll(deltaY);
    }
  }, { passive: true });

  // Bind Shop / Mascot Wardrobe Button and Dynamic Coin Counter
  const shopBtn = document.getElementById('shop-btn');
  const shopCoinCount = document.getElementById('shop-coin-count');
  if (shopCoinCount) {
    shopCoinCount.textContent = EconomyManager.getInstance().getCoins().toString();
    EconomyManager.getInstance().addListener((coins) => {
      shopCoinCount.textContent = coins.toString();
    });
  }
  if (shopBtn) {
    shopBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      gameManager.toggleShop();
    });
  }

  // Bind Trophy Room / Achievements Button and Progress Badge
  const trophyBtn = document.getElementById('trophy-btn');
  const trophyUnlockedCount = document.getElementById('trophy-unlocked-count');
  const achManager = AchievementManager.getInstance();
  const updateTrophyBadge = (unlocked: number) => {
    if (trophyUnlockedCount) {
      trophyUnlockedCount.textContent = `${unlocked}/${achManager.getTotalCount()}`;
    }
  };
  if (trophyUnlockedCount) {
    updateTrophyBadge(achManager.getUnlockedCount());
    achManager.addListener((count) => {
      updateTrophyBadge(count);
    });
  }
  if (trophyBtn) {
    trophyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      gameManager.toggleTrophies();
    });
  }

  // Bind Responsive Pause Button
  const pauseBtn = document.getElementById('center-pause-btn');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      gameManager.togglePause();
    });
  }

  // Bind Settings Button
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      gameManager.toggleSettings();
    });
  }

  // Keyboard shortcuts: Modal enter/esc, Pause toggle (Esc/P), Rematch (Enter/Space), Random/Cup (R/T), Settings (O/S), Shop (B)
  window.addEventListener('keydown', (e) => {
    // Prevent browser scroll when pressing Space in interactive menu states
    if (e.key === ' ' && (gameManager.isModalOpen || gameManager.isSettingsOpen || gameManager.isShopOpen || gameManager.state === 'ROUND_OVER' || gameManager.state === 'PAUSED')) {
      e.preventDefault();
    }
    gameManager.handleGlobalKey(e.key);
  });

  // Bind 4 Corner Touch Overlays
  const zones = [
    { el: document.getElementById('zone-p1'), id: 0 },
    { el: document.getElementById('zone-p2'), id: 1 },
    { el: document.getElementById('zone-p3'), id: 2 },
    { el: document.getElementById('zone-p4'), id: 3 }
  ];

  zones.forEach(({ el, id }) => {
    if (!el) return;
    const onDown = (e: Event) => {
      if (gameManager.state === 'PLAYING' || gameManager.state === 'COUNTDOWN') {
        e.preventDefault();
        el.classList.add('active');
        // Trigger press through InputRouter
        (gameManager as unknown as { input: { press: (p: number) => void } }).input.press(id);
      }
    };
    const onUp = (e: Event) => {
      if (gameManager.state === 'PLAYING' || gameManager.state === 'COUNTDOWN') {
        e.preventDefault();
        el.classList.remove('active');
        (gameManager as unknown as { input: { release: (p: number) => void } }).input.release(id);
      }
    };

    el.addEventListener('mousedown', onDown);
    el.addEventListener('mouseup', onUp);
    el.addEventListener('mouseleave', onUp);

    el.addEventListener('touchstart', onDown, { passive: false });
    el.addEventListener('touchend', onUp, { passive: false });
    el.addEventListener('touchcancel', onUp, { passive: false });
  });

  // Utility Controls: Mute & Fullscreen
  const muteBtn = document.getElementById('mute-btn');
  if (muteBtn) {
    muteBtn.addEventListener('click', () => {
      const isMuted = (gameManager as unknown as { audio: { toggleMute: () => boolean } }).audio.toggleMute();
      muteBtn.textContent = isMuted ? '🔇' : '🔊';
    });
  }

  const fullscreenBtn = document.getElementById('fullscreen-btn');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });
  }

  // High-Refresh (60Hz / 120Hz ProMotion / 144Hz) Butter-Smooth Game Loop
  let lastTime = performance.now();
  let smoothDt = 1 / 60;
  let lastSyncedState = '';

  function gameLoop(currentTime: number) {
    let rawDt = (currentTime - lastTime) / 1000;
    lastTime = currentTime;

    // Clamp extreme lag spikes or tab suspensions (minimum 20 FPS floor)
    rawDt = Math.max(0.001, Math.min(0.05, rawDt));

    // Exponential moving average filter eliminates micro-jitter from frame scheduler fluctuations
    smoothDt = smoothDt * 0.75 + rawDt * 0.25;

    gameManager.update(smoothDt);
    gameManager.render();

    // Only manipulate DOM attributes when game state actually changes (prevents per-frame layout thrashing)
    const currentState = gameManager.state;
    if (currentState !== lastSyncedState) {
      lastSyncedState = currentState;

      if (pauseBtn) {
        if (currentState === 'LOBBY' || currentState === 'PODIUM') {
          if (!pauseBtn.classList.contains('disabled')) {
            pauseBtn.classList.add('disabled');
            pauseBtn.setAttribute('aria-disabled', 'true');
          }
          if (pauseBtn.textContent !== '⏸') pauseBtn.textContent = '⏸';
        } else {
          if (pauseBtn.classList.contains('disabled')) {
            pauseBtn.classList.remove('disabled');
            pauseBtn.removeAttribute('aria-disabled');
          }
          const targetIcon = currentState === 'PAUSED' ? '▶' : '⏸';
          if (pauseBtn.textContent !== targetIcon) pauseBtn.textContent = targetIcon;
        }
      }

      const isPlayingState = currentState === 'PLAYING' || currentState === 'COUNTDOWN';
      document.body.classList.toggle('in-game', isPlayingState);
      const targetPointer = isPlayingState ? 'auto' : 'none';
      zones.forEach(({ el }) => {
        if (el && el.style.pointerEvents !== targetPointer) {
          el.style.pointerEvents = targetPointer;
        }
      });
    }

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);
});

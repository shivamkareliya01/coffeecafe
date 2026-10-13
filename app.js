/**
 * AUREN COLD BREW | CINEMATIC INTERACTION ENGINE
 * 203-frame height-contained canvas renderer with interpolation,
 * 600vh scroll runway, two-zone layout, ambient sound, and Apple-grade polish.
 */

(function () {
  'use strict';

  // --- CONFIGURATION & CONSTANTS ---
  const TOTAL_FRAMES = 203;
  const FRAME_PREFIX = 'ezgif-6281199cbf36ae1c-jpg/ezgif-frame-';
  const FRAME_EXT = '.jpg';

  // --- STATE ---
  const state = {
    images: [],
    loadedCount: 0,
    priorityLoaded: 0,
    isLoaded: false,
    introActive: false,
    introStartTime: 0,
    currentFrame: 1,       // Floating value for interpolation
    targetFrame: 1,        // Desired target frame
    isPlaying: false,
    playbackSpeed: 1.0,
    playbackDir: 1,
    audioActive: false,
    audioCtx: null,
    audioNodes: null
  };

  // --- DOM ELEMENTS ---
  const preloader = document.getElementById('preloader');
  const preloaderFill = document.getElementById('preloaderFill');
  const preloaderPercent = document.getElementById('preloaderPercent');
  const preloaderStatus = document.getElementById('preloaderStatus');

  const navbar = document.getElementById('navbar');
  const heroSection = document.getElementById('hero');
  const canvas = document.getElementById('cinemaCanvas');
  const ctx = canvas ? canvas.getContext('2d', { alpha: false }) : null;

  // Hero HUD & Controls
  const chipFrameVal = document.getElementById('chipFrameVal');
  const heroVertProgressFill = document.getElementById('heroVertProgressFill');
  const heroScrollCue = document.getElementById('heroScrollCue');
  const dockPlayBtn = document.getElementById('dockPlayBtn');
  const iconPlay = dockPlayBtn ? dockPlayBtn.querySelector('.icon-play') : null;
  const iconPause = dockPlayBtn ? dockPlayBtn.querySelector('.icon-pause') : null;
  const dockScrubber = document.getElementById('dockScrubberInput');
  const dockScrubFill = document.getElementById('dockScrubFill');
  const dockFrameCount = document.getElementById('dockFrameCount');
  const dockModeText = document.getElementById('dockModeText');

  // Hero Editorial Phase Panels
  const phasePanels = [
    document.getElementById('phase1'),
    document.getElementById('phase2'),
    document.getElementById('phase3'),
    document.getElementById('phase4')
  ];

  // Sound & Cursor
  const soundToggle = document.getElementById('soundToggle');
  const customCursor = document.getElementById('customCursor');
  const cursorDot = document.getElementById('cursorDot');
  const toastContainer = document.getElementById('toastContainer');
  const reserveModalBtn = document.getElementById('reserveModalBtn');

  // Helper: Pad frame numbers (1 -> "001")
  function pad(num, size = 3) {
    let s = String(num);
    while (s.length < size) s = '0' + s;
    return s;
  }

  // Helper: Get frame URL
  function getFrameUrl(index) {
    return `${FRAME_PREFIX}${pad(index)}${FRAME_EXT}`;
  }

  // ==========================================================================
  // 1. HIGH-SPEED IMAGE PRELOADER (FIRST 30 PRIORITY, THEN IDLE BATCHES)
  // ==========================================================================
  function preloadFrames() {
    const PRIORITY_COUNT = 30;
    let priorityLoaded = 0;
    let totalLoaded = 0;

    function loadSingleFrame(i, onComplete) {
      if (state.images[i]) {
        if (onComplete) onComplete();
        return;
      }

      const img = new Image();
      img.decoding = 'async';

      img.onload = () => {
        state.images[i] = img;
        totalLoaded++;
        state.loadedCount = totalLoaded;

        if (i <= PRIORITY_COUNT) {
          priorityLoaded++;
          state.priorityLoaded = priorityLoaded;
          const pct = Math.min(100, Math.round((priorityLoaded / PRIORITY_COUNT) * 100));
          if (preloaderFill) preloaderFill.style.width = pct + '%';
          if (preloaderPercent) preloaderPercent.textContent = pct + '%';

          // As soon as frame 1 arrives, size canvas and draw immediately
          if (i === 1) {
            resizeCanvas();
            drawContainFrame(1);
          }

          // Once first 30 frames arrive, dismiss preloader and reveal hero!
          if (priorityLoaded >= PRIORITY_COUNT && !state.isLoaded) {
            finishLoading();
          }
        }

        if (onComplete) onComplete();
      };

      img.onerror = () => {
        console.error(`[AUREN Frame Error] 404 for frame ${i}: ${getFrameUrl(i)}`);
        totalLoaded++;
        if (i <= PRIORITY_COUNT) {
          priorityLoaded++;
          if (priorityLoaded >= PRIORITY_COUNT && !state.isLoaded) {
            finishLoading();
          }
        }
        if (onComplete) onComplete();
      };

      img.src = getFrameUrl(i);
    }

    // Step 1: Immediately fetch frames 1-30 in parallel
    for (let i = 1; i <= PRIORITY_COUNT; i++) {
      loadSingleFrame(i);
    }

    // Step 2: Background idle loader for remaining frames 31..203
    let nextBatch = PRIORITY_COUNT + 1;
    const BATCH_SIZE = 10;

    function scheduleNextBatch() {
      if (nextBatch > TOTAL_FRAMES) return;

      const endBatch = Math.min(TOTAL_FRAMES, nextBatch + BATCH_SIZE - 1);
      let batchDone = 0;
      const needed = endBatch - nextBatch + 1;

      for (let f = nextBatch; f <= endBatch; f++) {
        loadSingleFrame(f, () => {
          batchDone++;
          if (batchDone >= needed) {
            nextBatch = endBatch + 1;
            if (window.requestIdleCallback) {
              window.requestIdleCallback(scheduleNextBatch, { timeout: 100 });
            } else {
              setTimeout(scheduleNextBatch, 25);
            }
          }
        });
      }
    }

    // Start background queue after priority starts
    setTimeout(scheduleNextBatch, 100);
  }

  function finishLoading() {
    if (state.isLoaded) return;
    state.isLoaded = true;

    if (preloaderStatus) preloaderStatus.textContent = '30 FRAMES SYNCHRONIZED • KINETICS ACTIVE';
    if (preloaderPercent) preloaderPercent.textContent = '100%';

    setTimeout(() => {
      if (preloader) preloader.classList.add('fade-out');
      document.body.classList.remove('loading-active');
      showToast('AUREN Cinema 4K Engine Ready', '✨');

      resizeCanvas();
      startAutoplayIntro();
    }, 350);
  }

  // Autoplay intro: frames 1 -> 203 over ~4 seconds on load, then hand to scroll
  function startAutoplayIntro() {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || window.scrollY > 80) {
      state.introActive = false;
      return;
    }

    state.introActive = true;
    state.introStartTime = performance.now();
    if (dockModeText) dockModeText.textContent = 'AUTOPLAY INTRO';

    const cancelIntro = () => {
      if (state.introActive) {
        state.introActive = false;
        if (dockModeText) dockModeText.textContent = 'SCROLL SYNC';
        window.removeEventListener('wheel', cancelIntro);
        window.removeEventListener('touchmove', cancelIntro);
      }
    };

    window.addEventListener('wheel', cancelIntro, { passive: true, once: true });
    window.addEventListener('touchmove', cancelIntro, { passive: true, once: true });
  }

  // ==========================================================================
  // 2. CANVAS CONTAIN-FIT BY HEIGHT & NEAREST LOADED FALLBACK ENGINE
  // ==========================================================================
  function getNearestLoadedImage(frameIndex) {
    const target = Math.max(1, Math.min(TOTAL_FRAMES, Math.round(frameIndex)));
    if (state.images[target] && state.images[target].complete && state.images[target].naturalWidth > 0) {
      return state.images[target];
    }
    // Search outward for nearest loaded frame
    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const lower = target - offset;
      if (lower >= 1 && state.images[lower] && state.images[lower].complete && state.images[lower].naturalWidth > 0) {
        return state.images[lower];
      }
      const upper = target + offset;
      if (upper <= TOTAL_FRAMES && state.images[upper] && state.images[upper].complete && state.images[upper].naturalWidth > 0) {
        return state.images[upper];
      }
    }
    return null;
  }

  // Height-contained draw logic: full glass visible from top to base, aspect preserved, seamless void
  function drawContainFrame(floatFrame) {
    if (!ctx || !canvas) return;
    const cw = canvas.width;
    const ch = canvas.height;
    if (!cw || !ch) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = cw / dpr;
    const cssH = ch / dpr;
    const isDesktop = cssW >= 900;

    // 1. Fill entire canvas stage with #0E1110 (NO black side bars anywhere)
    ctx.fillStyle = '#0E1110';
    ctx.fillRect(0, 0, cw, ch);

    // Frame natural dimensions: 720 x 1280 (aspect ratio 0.5625)
    const nw = 720;
    const nh = 1280;
    const aspect = nw / nh;

    let targetHeightCSS;
    let targetCenterX_CSS;
    let targetCenterY_CSS;

    if (isDesktop) {
      // Desktop: Glass is fully visible from top (splash/ice) to bottom (base)
      // Height = ~90vh (minus nav), centered-right around 58-60% width
      // Do not upscale beyond natural resolution (1280) to preserve sharpness
      const maxH = Math.min(cssH * 0.90, nh);
      targetHeightCSS = maxH;
      targetCenterX_CSS = cssW * 0.58;
      targetCenterY_CSS = (cssH + 30) / 2;
    } else {
      // Mobile: Glass on top (top 52-54vh), centered horizontally
      const maxH = Math.min(cssH * 0.52, 480);
      targetHeightCSS = maxH;
      targetCenterX_CSS = cssW * 0.50;
      targetCenterY_CSS = 70 + targetHeightCSS / 2;
    }

    const dh = Math.round(targetHeightCSS * dpr);
    const dw = Math.round(dh * aspect);
    const dx = Math.round((targetCenterX_CSS * dpr) - (dw / 2));
    const dy = Math.round((targetCenterY_CSS * dpr) - (dh / 2));

    // 2. Soft radial glow of warm caramel behind the glass for depth
    const glowX = dx + dw / 2;
    const glowY = dy + dh * 0.52;
    const glowRadius = Math.max(dw * 0.85, dh * 0.45);
    const caramelGlow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, glowRadius);
    caramelGlow.addColorStop(0, 'rgba(200, 145, 90, 0.14)');
    caramelGlow.addColorStop(0.4, 'rgba(200, 145, 90, 0.06)');
    caramelGlow.addColorStop(0.8, 'rgba(14, 17, 16, 0.02)');
    caramelGlow.addColorStop(1, 'rgba(14, 17, 16, 0)');
    ctx.fillStyle = caramelGlow;
    ctx.beginPath();
    ctx.arc(glowX, glowY, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // 3. Draw nearest loaded image frame(s) with dual-frame crossfade
    const clamped = Math.max(1, Math.min(TOTAL_FRAMES, floatFrame));
    const f1 = Math.floor(clamped);
    const f2 = Math.min(TOTAL_FRAMES, f1 + 1);
    const frac = clamped - f1;

    const img1 = getNearestLoadedImage(f1);
    const img2 = (frac > 0.02) ? getNearestLoadedImage(f2) : null;

    if (img1) {
      ctx.globalAlpha = 1.0;
      ctx.drawImage(img1, dx, dy, dw, dh);
    }
    if (img2 && img2 !== img1 && frac > 0.02) {
      ctx.globalAlpha = frac;
      ctx.drawImage(img2, dx, dy, dw, dh);
      ctx.globalAlpha = 1.0;
    }

    // 4. Subtle 4-edge feather gradients into #0E1110 so the frame melts seamlessly into the stage
    const feather = Math.round(35 * dpr);

    // Left edge
    const gL = ctx.createLinearGradient(dx - 1, dy, dx + feather, dy);
    gL.addColorStop(0, '#0E1110');
    gL.addColorStop(1, 'rgba(14, 17, 16, 0)');
    ctx.fillStyle = gL;
    ctx.fillRect(dx - 2, dy - 2, feather + 2, dh + 4);

    // Right edge
    const gR = ctx.createLinearGradient(dx + dw - feather, dy, dx + dw + 1, dy);
    gR.addColorStop(0, 'rgba(14, 17, 16, 0)');
    gR.addColorStop(1, '#0E1110');
    ctx.fillStyle = gR;
    ctx.fillRect(dx + dw - feather, dy - 2, feather + 4, dh + 4);

    // Top edge
    const gT = ctx.createLinearGradient(dx, dy - 1, dx, dy + feather);
    gT.addColorStop(0, '#0E1110');
    gT.addColorStop(1, 'rgba(14, 17, 16, 0)');
    ctx.fillStyle = gT;
    ctx.fillRect(dx - 2, dy - 2, dw + 4, feather + 2);

    // Bottom edge
    const gB = ctx.createLinearGradient(dx, dy + dh - feather, dx, dy + dh + 1);
    gB.addColorStop(0, 'rgba(14, 17, 16, 0)');
    gB.addColorStop(1, '#0E1110');
    ctx.fillStyle = gB;
    ctx.fillRect(dx - 2, dy + dh - feather, dw + 4, feather + 4);
  }

  // Dynamic canvas resize with devicePixelRatio
  function resizeCanvas() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;

    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    drawContainFrame(state.currentFrame);
  }

  // RAF Render Loop
  let lastTime = performance.now();
  function renderLoop(time) {
    requestAnimationFrame(renderLoop);

    if (!time) time = performance.now();
    const dt = Math.min(50, time - lastTime);
    lastTime = time;

    // 1. Intro Autoplay logic (4 seconds from frame 1 -> 203)
    if (state.introActive) {
      const elapsed = time - state.introStartTime;
      const progress = Math.min(1.0, elapsed / 4000);
      state.targetFrame = 1 + progress * (TOTAL_FRAMES - 1);

      if (progress >= 1.0) {
        state.introActive = false;
        if (dockModeText) dockModeText.textContent = 'SCROLL SYNC';
        onScroll();
      }
    } else if (state.isPlaying) {
      // 2. User Manual Autoplay
      const frameDelta = (dt / 1000) * 24 * state.playbackSpeed * state.playbackDir;
      state.targetFrame += frameDelta;

      if (state.targetFrame >= TOTAL_FRAMES) {
        state.targetFrame = TOTAL_FRAMES;
        state.playbackDir = -1;
      } else if (state.targetFrame <= 1) {
        state.targetFrame = 1;
        state.playbackDir = 1;
      }
    }

    // 3. Smooth inertia lerp (lerp factor: 0.1 for buttery yet responsive motion)
    const lerpFactor = 0.1;
    const diff = state.targetFrame - state.currentFrame;
    if (Math.abs(diff) > 0.005) {
      state.currentFrame += diff * lerpFactor;
    } else {
      state.currentFrame = state.targetFrame;
    }

    // 4. Draw height-contained frame
    drawContainFrame(state.currentFrame);

    // 5. Update UI HUD, stat chip & Scrubber
    updateHUD(state.currentFrame);

    // 6. Sync story phases in real-time
    updateStoryPanels(state.currentFrame);
  }

  // Update HUD elements
  function updateHUD(frameVal) {
    const intFrame = Math.max(1, Math.min(TOTAL_FRAMES, Math.round(frameVal)));
    const formatted = pad(intFrame, 3);
    
    if (chipFrameVal) chipFrameVal.textContent = `${formatted} / ${TOTAL_FRAMES}`;
    if (dockFrameCount) dockFrameCount.textContent = formatted;

    if (dockScrubber && document.activeElement !== dockScrubber) {
      dockScrubber.value = intFrame;
      const pct = ((intFrame - 1) / (TOTAL_FRAMES - 1)) * 100;
      if (dockScrubFill) dockScrubFill.style.width = `${pct}%`;
    }
  }

  // ==========================================================================
  // 3. SCROLL-DRIVEN STORY ENGINE (600VH PINNED SCROLL RUNWAY)
  // ==========================================================================
  function onScroll() {
    const scrollY = window.scrollY;

    // Navbar backdrop effect
    if (scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    if (!heroSection) return;

    // Calculate Hero scroll progress
    const heroRect = heroSection.getBoundingClientRect();
    const heroHeight = heroSection.offsetHeight;
    const windowH = window.innerHeight;

    const scrollTravel = heroHeight - windowH;
    const currentScroll = -heroRect.top;

    let progress = 0;
    if (scrollTravel > 0) {
      progress = Math.max(0, Math.min(1, currentScroll / scrollTravel));
    }

    // Cancel intro autoplay if user initiates scrolling
    if (state.introActive && (currentScroll > 30 || scrollY > 30)) {
      state.introActive = false;
      if (dockModeText) dockModeText.textContent = 'SCROLL SYNC';
    }

    // Fade out "SCROLL TO EXPLORE" cue on first scroll
    if (heroScrollCue) {
      if (progress > 0.02 || scrollY > 30) {
        heroScrollCue.classList.add('fade-out');
      } else {
        heroScrollCue.classList.remove('fade-out');
      }
    }

    // Update vertical progress line on right edge
    if (heroVertProgressFill) {
      heroVertProgressFill.style.height = `${progress * 100}%`;
    }

    // Map progress 0 -> 1 to frame 0 -> 202 (files 1 -> 203)
    if (!state.isPlaying && !state.introActive) {
      const targetIndex = Math.round(progress * 202);
      state.targetFrame = 1 + targetIndex;
    }

    // Update story phase panels
    updateStoryPanels(state.currentFrame);
  }

  // Divide the scroll into 4 crossfading text phases:
  // Phase 01 Sub-Zero Descent (frames 1-50)
  // Phase 02 Kinetic Impact (frames 50-100)
  // Phase 03 Velvet Cascade (frames 100-150)
  // Phase 04 Harmonic Convergence (frames 150-203)
  function updateStoryPanels(frameVal) {
    const frameIndex0 = Math.max(0, Math.min(202, Math.round(frameVal - 1)));
    let activeIndex = 0;

    if (frameIndex0 <= 50) {
      activeIndex = 0;
    } else if (frameIndex0 <= 100) {
      activeIndex = 1;
    } else if (frameIndex0 <= 150) {
      activeIndex = 2;
    } else {
      activeIndex = 3;
    }

    phasePanels.forEach((panel, idx) => {
      if (panel) {
        if (idx === activeIndex) {
          panel.classList.add('active');
        } else {
          panel.classList.remove('active');
        }
      }
    });
  }

  // ==========================================================================
  // 4. PLAYBACK DOCK CONTROLS
  // ==========================================================================
  function setupPlaybackDock() {
    if (!dockPlayBtn) return;

    dockPlayBtn.addEventListener('click', () => {
      state.isPlaying = !state.isPlaying;
      if (state.isPlaying) {
        if (iconPlay) iconPlay.style.display = 'none';
        if (iconPause) iconPause.style.display = 'block';
        if (dockModeText) dockModeText.textContent = `AUTOPLAY (1.0×)`;
        showToast('Autoplay Kinetic Loop', '▶');
      } else {
        if (iconPlay) iconPlay.style.display = 'block';
        if (iconPause) iconPause.style.display = 'none';
        if (dockModeText) dockModeText.textContent = 'PAUSED';
      }
    });

    if (dockScrubber) {
      dockScrubber.addEventListener('input', (e) => {
        state.isPlaying = false;
        if (iconPlay) iconPlay.style.display = 'block';
        if (iconPause) iconPause.style.display = 'none';
        if (dockModeText) dockModeText.textContent = 'MANUAL SCRUB';

        const val = parseFloat(e.target.value);
        state.targetFrame = val;
        const pct = ((val - 1) / (TOTAL_FRAMES - 1)) * 100;
        if (dockScrubFill) dockScrubFill.style.width = `${pct}%`;
      });
    }
  }

  // ==========================================================================
  // 5. AMBIENCE SOUND GENERATOR (WEB AUDIO API CHILL DRONE)
  // ==========================================================================
  function setupAudioAmbience() {
    if (!soundToggle) return;

    soundToggle.addEventListener('click', () => {
      if (!state.audioActive) {
        // Start synthetic cold lounge drone
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!state.audioCtx) {
            state.audioCtx = new AudioContext();
          }
          if (state.audioCtx.state === 'suspended') {
            state.audioCtx.resume();
          }

          const osc1 = state.audioCtx.createOscillator();
          const osc2 = state.audioCtx.createOscillator();
          const gainNode = state.audioCtx.createGain();
          const filter = state.audioCtx.createBiquadFilter();

          // Warm low drone around 65Hz and 130Hz
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(65.41, state.audioCtx.currentTime); // C2

          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(130.81, state.audioCtx.currentTime); // C3

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(280, state.audioCtx.currentTime);

          gainNode.gain.setValueAtTime(0.01, state.audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.12, state.audioCtx.currentTime + 1.5);

          osc1.connect(filter);
          osc2.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(state.audioCtx.destination);

          osc1.start();
          osc2.start();

          state.audioNodes = { osc1, osc2, gainNode };
          state.audioActive = true;
          soundToggle.classList.add('playing');
          showToast('Sub-Zero Ambience Active', '🎵');
        } catch (e) {
          console.warn('Web Audio error:', e);
        }
      } else {
        // Stop ambience
        if (state.audioNodes && state.audioNodes.gainNode) {
          state.audioNodes.gainNode.gain.exponentialRampToValueAtTime(0.0001, state.audioCtx.currentTime + 0.6);
          setTimeout(() => {
            if (state.audioNodes.osc1) state.audioNodes.osc1.stop();
            if (state.audioNodes.osc2) state.audioNodes.osc2.stop();
            state.audioActive = false;
            soundToggle.classList.remove('playing');
            showToast('Ambience Muted', '🔇');
          }, 600);
        } else {
          state.audioActive = false;
          soundToggle.classList.remove('playing');
        }
      }
    });
  }

  // ==========================================================================
  // 6. CUSTOM CURSOR & TOASTS
  // ==========================================================================
  function setupCustomCursor() {
    if (!customCursor || !cursorDot) return;

    window.addEventListener('mousemove', (e) => {
      cursorDot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      customCursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    }, { passive: true });

    document.querySelectorAll('a, button, input[type="range"]').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        customCursor.style.transform += ' scale(1.6)';
        customCursor.style.borderColor = '#FFFFFF';
      });
      el.addEventListener('mouseleave', () => {
        customCursor.style.borderColor = 'rgba(255, 255, 255, 0.35)';
      });
    });
  }

  function showToast(message, icon = '✨') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span style="margin-right: 6px;">${icon}</span> ${message}`;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-8px)';
      toast.style.transition = 'opacity 0.4s, transform 0.4s';
      setTimeout(() => toast.remove(), 400);
    }, 2800);
  }

  // ==========================================================================
  // 7. SMOOTH LENIS SCROLL
  // ==========================================================================
  function setupLenis() {
    if (typeof Lenis !== 'undefined') {
      const lenis = new Lenis({
        duration: 1.1,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        smoothWheel: true
      });

      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
    }
  }

  // Allocation CTA interaction
  if (reserveModalBtn) {
    reserveModalBtn.addEventListener('click', () => {
      showToast('Allocation Waitlist Opened for 2026 Reserve', '🏆');
    });
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================
  function init() {
    preloadFrames();
    setupLenis();
    setupPlaybackDock();
    setupAudioAmbience();
    setupCustomCursor();

    resizeCanvas();
    renderLoop();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => {
      resizeCanvas();
      onScroll();
    }, { passive: true });
    window.addEventListener('orientationchange', () => {
      resizeCanvas();
      onScroll();
    }, { passive: true });

    onScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

/**
 * Video Splash & Inter-display Loading Transitions
 * - Intro Splash: Plays the new intro video on boot. Skippable via Esc/Space/Click.
 * - Loading Screen: Uses the original intro video as a cinematic loading veil
 *   between tab displays / window switches.
 */
import newSplashMp4 from '../media/how2soap-splash-new.mp4';
import newSplashWebm from '../media/how2soap-splash-new.webm';
import newSplashPoster from '../media/how2soap-splash-new.png';

import loaderMp4 from '../media/how2soap-intro.mp4';
import loaderWebm from '../media/how2soap-intro.webm';
import loaderPoster from '../media/how2soap-poster.png';

import { audio } from '../ui/audio';

/**
 * Launch the intro splash on startup.
 * The world boots underneath it; any click, keypress, or the video ending fades it out.
 */
export function launchSplash(): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const overlay = document.createElement('div');
  overlay.className = 'splash-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const viewport = document.createElement('div');
  viewport.className = 'splash-viewport';

  const video = document.createElement('video');
  video.className = 'splash-video';
  video.autoplay = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.poster = newSplashPoster;

  const mp4Source = document.createElement('source');
  mp4Source.src = newSplashMp4;
  mp4Source.type = 'video/mp4';
  const webmSource = document.createElement('source');
  webmSource.src = newSplashWebm;
  webmSource.type = 'video/webm';
  video.append(mp4Source, webmSource);

  // Astrolabe lens vignette & scanline overlay
  const lens = document.createElement('div');
  lens.className = 'splash-lens';

  // Corner brackets (tactile reticle pips)
  const reticleTL = document.createElement('div');
  reticleTL.className = 'splash-bracket splash-bracket-tl';
  const reticleTR = document.createElement('div');
  reticleTR.className = 'splash-bracket splash-bracket-tr';
  const reticleBL = document.createElement('div');
  reticleBL.className = 'splash-bracket splash-bracket-bl';
  const reticleBR = document.createElement('div');
  reticleBR.className = 'splash-bracket splash-bracket-br';

  const hint = document.createElement('div');
  hint.className = 'splash-hint';
  hint.innerHTML = '<kbd class="splash-key">ESC / SPACE</kbd><span class="splash-hint-label">Click anywhere to skip</span>';

  viewport.append(video, lens, reticleTL, reticleTR, reticleBL, reticleBR);
  overlay.append(viewport, hint);
  document.body.appendChild(overlay);

  let dismissed = false;
  const dismiss = (): void => {
    if (dismissed) return;
    dismissed = true;
    audio.uiHeavyVent();
    document.removeEventListener('keydown', onKeyDown);
    overlay.classList.add('splash-fade');
    window.setTimeout(() => overlay.remove(), 700);
  };

  const onKeyDown = (_e: KeyboardEvent): void => {
    dismiss();
  };

  overlay.addEventListener('click', dismiss);
  video.addEventListener('ended', dismiss);
  document.addEventListener('keydown', onKeyDown);

  video.play().catch(() => {
    // Autoplay with audio blocked: retry muted rather than dropping the splash.
    video.muted = true;
    video.play().catch(() => dismiss());
  });
}

let activeLoaderOverlay: HTMLElement | null = null;
let loaderFadeTimeout: number | null = null;

/**
 * Transition between displays using the previous splash video as a brief,
 * atmospheric loading veil.
 *
 * @param displayLabel Display title (e.g. 'Workbench', 'Astrolabe Map', 'Sanctuary')
 * @param performTransition Callback that executes the actual display switch
 * @param minDurationMs Minimum display duration of loading veil (default 420ms)
 */
export function transitionDisplay(
  displayLabel: string,
  performTransition: () => void,
  minDurationMs = 420,
): void {
  // Respect user preference for reduced motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    performTransition();
    return;
  }

  // Clear any existing transition
  if (activeLoaderOverlay) {
    activeLoaderOverlay.remove();
    activeLoaderOverlay = null;
  }
  if (loaderFadeTimeout !== null) {
    window.clearTimeout(loaderFadeTimeout);
    loaderFadeTimeout = null;
  }

  const overlay = document.createElement('div');
  overlay.className = 'display-loading-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const viewport = document.createElement('div');
  viewport.className = 'display-loading-viewport';

  const video = document.createElement('video');
  video.className = 'display-loading-video';
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true; // Always muted for rapid tab transitions
  video.loop = true;
  video.preload = 'metadata';
  video.poster = loaderPoster;

  const mp4Source = document.createElement('source');
  mp4Source.src = loaderMp4;
  mp4Source.type = 'video/mp4';
  const webmSource = document.createElement('source');
  webmSource.src = loaderWebm;
  webmSource.type = 'video/webm';
  video.append(mp4Source, webmSource);

  const lens = document.createElement('div');
  lens.className = 'splash-lens';

  const banner = document.createElement('div');
  banner.className = 'display-loading-banner';
  banner.innerHTML = `
    <div class="display-loading-spinner"></div>
    <div class="display-loading-text">
      <span class="display-loading-title">${displayLabel}</span>
      <span class="display-loading-sub">Calibrating apparatus...</span>
    </div>
  `;

  viewport.append(video, lens, banner);
  overlay.append(viewport);
  document.body.appendChild(overlay);
  activeLoaderOverlay = overlay;

  video.play().catch(() => {
    // If video fails to load, fail silently
  });

  const startTime = Date.now();

  // Execute the DOM change
  performTransition();

  // Keep loader visible for minimum cinematic time, then fade smoothly
  const elapsed = Date.now() - startTime;
  const remaining = Math.max(0, minDurationMs - elapsed);

  loaderFadeTimeout = window.setTimeout(() => {
    overlay.classList.add('loading-fade-out');
    loaderFadeTimeout = window.setTimeout(() => {
      overlay.remove();
      if (activeLoaderOverlay === overlay) {
        activeLoaderOverlay = null;
      }
      loaderFadeTimeout = null;
    }, 350);
  }, remaining);
}

/**
 * Intro splash: skippable on any key/click/video end.
 * Skipped entirely for users who prefer reduced motion.
 */
import splashMp4 from '../media/how2soap-intro.mp4';
import splashWebm from '../media/how2soap-intro.webm';
import splashPoster from '../media/how2soap-poster.png';
import { audio } from '../ui/audio';

/**
 * Launch the intro splash on every startup. The world boots underneath it;
 * any click, keypress, or the video ending fades it out. Audio autoplay is
 * attempted and falls back to a muted play (browser autoplay policies).
 * Users who prefer reduced motion skip the splash entirely.
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
  video.preload = 'auto';
  video.poster = splashPoster;

  const mp4Source = document.createElement('source');
  mp4Source.src = splashMp4;
  mp4Source.type = 'video/mp4';
  const webmSource = document.createElement('source');
  webmSource.src = splashWebm;
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

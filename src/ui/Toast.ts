const MAX_VISIBLE = 3;
const TTL_MS = 3500;
let region: HTMLElement | null = null;

const ensureRegion = (): HTMLElement => {
  if (region?.isConnected) return region;
  region = document.createElement('div');
  region.className = 'toast-region';
  region.setAttribute('aria-live', 'polite');
  document.body.appendChild(region);
  return region;
};

export function showToast(
  message: string,
  kind: 'info' | 'success' | 'failure' | 'renown' = 'info',
): void {
  if (typeof document === 'undefined') return;
  const host = ensureRegion();
  while (host.children.length >= MAX_VISIBLE) {
    host.firstElementChild?.remove();
  }
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = message;
  host.appendChild(el);
  window.setTimeout(() => {
    el.remove();
  }, TTL_MS);
}

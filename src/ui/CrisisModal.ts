/**
 * Crisis Turns — resolution modal.
 *
 * Chained to the worker's CRISIS_SYNC message: appears when a crisis fires,
 * disappears when it resolves (answer or fate). Not dismissible by ESC —
 * a crisis is a question the world demands, not a popup.
 */
import type { CrisisActive } from '../engine/crisis';

let keyHandler: ((event: KeyboardEvent) => void) | null = null;

export function closeCrisisModal(): void {
  if (keyHandler) {
    document.removeEventListener('keydown', keyHandler, true);
    keyHandler = null;
  }
  document.querySelector('.crisis-overlay')?.remove();
}

export function openCrisisModal(
  active: CrisisActive,
  vesselCount: number,
  onChoice: (choiceId: string) => void,
): void {
  closeCrisisModal();

  const overlay = document.createElement('div');
  overlay.className = 'crisis-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'crisis-title');

  const choiceButtons = active.choices
    .map((choice, index) => {
      const disabled = choice.requiresOtherVessel && vesselCount < 2;
      return `<button type="button" class="crisis-choice" data-choice="${choice.id}"
        ${disabled ? 'disabled title="Needs a second vessel"' : ''}
        ${index === 0 ? 'data-autofocus="true"' : ''}>
        <span class="crisis-choice-label">${choice.label}</span>
        <small class="crisis-choice-detail">${choice.detail}${disabled ? ' · needs a second vessel' : ''}</small>
      </button>`;
    })
    .join('');

  overlay.innerHTML = `
    <div class="crisis-modal" role="document">
      <div class="crisis-sigil" aria-hidden="true">⚠</div>
      <h2 class="crisis-title" id="crisis-title">${active.title}</h2>
      <p class="crisis-description">${active.description}</p>
      <div class="crisis-choices" role="group" aria-label="Your answers">${choiceButtons}</div>
    </div>
  `;

  overlay.querySelectorAll<HTMLButtonElement>('.crisis-choice').forEach((button) => {
    button.addEventListener('click', () => {
      if (button.disabled) return;
      onChoice(button.dataset.choice!);
    });
  });

  // Focus trap: Tab cycles choices; Escape deliberately does nothing.
  keyHandler = (event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      const buttons = Array.from(
        overlay.querySelectorAll<HTMLButtonElement>('.crisis-choice:not(:disabled)'),
      );
      if (buttons.length === 0) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    } else if (event.key === 'Escape') {
      event.stopPropagation();
    }
  };
  document.addEventListener('keydown', keyHandler, true);

  document.body.appendChild(overlay);
  const autofocus = overlay.querySelector<HTMLButtonElement>('[data-autofocus]');
  (autofocus ?? overlay.querySelector<HTMLButtonElement>('.crisis-choice'))?.focus();
}

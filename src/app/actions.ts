/**
 * Bench action handlers shared by the inline summary rail and the Chemical
 * Workbench window. Single authority — never duplicate this mapping.
 */
import { SPECIES } from '../data/speciesRegistry';
import { TELEMETRY } from '../engine/memoryLayout';
import { predictEquilibriumTempK } from '../engine/chemistry';
import { state, send, selectedIndex } from './state';

export function applyBenchAction(action: string | undefined, button?: HTMLButtonElement): void {
  const vessel = state.vessels[selectedIndex()];
  if (!vessel) return;
  if (action === 'water') send({ type: 'ADD_WATER', vesselId: vessel.id, litres: 1 });
  if (action === 'ash') send({ type: 'ADD_ASH', vesselId: vessel.id, grams: 200 });
  if (action === 'tallow')
    send({
      type: 'ADD_SPECIES',
      vesselId: vessel.id,
      speciesIdx: SPECIES.TRISTEARIN,
      moles: 150 / 891.5,
    });
  if (action === 'salt')
    send({
      type: 'ADD_SPECIES',
      vesselId: vessel.id,
      speciesIdx: SPECIES.NACL,
      moles: 50 / 58.44,
    });
  if (action === 'heat') {
    const current = state.snapshot
      ? state.snapshot.telemetry[selectedIndex() * 8 + TELEMETRY.HEATER_W]
      : 0;
    send({ type: 'SET_HEATER', vesselId: vessel.id, watts: current > 0 ? 0 : 400 });
    if (button) button.classList.toggle('active', current === 0);
  }
  if (action === 'decant' || action === 'skim') {
    const select = (button?.closest('.actions') ?? document).querySelector<HTMLSelectElement>('#target, .target-select');
    const targetId = Number((select as HTMLSelectElement | null)?.value);
    if (targetId) {
      if (action === 'decant') send({ type: 'DECANT', fromId: vessel.id, toId: targetId, litres: 1 });
      else send({ type: 'SKIM', fromId: vessel.id, toId: targetId, speciesIdx: SPECIES.NA_STEARATE });
    }
  }
}

/** Wire the bench's sliders, selects and quick-add buttons inside `root` (idempotent). */
export function bindBenchControls(root: ParentNode): void {
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    button.addEventListener('click', () => applyBenchAction(button.dataset.action, button));
  });

  const heaterSlider = root.querySelector<HTMLInputElement>('.heater-slider');
  const valHeaterW = root.querySelector<HTMLElement>('.val-heater-w');
  const heaterTeqPreview = root.querySelector<HTMLElement>('.heater-teq-preview');
  if (heaterSlider) {
    heaterSlider.addEventListener('input', () => {
      const vessel = state.vessels[selectedIndex()];
      if (!vessel) return;
      const watts = Number(heaterSlider.value);
      if (valHeaterW) valHeaterW.textContent = String(watts);
      const ambK = state.player.ambientTempK ?? 288.15;
      const estTeq = Math.round(predictEquilibriumTempK(vessel.material as any, watts, ambK));
      if (heaterTeqPreview) heaterTeqPreview.textContent = `(Eq: ~${estTeq} K)`;
      send({ type: 'SET_HEATER', vesselId: vessel.id, watts });
    });
  }

  const voltsSlider = root.querySelector<HTMLInputElement>('.volts-slider');
  const valVolts = root.querySelector<HTMLElement>('.val-volts');
  if (voltsSlider) {
    voltsSlider.addEventListener('input', () => {
      const vessel = state.vessels[selectedIndex()];
      if (!vessel) return;
      const volts = Number(voltsSlider.value);
      if (valVolts) valVolts.textContent = volts.toFixed(1);
      send({ type: 'SET_VOLTS', vesselId: vessel.id, volts });
    });
  }

  const condenserSelect = root.querySelector<HTMLSelectElement>('.condenser-target-select');
  if (condenserSelect) {
    condenserSelect.addEventListener('change', () => {
      const vessel = state.vessels[selectedIndex()];
      if (!vessel) return;
      const targetId = Number(condenserSelect.value);
      send({ type: 'SET_CONDENSER', vesselId: vessel.id, targetId });
    });
  }

  const btnToggleLid = root.querySelector<HTMLButtonElement>('.btn-toggle-lid');
  if (btnToggleLid) {
    btnToggleLid.addEventListener('click', () => {
      const vessel = state.vessels[selectedIndex()];
      if (!vessel) return;
      vessel.closed = !vessel.closed;
      btnToggleLid.textContent = vessel.closed ? 'Lid: Sealed' : 'Lid: Open';
      send({ type: 'SET_CLOSED', vesselId: vessel.id, closed: vessel.closed });
    });
  }
}

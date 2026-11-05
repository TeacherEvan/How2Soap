import './soapKettle.css';
import { SoapKettleMiniGame, type KettleBatchResult } from './SoapKettleMiniGame';
import { state } from '../app/state';

export function mountSoapKettleModal(
  container: HTMLElement,
  onComplete: (result: KettleBatchResult) => void,
  onClose: () => void,
): void {
  const modal = document.createElement('div');
  modal.className = 'soap-kettle-modal-overlay';
  modal.innerHTML = `
    <div class="soap-kettle-panel">
      <div class="kettle-header">
        <h3>Interactive Soap Kettle</h3>
        <button class="btn-close-kettle">&times;</button>
      </div>
      <div class="kettle-body">
        <div class="kettle-status-banner">Prepare your soap batch!</div>
        <div class="kettle-gauges">
          <div class="gauge-col" id="col-pour">
            <h4>1. Pouring Mix</h4>
            <div class="pour-track"><div class="pour-fill-lye" style="height:0%"></div><div class="pour-fill-fat" style="height:0%"></div><div class="pour-target-band"></div></div>
            <div class="pour-buttons">
              <button id="btn-pour-lye" class="btn-dock">Hold: Lye</button>
              <button id="btn-pour-fat" class="btn-dock">Hold: Fat</button>
            </div>
          </div>
          <div class="gauge-col" id="col-heat">
            <h4>2. Bellows & Heat</h4>
            <div class="thermo-track"><div class="thermo-fill" style="height:25%"></div><div class="thermo-target-band" title="80-95 C"></div></div>
            <div class="heat-readout">25 °C</div>
            <div class="heat-buttons">
              <button id="btn-pump-bellows" class="btn-dock">Pump Bellows (+12°C)</button>
              <button id="btn-splash-water" class="btn-dock">Cool Water (-20°C)</button>
            </div>
          </div>
          <div class="gauge-col" id="col-stir">
            <h4>3. Stir to Trace</h4>
            <div class="stir-circle" id="stir-target"><div class="stir-paddle"></div></div>
            <div class="stir-readout">Trace: 0%</div>
            <button id="btn-stir" class="btn-dock">Stir Paddle</button>
          </div>
        </div>
      </div>
    </div>
  `;

  container.appendChild(modal);

  const game = new SoapKettleMiniGame((result) => {
    statusBanner.textContent = result.message;
    statusBanner.className = `kettle-status-banner status-${result.quality.toLowerCase()}`;
    setTimeout(() => {
      onComplete(result);
      modal.remove();
    }, 1800);
  });
  // Apply ES-3 coupling effects
  if (state.couplingEffects) {
    game.applyCouplingEffects(state.couplingEffects);
  }
  // Set spoilage RNG seed for unrest spoilage rolls
  if (state.couplingSpoilageSeed !== undefined) {
    game.setSpoilageSeed(state.couplingSpoilageSeed);
  }
  game.startBatch();

  const statusBanner = modal.querySelector('.kettle-status-banner') as HTMLElement;
  const lyeFill = modal.querySelector('.pour-fill-lye') as HTMLElement;
  const fatFill = modal.querySelector('.pour-fill-fat') as HTMLElement;
  const thermoFill = modal.querySelector('.thermo-fill') as HTMLElement;
  const heatReadout = modal.querySelector('.heat-readout') as HTMLElement;
  const stirReadout = modal.querySelector('.stir-readout') as HTMLElement;
  const stirPaddle = modal.querySelector('.stir-paddle') as HTMLElement;

  modal.querySelector('.btn-close-kettle')?.addEventListener('click', () => {
    onClose();
    modal.remove();
  });

  const btnPourLye = modal.querySelector('#btn-pour-lye') as HTMLButtonElement;
  const btnPourFat = modal.querySelector('#btn-pour-fat') as HTMLButtonElement;
  btnPourLye?.addEventListener('mousedown', () => { game.isPouringLye = true; });
  btnPourLye?.addEventListener('mouseup', () => { game.isPouringLye = false; });
  btnPourFat?.addEventListener('mousedown', () => { game.isPouringFat = true; });
  btnPourFat?.addEventListener('mouseup', () => { game.isPouringFat = false; });

  modal.querySelector('#btn-pump-bellows')?.addEventListener('click', () => {
    game.pumpBellows();
  });
  modal.querySelector('#btn-splash-water')?.addEventListener('click', () => {
    game.splashWater();
  });

  let angle = 0;
  modal.querySelector('#btn-stir')?.addEventListener('click', () => {
    game.stirStroke();
    angle += 45;
    if (stirPaddle) stirPaddle.style.transform = `rotate(${angle}deg)`;
  });

  const loop = () => {
    if (!modal.isConnected) return;
    game.step();

    // Update visuals
    if (lyeFill) lyeFill.style.height = `${game.lyeVolume}%`;
    if (fatFill) fatFill.style.height = `${game.fatVolume}%`;
    const thermoPct = Math.min(100, Math.max(0, (game.temperatureC / 130) * 100));
    if (thermoFill) thermoFill.style.height = `${thermoPct}%`;
    if (heatReadout) {
      heatReadout.textContent = `${Math.round(game.temperatureC)} °C ${game.isBoilingOver ? '⚠️ BOILOVER!' : ''}`;
      heatReadout.style.color = game.isBoilingOver ? '#ff5252' : game.temperatureC >= 80 && game.temperatureC <= 98 ? '#4caf50' : '#ffd166';
    }
    if (stirReadout) stirReadout.textContent = `Trace: ${Math.round(game.tracePct)}%`;

    if (game.phase === 'POURING') {
      statusBanner.textContent = 'Hold Lye & Fat buttons to fill 50/50 mix!';
    } else if (game.phase === 'HEATING') {
      statusBanner.textContent = `Heat saponification progress: ${Math.round(game.heatProgressPct)}% (Keep 80-95°C!)`;
    } else if (game.phase === 'STIRRING') {
      statusBanner.textContent = 'Mix heated! Click Stir Paddle to bring soap to trace!';
    }

    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

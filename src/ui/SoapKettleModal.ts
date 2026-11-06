import './soapKettle.css';
import { SoapKettleMiniGame, type KettleBatchResult } from './SoapKettleMiniGame';
import { recordLabTrial } from './JournalPanel';
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

  let animId: number | null = null;

  const cleanupAndClose = (callback?: () => void) => {
    if (animId !== null) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    callback?.();
    modal.remove();
  };

  const game = new SoapKettleMiniGame((result) => {
    statusBanner.textContent = result.message;
    statusBanner.className = `kettle-status-banner status-${result.quality.toLowerCase()}`;
    recordLabTrial({
      vesselName: 'Soap Kettle Batch',
      tempK: game.temperatureC + 273.15,
      // The kettle mini-game does not model batter pH; record the canonical
      // soap batter value (~9.5, mildly alkaline) as a labelled estimate.
      ph: 9.5,
      phEstimated: true,
      reagents: `Lye: ${Math.round(game.lyeVolume)}% · Fat: ${Math.round(game.fatVolume)}%`,
      notes: `${result.quality} Quality (${result.soapYield} bars) - ${result.message}`,
    });
    setTimeout(() => {
      cleanupAndClose(() => onComplete(result));
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
    cleanupAndClose(onClose);
  });

  const btnPourLye = modal.querySelector('#btn-pour-lye') as HTMLButtonElement;
  const btnPourFat = modal.querySelector('#btn-pour-fat') as HTMLButtonElement;
  // Pointer Events cover mouse, touch and pen. Hold-to-pour must stop on release,
  // pointer cancel, or when the pointer leaves the button — otherwise the fill
  // flag sticks and the vessel keeps charging.
  const bindHoldButton = (btn: HTMLButtonElement | null, setFlag: (v: boolean) => void) => {
    if (!btn) return;
    btn.style.touchAction = 'none';
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      setFlag(true);
      try { btn.setPointerCapture(e.pointerId); } catch { /* capture unavailable */ }
    });
    const stop = () => setFlag(false);
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('lostpointercapture', stop);
    btn.addEventListener('pointerleave', stop);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  };
  bindHoldButton(btnPourLye, (v) => { game.isPouringLye = v; });
  bindHoldButton(btnPourFat, (v) => { game.isPouringFat = v; });

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

  let lastLyeRound = -1;
  let lastFatRound = -1;
  let lastThermoRound = -1;

  const loop = () => {
    if (!modal.isConnected) {
      if (animId !== null) {
        cancelAnimationFrame(animId);
        animId = null;
      }
      return;
    }
    game.step();

    // Update visuals with integer throttling
    const curLyeRound = Math.round(game.lyeVolume);
    if (lyeFill && curLyeRound !== lastLyeRound) {
      lyeFill.style.height = `${curLyeRound}%`;
      lastLyeRound = curLyeRound;
    }

    const curFatRound = Math.round(game.fatVolume);
    if (fatFill && curFatRound !== lastFatRound) {
      fatFill.style.height = `${curFatRound}%`;
      lastFatRound = curFatRound;
    }

    const thermoPct = Math.min(100, Math.max(0, (game.temperatureC / 130) * 100));
    const curThermoRound = Math.round(thermoPct);
    if (thermoFill && curThermoRound !== lastThermoRound) {
      thermoFill.style.height = `${curThermoRound}%`;
      lastThermoRound = curThermoRound;
    }
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

    animId = requestAnimationFrame(loop);
  };
  animId = requestAnimationFrame(loop);
}

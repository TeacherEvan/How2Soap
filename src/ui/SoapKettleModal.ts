import './soapKettle.css';
import { SoapKettleMiniGame, type KettleBatchResult, type KettleDriveState } from './SoapKettleMiniGame';
import { recordLabTrial } from './JournalPanel';
import { state } from '../app/state';
import { MAX_SPECIES } from '../engine/memoryLayout';
import type { VesselState } from '../engine/chemistry';

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
        <div class="kettle-bench-host" data-testid="kettle-bench-3d" aria-label="3D kettle diorama" style="height:140px;min-height:140px;margin-bottom:12px;border-radius:8px;overflow:hidden;background:#151922;border:1px solid #5a4628;"></div>
        <div class="kettle-gauges">
          <div class="gauge-col" id="col-pour">
            <h4>1. Pouring Mix</h4>
            <div class="pour-track"><div class="pour-fill-lye" style="height:0%"></div><div class="pour-fill-fat" style="height:0%"></div><div class="pour-target-band"></div><div class="pour-stream" style="position:absolute;left:50%;top:0;width:3px;height:100%;margin-left:-1.5px;background:linear-gradient(#5aa5ff,#5aa5ff);opacity:0;transform-origin:top center;pointer-events:none;"></div></div>
            <div class="pour-buttons">
              <button id="btn-pour-lye" class="btn-dock">Hold: Lye</button>
              <button id="btn-pour-fat" class="btn-dock">Hold: Fat</button>
            </div>
          </div>
          <div class="gauge-col" id="col-heat">
            <h4>2. Bellows & Heat</h4>
            <div class="thermo-track"><div class="thermo-glow" style="position:absolute;inset:0;background:#ff5722;opacity:0;pointer-events:none;"></div><div class="thermo-fill" style="height:25%"></div><div class="thermo-target-band" title="80-95 C"></div></div>
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

  // M1 Task 9: LabBench3DCanvas driven by KettleState (dynamic import keeps
  // the entrypoint lean — sprite-free procedural drive, no PNG import).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let kettleBench: { render(vessels: VesselState[], selectedId: number, kettle: KettleDriveState | null): void; destroy(): void } | null = null;
  const benchHost = modal.querySelector<HTMLElement>('.kettle-bench-host');
  if (benchHost) {
    import('./gl/LabBench3DCanvas')
      .then(({ LabBench3DCanvas }) => {
        if (!benchHost.isConnected) return;
        kettleBench = new LabBench3DCanvas(
          benchHost,
          // The kettle has a single vessel — selection is a no-op here.
          {},
        ) as never;
      })
      .catch(() => {
        kettleBench = null;
      });
  }

  const reducedMotion = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let animId: number | null = null;

  const cleanupAndClose = (callback?: () => void) => {
    if (animId !== null) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    if (kettleBench) {
      kettleBench.destroy();
      kettleBench = null;
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
  const pourStream = modal.querySelector('.pour-stream') as HTMLElement | null;
  const thermoFill = modal.querySelector('.thermo-fill') as HTMLElement;
  const thermoGlow = modal.querySelector('.thermo-glow') as HTMLElement | null;
  const stirCircle = modal.querySelector('.stir-circle') as HTMLElement | null;
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

    // M1 Task 9 — LabBench experiment drive from KettleState (visual only).
    // Compositor-only DOM feedback (transform/opacity); the 3D drive lives in
    // LabBench3DCanvas with expDecay/spring blends in seconds.
    const drive = game.getVisualState();
    if (pourStream) {
      const pouring = drive.phase === 'POURING';
      pourStream.style.opacity = pouring ? '0.85' : '0';
      const pourFrac = Math.min(1, Math.max(0, (drive.lyeVolume + drive.fatVolume) / 200));
      pourStream.style.transform = reducedMotion
        ? `scaleY(${pourFrac})`
        : `scaleY(${pourFrac})`;
      pourStream.style.background = drive.lyeVolume >= drive.fatVolume
        ? 'linear-gradient(#5aa5ff,#5aa5ff)'
        : 'linear-gradient(#ffd166,#ffd166)';
    }
    if (thermoGlow) {
      const tempNorm = Math.min(1, Math.max(0, (drive.temperatureC - 25) / 100));
      const heaterNorm = Math.min(1, drive.heaterWatts / 400);
      thermoGlow.style.opacity = String(Math.min(0.55, (0.65 * heaterNorm + 0.35 * tempNorm) * 0.55));
    }
    if (stirCircle) {
      const vortex = drive.phase === 'STIRRING' ? Math.min(1, Math.max(0, drive.tracePct / 100)) : 0;
      const deg = reducedMotion ? vortex * 180 : vortex * 360;
      stirCircle.style.transform = `rotate(${deg}deg)`;
    }
    // Boilover shake (transform-only; frozen for reduced-motion).
    const panel = modal.querySelector('.soap-kettle-panel') as HTMLElement | null;
    if (panel) {
      if (!reducedMotion && drive.isBoilingOver) {
        const amp = Math.min(1, Math.max(0, (drive.temperatureC - 105) / 25));
        const shift = Math.sin(performance.now() / 16) * amp * 3;
        panel.style.transform = `translateX(${shift.toFixed(2)}px)`;
      } else if (panel.style.transform) {
        panel.style.transform = '';
      }
    }

    if (kettleBench) {
      const synthVessel: VesselState = {
        id: 0,
        material: 'FIRED_CERAMIC',
        capacityL: 5,
        headspaceClosed: false,
        temperatureK: drive.temperatureC + 273.15,
        moles: new Float64Array(MAX_SPECIES),
        precipitated: new Float64Array(MAX_SPECIES),
        heaterWatts: drive.heaterWatts,
        condenserTargetVesselId: -1,
        pressureKPa: 101.325,
        ruptured: false,
        appliedVolts: 0,
        cellResistanceOhm: 10,
      };
      kettleBench.render([synthVessel], 0, drive);
    }

    animId = requestAnimationFrame(loop);
  };
  animId = requestAnimationFrame(loop);
}

/**
 * Main Application Controller for Protein Trafficking Simulator
 * Coordinates DOM controls, three adjustable sliders, preset buttons,
 * telemetry indicators, and the 60 FPS animation loop.
 */

document.addEventListener('DOMContentLoaded', () => {
  const engine = window.simulationEngine;
  const sound = window.soundEngine;

  // Canvas & Renderer Initialization
  const canvas = document.getElementById('cellCanvas');
  const renderer = new CellRenderer(canvas);

  window.addEventListener('resize', () => {
    renderer.resize();
  });

  // DOM Elements: Exactly Three Adjustable Sliders
  const speedSlider = document.getElementById('speedSlider');
  const speedVal = document.getElementById('speedVal');

  const erFoldingSlider = document.getElementById('erFoldingSlider');
  const erFoldingVal = document.getElementById('erFoldingVal');

  const golgiRateSlider = document.getElementById('golgiRateSlider');
  const golgiRateVal = document.getElementById('golgiRateVal');

  // DOM Elements: Playback Controls
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playPauseIcon = document.getElementById('playPauseIcon');
  const playPauseText = document.getElementById('playPauseText');
  const restartBtn = document.getElementById('restartBtn');
  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundIcon = document.getElementById('soundIcon');

  // DOM Elements: Presets
  const presetBtns = {
    normal: document.getElementById('presetNormal'),
    misfolding: document.getElementById('presetMisfolding'),
    reduced: document.getElementById('presetReduced')
  };

  // DOM Elements: Telemetry & Stage Tracker
  const stageSteps = document.querySelectorAll('.stage-step');
  const statTime = document.getElementById('statTime');
  const statConformation = document.getElementById('statConformation');
  const statSecreted = document.getElementById('statSecreted');
  const statErad = document.getElementById('statErad');
  const logStream = document.getElementById('logStream');

  // --- Slider Event Handlers ---

  function updateSliderUI(param, value) {
    if (param === 'transportSpeed') {
      speedSlider.value = value;
      speedVal.textContent = `${value}%`;
    } else if (param === 'erFoldingEfficiency') {
      erFoldingSlider.value = value;
      erFoldingVal.textContent = `${value}%`;
    } else if (param === 'golgiProcessingRate') {
      golgiRateSlider.value = value;
      golgiRateVal.textContent = `${value}%`;
    }
    clearPresetActiveState();
  }

  speedSlider.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    speedVal.textContent = `${val}%`;
    engine.setTransportSpeed(val);
    clearPresetActiveState();
  });

  erFoldingSlider.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    erFoldingVal.textContent = `${val}%`;
    engine.setErFoldingEfficiency(val);
    clearPresetActiveState();
  });

  golgiRateSlider.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    golgiRateVal.textContent = `${val}%`;
    engine.setGolgiProcessingRate(val);
    clearPresetActiveState();
  });

  // Listen to engine parameter changes (e.g. from presets)
  engine.on('parameterChange', ({ param, value }) => {
    updateSliderUI(param, value);
  });

  // --- Preset Handlers ---

  function clearPresetActiveState() {
    Object.values(presetBtns).forEach(b => b.classList.remove('active'));
  }

  function setActivePreset(key) {
    clearPresetActiveState();
    if (presetBtns[key]) {
      presetBtns[key].classList.add('active');
    }
    engine.applyPreset(key);
  }

  presetBtns.normal.addEventListener('click', () => setActivePreset('normal'));
  presetBtns.misfolding.addEventListener('click', () => setActivePreset('misfolding'));
  presetBtns.reduced.addEventListener('click', () => setActivePreset('reduced'));

  // --- Playback Controls ---

  playPauseBtn.addEventListener('click', () => {
    sound.ensureContext();
    if (engine.state === 'running') {
      engine.pause();
    } else if (engine.state === 'paused') {
      engine.resume();
    } else {
      engine.start();
    }
  });

  restartBtn.addEventListener('click', () => {
    sound.ensureContext();
    engine.restart();
  });

  soundToggleBtn.addEventListener('click', () => {
    sound.ensureContext();
    const muted = sound.toggleMute();
    soundIcon.textContent = muted ? '🔇' : '🔊';
    soundToggleBtn.title = muted ? 'Unmute Audio' : 'Mute Audio';
  });

  // Update play/pause button state
  engine.on('stateChange', ({ state }) => {
    if (state === 'running') {
      playPauseIcon.textContent = '⏸';
      playPauseText.textContent = 'Pause';
    } else {
      playPauseIcon.textContent = '▶';
      playPauseText.textContent = 'Resume';
    }
  });

  // --- Stage Tracker & Telemetry Updates ---

  engine.on('stageChange', ({ stage }) => {
    stageSteps.forEach(step => {
      const stepId = step.dataset.stage;
      if (stepId === stage.id) {
        step.classList.add('active');
      } else {
        step.classList.remove('active');
      }
    });
  });

  // Log message stream append
  engine.on('log', (logEntry) => {
    const el = document.createElement('div');
    el.className = `log-entry ${logEntry.type}`;
    el.innerHTML = `<span class="log-time">[${logEntry.time}]</span> ${logEntry.message}`;
    logStream.appendChild(el);
    logStream.scrollTop = logStream.scrollHeight;
  });

  // --- 60 FPS Main Animation Loop ---

  let lastTime = performance.now();

  function animate(now) {
    const deltaSeconds = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    // Update simulation state
    engine.update(deltaSeconds);

    // Update real-time telemetry metrics
    statTime.textContent = `${engine.metrics.totalTime.toFixed(1)}s`;
    statSecreted.textContent = engine.metrics.successCount;
    statErad.textContent = engine.metrics.eradCount;

    const conf = engine.protein.conformation;
    statConformation.textContent = conf.charAt(0).toUpperCase() + conf.slice(1);
    statConformation.className = 'value ' + (
      conf === 'folded' || conf === 'glycosylated' ? 'success' :
      conf === 'misfolded' || conf === 'degraded' ? 'warning' : 'active'
    );

    // Render frame
    renderer.render(engine, now);

    requestAnimationFrame(animate);
  }

  // Set initial preset & start running
  setActivePreset('normal');
  engine.start();
  requestAnimationFrame(animate);
});

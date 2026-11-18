/**
 * Simulation Engine for Protein Trafficking Simulator
 * Manages cellular state machine, 3 adjustable parameters, pathway physics,
 * ER quality control (ERAD), and Golgi kinetics.
 */

const STAGES = {
  TRANSLATION: {
    id: 'translation',
    name: 'Ribosomal Translation & Translocation',
    organelle: 'rough_er',
    description: 'mRNA is translated at membrane-bound ribosomes; nascent polypeptide enters the Rough ER lumen via translocon channel.'
  },
  ER_FOLDING: {
    id: 'er_folding',
    name: 'Rough ER Folding & Quality Control',
    organelle: 'rough_er',
    description: 'BiP/Hsp70 and calnexin chaperones assist native folding. Folding efficiency determines native conformation vs. misfolding.'
  },
  ERAD: {
    id: 'erad',
    name: 'ER-Associated Degradation (ERAD)',
    organelle: 'proteasome',
    description: 'Misfolded aggregates trigger ER quality control, retrotranslocation to cytosol, polyubiquitination, and 26S proteasome degradation.'
  },
  COPII_TRANSPORT: {
    id: 'copii_transport',
    name: 'COPII Vesicular Transport',
    organelle: 'vesicle_copii',
    description: 'Properly folded proteins bud from ER Exit Sites (ERES) in COPII-coated vesicles and travel along microtubules toward cis-Golgi.'
  },
  GOLGI_PROCESSING: {
    id: 'golgi_processing',
    name: 'Golgi Post-Translational Processing',
    organelle: 'golgi',
    description: 'Traverses cis, medial, and trans cisternae. Undergoes sequential glycosylation trimming and oligosaccharide arborization.'
  },
  SECRETORY_VESICLE: {
    id: 'secretory_vesicle',
    name: 'Secretory Vesicle Trafficking',
    organelle: 'vesicle_secretory',
    description: 'Sorted at Trans-Golgi Network (TGN), packaged into secretory vesicle, and driven toward the plasma membrane by kinesin motors.'
  },
  EXOCYTOSIS: {
    id: 'exocytosis',
    name: 'SNARE Docking & Exocytosis',
    organelle: 'plasma_membrane',
    description: 'v-SNARE and t-SNARE complexes drive lipid bilayer fusion, secreting the mature functional protein into extracellular space.'
  },
  COMPLETED: {
    id: 'completed',
    name: 'Trafficking Cycle Concluded',
    organelle: null,
    description: 'Cycle complete. A new nascent polypeptide can be synthesized or looped.'
  }
};

const PRESETS = {
  normal: {
    name: 'Normal Protein Transport',
    transportSpeed: 80,
    erFoldingEfficiency: 95,
    golgiProcessingRate: 85,
    description: 'Optimal physiologic conditions: high folding fidelity, rapid microtubule transport, and efficient Golgi modification.'
  },
  misfolding: {
    name: 'ER Protein Misfolding',
    transportSpeed: 70,
    erFoldingEfficiency: 15,
    golgiProcessingRate: 80,
    description: 'Cellular stress / genetic mutation: nascent chains fail chaperone folding and are redirected to ERAD proteasomal destruction.'
  },
  reduced: {
    name: 'Reduced Transport Efficiency',
    transportSpeed: 25,
    erFoldingEfficiency: 85,
    golgiProcessingRate: 30,
    description: 'Hypothermic or transport-inhibited state: sluggish motor transport along microtubules and extended Golgi residence dwell time.'
  }
};

class SimulationEngine {
  constructor() {
    // Exactly THREE adjustable parameters
    this.params = {
      transportSpeed: 80,        // 10% – 100%
      erFoldingEfficiency: 95,    // 0% – 100%
      golgiProcessingRate: 85     // 10% – 100%
    };

    // State machine
    this.state = 'idle'; // 'idle', 'running', 'paused', 'completed'
    this.currentStage = STAGES.TRANSLATION;
    this.stageProgress = 0.0; // 0.0 to 1.0 within current stage

    // Protein attributes
    this.protein = {
      x: 0,
      y: 0,
      conformation: 'unfolded', // 'unfolded', 'folded', 'misfolded', 'glycosylated', 'degraded'
      ubiquitinated: false,
      glycosylationProgress: 0.0,
      radius: 12
    };

    // Telemetry & metrics
    this.metrics = {
      totalTime: 0,
      cycleCount: 0,
      successCount: 0,
      eradCount: 0,
      activeOrganelle: 'rough_er'
    };

    // Event listeners
    this.listeners = {
      stageChange: [],
      log: [],
      parameterChange: [],
      stateChange: []
    };

    // Auto loop flag
    this.autoLoop = true;
    this.stageDwellTimer = 0;
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try { cb(data); } catch (e) { console.error(e); }
      });
    }
  }

  log(message, type = 'info') {
    this.emit('log', {
      time: (this.metrics.totalTime).toFixed(1) + 's',
      stage: this.currentStage.name,
      message,
      type
    });
  }

  // --- Parameter controls ---

  setTransportSpeed(val) {
    const clamped = Math.max(10, Math.min(100, Number(val)));
    this.params.transportSpeed = clamped;
    this.emit('parameterChange', { param: 'transportSpeed', value: clamped });
  }

  setErFoldingEfficiency(val) {
    const clamped = Math.max(0, Math.min(100, Number(val)));
    this.params.erFoldingEfficiency = clamped;
    this.emit('parameterChange', { param: 'erFoldingEfficiency', value: clamped });
  }

  setGolgiProcessingRate(val) {
    const clamped = Math.max(10, Math.min(100, Number(val)));
    this.params.golgiProcessingRate = clamped;
    this.emit('parameterChange', { param: 'golgiProcessingRate', value: clamped });
  }

  applyPreset(presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return;

    this.setTransportSpeed(preset.transportSpeed);
    this.setErFoldingEfficiency(preset.erFoldingEfficiency);
    this.setGolgiProcessingRate(preset.golgiProcessingRate);

    this.log(`Preset loaded: "${preset.name}". Speed=${preset.transportSpeed}%, ER Folding=${preset.erFoldingEfficiency}%, Golgi Rate=${preset.golgiProcessingRate}%.`, 'preset');
  }

  // --- Playback controls ---

  start() {
    if (this.state === 'running') return;
    this.state = 'running';
    this.emit('stateChange', { state: this.state });
    if (this.currentStage === STAGES.TRANSLATION && this.stageProgress === 0) {
      this.log('Translation initiated at membrane-bound ribosome.', 'action');
      if (window.soundEngine) window.soundEngine.playTranslation();
    }
  }

  pause() {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.emit('stateChange', { state: this.state });
    this.log('Simulation paused.', 'info');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'running';
    this.emit('stateChange', { state: this.state });
    this.log('Simulation resumed.', 'info');
  }

  restart() {
    this.currentStage = STAGES.TRANSLATION;
    this.stageProgress = 0.0;
    this.stageDwellTimer = 0;
    this.protein.conformation = 'unfolded';
    this.protein.ubiquitinated = false;
    this.protein.glycosylationProgress = 0.0;
    this.metrics.totalTime = 0;
    this.metrics.activeOrganelle = 'rough_er';
    this.state = 'running';

    this.emit('stageChange', { stage: this.currentStage });
    this.emit('stateChange', { state: this.state });
    this.log('Simulation restarted from ribosomal synthesis.', 'action');
    if (window.soundEngine) window.soundEngine.playTranslation();
  }

  // --- State Machine Transitions ---

  setStage(stage) {
    this.currentStage = stage;
    this.stageProgress = 0.0;
    this.stageDwellTimer = 0;
    this.metrics.activeOrganelle = stage.organelle;
    this.emit('stageChange', { stage });

    // Trigger stage-specific biological events and sound synthesis
    switch (stage.id) {
      case 'translation':
        this.protein.conformation = 'unfolded';
        this.protein.ubiquitinated = false;
        this.protein.glycosylationProgress = 0.0;
        this.log('mRNA translation: nascent polypeptide synthesized.', 'stage');
        if (window.soundEngine) window.soundEngine.playTranslation();
        break;

      case 'er_folding':
        this.log('Chaperone-mediated folding in ER lumen underway.', 'stage');
        break;

      case 'copii_transport':
        this.log('COPII vesicle budding from ER Exit Sites (ERES). Heading to cis-Golgi.', 'stage');
        if (window.soundEngine) window.soundEngine.playVesicleBud();
        break;

      case 'golgi_processing':
        this.log('Entered cis-Golgi. Post-translational modification initiated.', 'stage');
        if (window.soundEngine) window.soundEngine.playGolgiProcess();
        break;

      case 'secretory_vesicle':
        this.log('Matured at trans-Golgi network. Packaging into secretory vesicle.', 'stage');
        if (window.soundEngine) window.soundEngine.playVesicleBud();
        break;

      case 'exocytosis':
        this.log('Vesicle docked at plasma membrane. v/t-SNARE fusion triggered.', 'stage');
        if (window.soundEngine) window.soundEngine.playExocytosis();
        break;

      case 'erad':
        this.protein.ubiquitinated = true;
        this.log('ER Quality Control: Unfolded Protein Response / ERAD triggered!', 'warning');
        if (window.soundEngine) window.soundEngine.playMisfold();
        break;

      case 'completed':
        this.metrics.cycleCount++;
        if (this.protein.conformation === 'folded' || this.protein.conformation === 'glycosylated') {
          this.metrics.successCount++;
          this.log('Protein successfully secreted into extracellular space!', 'success');
        } else {
          this.metrics.eradCount++;
          this.log('Misfolded protein safely degraded by 26S proteasome.', 'warning');
        }
        break;
    }
  }

  // --- Main Tick Update Loop (invoked at 60 FPS) ---

  update(deltaSeconds) {
    if (this.state !== 'running') return;

    this.metrics.totalTime += deltaSeconds;

    // Movement speed multiplier: Transport Speed (10 - 100%)
    const transportMultiplier = this.params.transportSpeed / 50.0; // 0.2 to 2.0x

    // Golgi rate multiplier: Golgi Processing Rate (10 - 100%)
    const golgiMultiplier = this.params.golgiProcessingRate / 50.0; // 0.2 to 2.0x

    switch (this.currentStage.id) {
      case 'translation': {
        // Translation duration scaled by transport speed
        const speed = 0.45 * transportMultiplier;
        this.stageProgress += deltaSeconds * speed;
        if (this.stageProgress >= 1.0) {
          this.setStage(STAGES.ER_FOLDING);
        }
        break;
      }

      case 'er_folding': {
        // Chaperone folding progression
        const speed = 0.5 * transportMultiplier;
        this.stageProgress += deltaSeconds * speed;

        if (this.stageProgress >= 1.0) {
          // DECISION POINT: ER Folding Efficiency
          // Probability check: 0 - 100%
          const roll = Math.random() * 100;
          const isSuccess = roll < this.params.erFoldingEfficiency;

          if (isSuccess) {
            this.protein.conformation = 'folded';
            this.log(`ER Quality Control: Folding SUCCESS (${roll.toFixed(1)}% < ${this.params.erFoldingEfficiency}%). Native tertiary conformation achieved.`, 'success');
            if (window.soundEngine) window.soundEngine.playFoldSuccess();
            this.setStage(STAGES.COPII_TRANSPORT);
          } else {
            this.protein.conformation = 'misfolded';
            this.log(`ER Quality Control: Folding FAILED (${roll.toFixed(1)}% >= ${this.params.erFoldingEfficiency}%). Hydrophobic patches exposed. Target for ERAD!`, 'error');
            this.setStage(STAGES.ERAD);
          }
        }
        break;
      }

      case 'erad': {
        // Transport to proteasome and degradation
        const speed = 0.4 * transportMultiplier;
        this.stageProgress += deltaSeconds * speed;

        if (this.stageProgress >= 0.7 && !this.protein.degradedSoundPlayed) {
          this.protein.degradedSoundPlayed = true;
          if (window.soundEngine) window.soundEngine.playDegradation();
        }

        if (this.stageProgress >= 1.0) {
          this.protein.conformation = 'degraded';
          this.setStage(STAGES.COMPLETED);
        }
        break;
      }

      case 'copii_transport': {
        // Vesicular transport from ER to Golgi along microtubule track
        const speed = 0.5 * transportMultiplier;
        this.stageProgress += deltaSeconds * speed;
        if (this.stageProgress >= 1.0) {
          this.setStage(STAGES.GOLGI_PROCESSING);
        }
        break;
      }

      case 'golgi_processing': {
        // Processing duration strictly controlled by Golgi Processing Rate
        const speed = 0.35 * golgiMultiplier;
        this.stageProgress += deltaSeconds * speed;
        this.protein.glycosylationProgress = Math.min(1.0, this.stageProgress);

        if (this.stageProgress >= 1.0) {
          this.protein.conformation = 'glycosylated';
          this.log('Oligosaccharide arborization & sorting complete at trans-Golgi network.', 'stage');
          this.setStage(STAGES.SECRETORY_VESICLE);
        }
        break;
      }

      case 'secretory_vesicle': {
        // Vesicle transport from trans-Golgi to Plasma Membrane
        const speed = 0.5 * transportMultiplier;
        this.stageProgress += deltaSeconds * speed;
        if (this.stageProgress >= 1.0) {
          this.setStage(STAGES.EXOCYTOSIS);
        }
        break;
      }

      case 'exocytosis': {
        // Membrane fusion and secretion
        const speed = 0.55 * transportMultiplier;
        this.stageProgress += deltaSeconds * speed;
        if (this.stageProgress >= 1.0) {
          this.setStage(STAGES.COMPLETED);
        }
        break;
      }

      case 'completed': {
        // Brief pause before automatically looping to show continuous trafficking
        this.stageDwellTimer += deltaSeconds;
        if (this.autoLoop && this.stageDwellTimer >= 1.8) {
          this.restart();
        }
        break;
      }
    }
  }
}

window.simulationEngine = new SimulationEngine();

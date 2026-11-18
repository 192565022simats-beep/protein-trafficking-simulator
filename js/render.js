/**
 * Canvas 2D Renderer for Protein Trafficking Simulator
 * Renders organelles, microtubule tracks, transport vesicles,
 * conformational protein states, and active organelle glow effects.
 */

class CellRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.dpr = window.devicePixelRatio || 1;

    // Organelle anchor positions (normalized 0.0 to 1.0)
    this.anchors = {
      nucleus: { x: 0.12, y: 0.72 },
      roughEr: { x: 0.28, y: 0.62 },
      erLumen: { x: 0.32, y: 0.58 },
      erExitSite: { x: 0.38, y: 0.48 },
      proteasome: { x: 0.22, y: 0.30 },
      cisGolgi: { x: 0.54, y: 0.46 },
      medialGolgi: { x: 0.60, y: 0.48 },
      transGolgi: { x: 0.66, y: 0.50 },
      plasmaMembrane: { x: 0.90, y: 0.35 },
      extracellular: { x: 0.96, y: 0.32 }
    };

    this.particles = []; // Decorative cytosolic particles & chaperone pulses
    this.initCytosolParticles();
    this.resize();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = Math.max(700, Math.floor(rect.width));
    const h = Math.max(480, Math.floor(rect.height || (w * 0.55)));

    this.width = w;
    this.height = h;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.ctx.scale(this.dpr, this.dpr);
  }

  initCytosolParticles() {
    this.particles = [];
    for (let i = 0; i < 35; i++) {
      this.particles.push({
        x: Math.random(),
        y: Math.random(),
        r: Math.random() * 2 + 1,
        speedX: (Math.random() - 0.5) * 0.0003,
        speedY: (Math.random() - 0.5) * 0.0003,
        alpha: Math.random() * 0.3 + 0.1
      });
    }
  }

  getScreenPos(anchorKey) {
    const a = this.anchors[anchorKey];
    return {
      x: a.x * this.width,
      y: a.y * this.height
    };
  }

  // --- Main Render Frame ---
  render(engine, timestamp) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    // 1. Cytosol Gradient & Boundary
    this.drawCytosolBackground(ctx, w, h);

    // 2. Cytoskeletal Microtubules (tracks for motor proteins)
    this.drawMicrotubuleTracks(ctx, w, h);

    // 3. Organelle Background Layer
    const active = engine.metrics.activeOrganelle;
    this.drawNucleus(ctx, active === 'rough_er' && engine.currentStage.id === 'translation', timestamp);
    this.drawRoughER(ctx, active === 'rough_er', timestamp);
    this.drawProteasome(ctx, active === 'proteasome', timestamp);
    this.drawGolgi(ctx, active === 'golgi', timestamp, engine.protein.glycosylationProgress);
    this.drawPlasmaMembrane(ctx, active === 'plasma_membrane', timestamp);

    // 4. Calculate Cargo Coordinate along Spline Pathway
    const cargoPos = this.calculateCargoPosition(engine);
    engine.protein.x = cargoPos.x;
    engine.protein.y = cargoPos.y;

    // 5. Draw Cargo (Protein / Vesicle / Aggregate)
    this.drawCargo(ctx, engine, cargoPos, timestamp);

    // 6. Draw Informative Organelle Labels
    this.drawOrganelleLabels(ctx, active);
  }

  // --- Background and Cytosol ---
  drawCytosolBackground(ctx, w, h) {
    const bgGrad = ctx.createRadialGradient(w * 0.5, h * 0.5, 40, w * 0.5, h * 0.5, w * 0.7);
    bgGrad.addColorStop(0, '#0c1524');
    bgGrad.addColorStop(0.7, '#070c17');
    bgGrad.addColorStop(1, '#03060c');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Cytosolic macromolecular crowding particles
    this.particles.forEach(p => {
      p.x += p.speedX;
      p.y += p.speedY;
      if (p.x < 0) p.x = 1;
      if (p.x > 1) p.x = 0;
      if (p.y < 0) p.y = 1;
      if (p.y > 1) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(56, 189, 248, ${p.alpha})`;
      ctx.fill();
    });
  }

  // --- Microtubule Tracks ---
  drawMicrotubuleTracks(ctx, w, h) {
    ctx.save();
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);

    // Track 1: ER Exit Site -> cis-Golgi
    const erExit = this.getScreenPos('erExitSite');
    const cisGolgi = this.getScreenPos('cisGolgi');
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.28)';
    ctx.beginPath();
    ctx.moveTo(erExit.x, erExit.y);
    ctx.quadraticCurveTo((erExit.x + cisGolgi.x) * 0.5, erExit.y - 25, cisGolgi.x, cisGolgi.y);
    ctx.stroke();

    // Track 2: trans-Golgi -> Plasma Membrane
    const transGolgi = this.getScreenPos('transGolgi');
    const plasma = this.getScreenPos('plasmaMembrane');
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.28)';
    ctx.beginPath();
    ctx.moveTo(transGolgi.x, transGolgi.y);
    ctx.quadraticCurveTo((transGolgi.x + plasma.x) * 0.5, transGolgi.y - 35, plasma.x, plasma.y);
    ctx.stroke();

    // Track 3: ER to 26S Proteasome (Retrotranslocation path)
    const erLumen = this.getScreenPos('erLumen');
    const proteasome = this.getScreenPos('proteasome');
    ctx.strokeStyle = 'rgba(248, 113, 113, 0.22)';
    ctx.beginPath();
    ctx.moveTo(erLumen.x, erLumen.y);
    ctx.quadraticCurveTo(erLumen.x - 30, (erLumen.y + proteasome.y) * 0.5, proteasome.x, proteasome.y);
    ctx.stroke();

    ctx.restore();
  }

  // --- Nucleus & Ribosome ---
  drawNucleus(ctx, isHighlighted, timestamp) {
    const pos = this.getScreenPos('nucleus');
    const radius = this.width * 0.18;

    ctx.save();
    if (isHighlighted) {
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 18 + Math.sin(timestamp * 0.006) * 6;
    }

    // Double membrane
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(pos.x, pos.y, 10, pos.x, pos.y, radius);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(0.85, '#0f172a');
    grad.addColorStop(1, '#0284c7');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = isHighlighted ? '#38bdf8' : '#0369a1';
    ctx.stroke();

    // Nuclear pores
    for (let angle = -0.6; angle <= 0.6; angle += 0.3) {
      const nx = pos.x + Math.cos(angle) * radius;
      const ny = pos.y + Math.sin(angle) * radius;
      ctx.beginPath();
      ctx.arc(nx, ny, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
    }

    // Chromatin texture inside nucleus
    ctx.beginPath();
    ctx.arc(pos.x - 20, pos.y - 15, radius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
    ctx.fill();

    ctx.restore();
  }

  // --- Rough Endoplasmic Reticulum (RER) ---
  drawRoughER(ctx, isHighlighted, timestamp) {
    const pos = this.getScreenPos('roughEr');
    const w = this.width;
    const h = this.height;

    ctx.save();
    if (isHighlighted) {
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 20 + Math.sin(timestamp * 0.005) * 8;
    }

    // Draw folded ER cisternae
    const folds = [
      { startX: pos.x - 40, startY: pos.y + 40, endX: pos.x + 50, endY: pos.y + 10, cpY: pos.y + 60 },
      { startX: pos.x - 20, startY: pos.y + 10, endX: pos.x + 65, endY: pos.y - 20, cpY: pos.y + 20 },
      { startX: pos.x - 5,  startY: pos.y - 15, endX: pos.x + 75, endY: pos.y - 50, cpY: pos.y - 10 }
    ];

    folds.forEach((f, idx) => {
      // ER lumen fill
      ctx.beginPath();
      ctx.moveTo(f.startX, f.startY);
      ctx.quadraticCurveTo((f.startX + f.endX) * 0.5, f.cpY, f.endX, f.endY);
      ctx.lineWidth = 18;
      ctx.lineCap = 'round';
      ctx.strokeStyle = isHighlighted ? 'rgba(6, 182, 212, 0.28)' : 'rgba(14, 116, 144, 0.2)';
      ctx.stroke();

      // ER membrane boundary
      ctx.lineWidth = 3;
      ctx.strokeStyle = isHighlighted ? '#22d3ee' : '#0891b2';
      ctx.stroke();

      // Studded Ribosomes (dots along the outer membrane)
      for (let t = 0.1; t <= 0.9; t += 0.16) {
        const rx = (1 - t) * (1 - t) * f.startX + 2 * (1 - t) * t * ((f.startX + f.endX) * 0.5) + t * t * f.endX;
        const ry = (1 - t) * (1 - t) * f.startY + 2 * (1 - t) * t * f.cpY + t * t * f.endY;

        ctx.beginPath();
        ctx.arc(rx, ry - 11, 3.2, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24'; // Ribosome golden dots
        ctx.fill();
      }
    });

    // ER Exit Site (ERES) marker
    const eres = this.getScreenPos('erExitSite');
    ctx.beginPath();
    ctx.arc(eres.x, eres.y, 8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  }

  // --- 26S Proteasome ---
  drawProteasome(ctx, isHighlighted, timestamp) {
    const pos = this.getScreenPos('proteasome');
    const pw = 44;
    const ph = 54;

    ctx.save();
    if (isHighlighted) {
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 22 + Math.sin(timestamp * 0.007) * 8;
    }

    // Proteasome 20S Core Barrel
    const barrelGrad = ctx.createLinearGradient(pos.x - pw / 2, pos.y, pos.x + pw / 2, pos.y);
    barrelGrad.addColorStop(0, '#7f1d1d');
    barrelGrad.addColorStop(0.5, '#b91c1c');
    barrelGrad.addColorStop(1, '#7f1d1d');

    ctx.fillStyle = barrelGrad;
    ctx.beginPath();
    ctx.roundRect(pos.x - pw / 2, pos.y - ph / 2, pw, ph, 8);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = isHighlighted ? '#f87171' : '#991b1b';
    ctx.stroke();

    // Proteasome Rings (alpha and beta catalytic rings)
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(pos.x - pw / 2 + 4, pos.y + i * 12);
      ctx.lineTo(pos.x + pw / 2 - 4, pos.y + i * 12);
      ctx.strokeStyle = 'rgba(254, 202, 202, 0.45)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 19S Regulatory Caps (top and bottom)
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.roundRect(pos.x - pw / 2 - 4, pos.y - ph / 2 - 6, pw + 8, 8, 3);
    ctx.roundRect(pos.x - pw / 2 - 4, pos.y + ph / 2 - 2, pw + 8, 8, 3);
    ctx.fill();

    ctx.restore();
  }

  // --- Golgi Apparatus ---
  drawGolgi(ctx, isHighlighted, timestamp, glycosylationProgress) {
    const w = this.width;
    const h = this.height;

    ctx.save();
    if (isHighlighted) {
      ctx.shadowColor = '#a855f7';
      ctx.shadowBlur = 22 + Math.sin(timestamp * 0.005) * 8;
    }

    // Golgi Cisternae Stacks: cis, medial, trans, and TGN
    const cisternae = [
      { name: 'cis',    x: this.anchors.cisGolgi.x * w,    y: this.anchors.cisGolgi.y * h,    curve: 18, color: '#c084fc' },
      { name: 'medial', x: this.anchors.medialGolgi.x * w, y: this.anchors.medialGolgi.y * h, curve: 22, color: '#a855f7' },
      { name: 'trans',  x: this.anchors.transGolgi.x * w,  y: this.anchors.transGolgi.y * h,  curve: 26, color: '#9333ea' }
    ];

    cisternae.forEach((c, idx) => {
      ctx.beginPath();
      const length = h * 0.18;
      ctx.moveTo(c.x, c.y - length * 0.5);
      ctx.quadraticCurveTo(c.x + c.curve, c.y, c.x, c.y + length * 0.5);

      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.strokeStyle = isHighlighted ? 'rgba(168, 85, 247, 0.35)' : 'rgba(147, 51, 234, 0.2)';
      ctx.stroke();

      ctx.lineWidth = 3;
      ctx.strokeStyle = isHighlighted ? c.color : 'rgba(192, 132, 252, 0.7)';
      ctx.stroke();

      // Bulbed ends / budding vesicles at the tips
      [-length * 0.5, length * 0.5].forEach(tipY => {
        ctx.beginPath();
        ctx.arc(c.x, c.y + tipY, 7, 0, Math.PI * 2);
        ctx.fillStyle = c.color;
        ctx.fill();
      });
    });

    // Glycosylation enzyme carbohydrate indicators
    if (isHighlighted && glycosylationProgress > 0) {
      const activeCis = cisternae[Math.min(2, Math.floor(glycosylationProgress * 3))];
      ctx.beginPath();
      ctx.arc(activeCis.x + 8, activeCis.y - 15, 4 + Math.sin(timestamp * 0.01) * 2, 0, Math.PI * 2);
      ctx.fillStyle = '#34d399'; // Emerald carbohydrate tree
      ctx.fill();
    }

    ctx.restore();
  }

  // --- Plasma Membrane & Extracellular Space ---
  drawPlasmaMembrane(ctx, isHighlighted, timestamp) {
    const pos = this.getScreenPos('plasmaMembrane');
    const h = this.height;

    ctx.save();
    if (isHighlighted) {
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 24 + Math.sin(timestamp * 0.006) * 8;
    }

    // Extracellular fluid region
    const extraGrad = ctx.createLinearGradient(pos.x, 0, this.width, 0);
    extraGrad.addColorStop(0, 'rgba(16, 185, 129, 0.08)');
    extraGrad.addColorStop(1, 'rgba(6, 95, 70, 0.25)');
    ctx.fillStyle = extraGrad;
    ctx.fillRect(pos.x, 0, this.width - pos.x, h);

    // Lipid Bilayer Curves
    ctx.beginPath();
    ctx.moveTo(pos.x, 0);
    ctx.quadraticCurveTo(pos.x - 15, h * 0.5, pos.x, h);
    ctx.lineWidth = 10;
    ctx.strokeStyle = isHighlighted ? '#34d399' : '#059669';
    ctx.stroke();

    // Hydrophobic core line
    ctx.lineWidth = 3;
    ctx.strokeStyle = isHighlighted ? '#a7f3d0' : '#10b981';
    ctx.stroke();

    // t-SNARE proteins on target plasma membrane
    for (let y = h * 0.25; y <= h * 0.75; y += 45) {
      ctx.beginPath();
      ctx.moveTo(pos.x - 8, y);
      ctx.lineTo(pos.x - 18, y - 4);
      ctx.lineTo(pos.x - 16, y + 4);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  // --- Calculate Cargo Coordinates Along Active Spline ---
  calculateCargoPosition(engine) {
    const stage = engine.currentStage.id;
    const progress = engine.stageProgress;

    const nucleus = this.getScreenPos('nucleus');
    const roughEr = this.getScreenPos('roughEr');
    const erLumen = this.getScreenPos('erLumen');
    const erExit = this.getScreenPos('erExitSite');
    const proteasome = this.getScreenPos('proteasome');
    const cisGolgi = this.getScreenPos('cisGolgi');
    const transGolgi = this.getScreenPos('transGolgi');
    const plasma = this.getScreenPos('plasmaMembrane');
    const extra = this.getScreenPos('extracellular');

    switch (stage) {
      case 'translation':
        return this.interpolate(nucleus, roughEr, progress);

      case 'er_folding':
        // Moves from rough ER into lumen and drifts towards exit site
        return this.interpolate(roughEr, erExit, progress);

      case 'erad': {
        // Retrotranslocation to cytoplasm -> Proteasome
        const midPoint = { x: (erLumen.x + proteasome.x) * 0.5 - 20, y: (erLumen.y + proteasome.y) * 0.5 };
        return this.bezierQuad(erLumen, midPoint, proteasome, progress);
      }

      case 'copii_transport': {
        // Microtubule track from ER exit to cis-Golgi
        const ctrl = { x: (erExit.x + cisGolgi.x) * 0.5, y: erExit.y - 25 };
        return this.bezierQuad(erExit, ctrl, cisGolgi, progress);
      }

      case 'golgi_processing':
        // Transit through cis -> medial -> trans cisternae
        return this.interpolate(cisGolgi, transGolgi, progress);

      case 'secretory_vesicle': {
        // Microtubule transit from trans-Golgi to Plasma Membrane
        const ctrl = { x: (transGolgi.x + plasma.x) * 0.5, y: transGolgi.y - 35 };
        return this.bezierQuad(transGolgi, ctrl, plasma, progress);
      }

      case 'exocytosis':
        // Fusion and expulsion into extracellular fluid
        return this.interpolate(plasma, extra, progress);

      case 'completed':
      default:
        if (engine.protein.conformation === 'misfolded' || engine.protein.conformation === 'degraded') {
          return proteasome;
        }
        return extra;
    }
  }

  interpolate(p1, p2, t) {
    return {
      x: p1.x + (p2.x - p1.x) * t,
      y: p1.y + (p2.y - p1.y) * t
    };
  }

  bezierQuad(p0, p1, p2, t) {
    const inv = 1 - t;
    return {
      x: inv * inv * p0.x + 2 * inv * t * p1.x + t * t * p2.x,
      y: inv * inv * p0.y + 2 * inv * t * p1.y + t * t * p2.y
    };
  }

  // --- Draw Cargo (Protein / Vesicles) ---
  drawCargo(ctx, engine, pos, timestamp) {
    const stage = engine.currentStage.id;
    const conf = engine.protein.conformation;

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // If inside a transport vesicle (COPII or Secretory)
    if (stage === 'copii_transport' || stage === 'secretory_vesicle') {
      const isCopII = stage === 'copii_transport';
      const vColor = isCopII ? '#f59e0b' : '#ec4899';
      const coatColor = isCopII ? 'rgba(245, 158, 11, 0.35)' : 'rgba(236, 72, 153, 0.35)';

      // Outer protein coat
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.fillStyle = coatColor;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = vColor;
      ctx.stroke();

      // Motor protein legs (kinesin analog walking on microtubule)
      const legOsc = Math.sin(timestamp * 0.02) * 4;
      ctx.beginPath();
      ctx.moveTo(-6, 17);
      ctx.lineTo(-4 + legOsc, 24);
      ctx.moveTo(6, 17);
      ctx.lineTo(8 - legOsc, 24);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // v-SNARE spikes on vesicle surface
      for (let i = 0; i < 4; i++) {
        const rad = (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(rad) * 16, Math.sin(rad) * 16);
        ctx.lineTo(Math.cos(rad) * 21, Math.sin(rad) * 21);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Protein Particle Rendering based on Conformation
    if (conf === 'unfolded') {
      // Nascent squiggly amino acid chain
      ctx.strokeStyle = '#facc15';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      for (let x = -8; x <= 10; x += 3) {
        ctx.lineTo(x, Math.sin(x * 1.5 + timestamp * 0.01) * 4);
      }
      ctx.stroke();

      // Signal peptide lead bead
      ctx.beginPath();
      ctx.arc(10, 0, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();

    } else if (conf === 'folded' || conf === 'glycosylated') {
      // Native globular tertiary fold: Glowing cyan/emerald sphere with alpha helices
      ctx.shadowColor = conf === 'glycosylated' ? '#10b981' : '#06b6d4';
      ctx.shadowBlur = 14;

      const grad = ctx.createRadialGradient(-3, -3, 2, 0, 0, 12);
      grad.addColorStop(0, '#a7f3d0');
      grad.addColorStop(0.6, '#06b6d4');
      grad.addColorStop(1, '#0e7490');

      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Carbohydrate tree arborization (if glycosylated in Golgi)
      if (conf === 'glycosylated' || engine.protein.glycosylationProgress > 0) {
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(-4, -16);
        ctx.lineTo(-8, -20);
        ctx.moveTo(-4, -16);
        ctx.lineTo(2, -21);
        ctx.stroke();

        // Sugar residues
        [-8, 2].forEach((sx, idx) => {
          ctx.beginPath();
          ctx.arc(sx, idx === 0 ? -20 : -21, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#6ee7b7';
          ctx.fill();
        });
      }

    } else if (conf === 'misfolded') {
      // Tangled irregular clump with exposed hydrophobic red patches
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 16;

      ctx.beginPath();
      ctx.moveTo(-9, -6);
      ctx.lineTo(6, -8);
      ctx.lineTo(10, 3);
      ctx.lineTo(4, 9);
      ctx.lineTo(-7, 7);
      ctx.closePath();

      const misGrad = ctx.createRadialGradient(0, 0, 1, 0, 0, 11);
      misGrad.addColorStop(0, '#f87171');
      misGrad.addColorStop(1, '#991b1b');
      ctx.fillStyle = misGrad;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#fca5a5';
      ctx.stroke();

      // Ubiquitin tags attached during ERAD
      if (engine.protein.ubiquitinated) {
        for (let u = 0; u < 3; u++) {
          const uAngle = u * 1.8;
          ctx.beginPath();
          ctx.arc(Math.cos(uAngle) * 15, Math.sin(uAngle) * 15, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#facc15';
          ctx.fill();
        }
      }

    } else if (conf === 'degraded') {
      // Dispersed peptide fragments inside proteasome
      for (let f = 0; f < 5; f++) {
        const offX = (Math.random() - 0.5) * 16;
        const offY = (Math.random() - 0.5) * 16;
        ctx.beginPath();
        ctx.arc(offX, offY, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(252, 165, 165, 0.7)';
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // --- Organelle Text Labels ---
  drawOrganelleLabels(ctx, activeOrganelle) {
    ctx.save();
    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';

    const labels = [
      { text: 'Nucleus / Ribosomes', anchor: 'nucleus', offsetY: 40, activeKey: 'rough_er' },
      { text: 'Rough Endoplasmic Reticulum', anchor: 'roughEr', offsetY: 60, activeKey: 'rough_er' },
      { text: '26S Proteasome (ERAD)', anchor: 'proteasome', offsetY: 38, activeKey: 'proteasome' },
      { text: 'Golgi Complex (cis → trans)', anchor: 'medialGolgi', offsetY: 65, activeKey: 'golgi' },
      { text: 'Plasma Membrane', anchor: 'plasmaMembrane', offsetY: 55, activeKey: 'plasma_membrane' }
    ];

    labels.forEach(l => {
      const pos = this.getScreenPos(l.anchor);
      const isActive = activeOrganelle === l.activeKey;

      ctx.fillStyle = isActive ? '#38bdf8' : 'rgba(148, 163, 184, 0.75)';
      ctx.fillText(l.text, pos.x, pos.y + l.offsetY);
    });

    ctx.restore();
  }
}

window.CellRenderer = CellRenderer;

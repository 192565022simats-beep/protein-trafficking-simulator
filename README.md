# Protein Trafficking Simulator

An interactive, scientifically accurate endomembrane transport and ER quality control simulator built with HTML5 Canvas, Web Audio API, and vanilla JavaScript.

---

## 🚀 Quick Start

Open `index.html` directly in any modern web browser (Google Chrome, Microsoft Edge, Mozilla Firefox, Apple Safari).
No build steps, dependencies, or local web servers are required!

---

## 🎛️ Exactly Three Core Adjustable Parameters

The simulator features a streamlined, compact control panel with exactly three adjustable parameters:

| Parameter | Range | Default | Biological Impact & Behavior |
| :--- | :---: | :---: | :--- |
| **Protein Transport Speed** | `10% – 100%` | `80%` | Scales the continuous movement velocity of nascent polypeptides and vesicular carriers (COPII and Secretory vesicles) along cytoskeletal microtubule tracks. **Changes take effect immediately on the running animation.** |
| **ER Folding Efficiency** | `0% – 100%` | `95%` | Determines the probability ($0.0 \le P \le 1.0$) that chaperone proteins (BiP, calnexin) successfully fold the nascent polypeptide in the Rough ER lumen. Low values trigger **ER-Associated Degradation (ERAD)**, redirecting proteins to the 26S Proteasome. High values promote native tertiary folding. |
| **Golgi Processing Rate** | `10% – 100%` | `85%` | Dictates the residence time required for oligosaccharide trimming and glycan arborization within the Golgi cisternae (*cis* $\rightarrow$ *medial* $\rightarrow$ *trans*). Higher rates shorten dwell time, accelerating transit. |

> **Note:** Parameters such as *Membrane Fusion Efficiency* and *Cellular Transport Load* have been completely removed.

---

## 🧪 Experiment Presets

Three biological presets configure the core parameters with one click:

1. **Normal Protein Transport**
   - Transport Speed: `80%`
   - ER Folding Efficiency: `95%`
   - Golgi Processing Rate: `85%`
   - *Outcome:* Rapid, high-fidelity folding, sequential glycosylation, and secretion into the extracellular matrix.

2. **ER Protein Misfolding**
   - Transport Speed: `70%`
   - ER Folding Efficiency: `15%`
   - Golgi Processing Rate: `80%`
   - *Outcome:* Nascent chains fail quality control, exposing hydrophobic patches, triggering polyubiquitination and retrotranslocation to cytosolic 26S proteasomes.

3. **Reduced Transport Efficiency**
   - Transport Speed: `25%`
   - ER Folding Efficiency: `85%`
   - Golgi Processing Rate: `30%`
   - *Outcome:* Simulates hypothermic or energy-depleted cellular conditions with sluggish microtubule transit and prolonged Golgi dwell times.

---

## 🧬 Biological Pathway Stages

1. **Translation & Translocation:** mRNA translated at membrane-bound ribosomes, polypeptide threaded into the Rough ER lumen.
2. **ER Folding & Quality Control:** Chaperone-assisted folding. Folding efficiency determines native conformation vs. misfolding.
3. **ERAD Branch (if misfolded):** Retrotranslocation to cytoplasm, polyubiquitination, and degradation inside the 26S Proteasome.
4. **COPII Vesicular Transport:** Folded proteins bud from ER Exit Sites (ERES) and travel toward the *cis*-Golgi along microtubules.
5. **Golgi Post-Translational Processing:** Oligosaccharide arborization through *cis*, *medial*, and *trans* cisternae.
6. **Secretory Vesicle Trafficking:** Packaged at the Trans-Golgi Network (TGN) and translocated to the cell periphery.
7. **Exocytosis:** v-SNARE / t-SNARE pairing and lipid bilayer fusion, releasing cargo into the extracellular space.

---

## 🔊 Native Sound Engine

All audio effects (translation hum, chaperone chimes, ERAD alerts, vesicle budding sweeps, and membrane fusion pops) are synthesized natively in real time using the browser's **Web Audio API**. Use the speaker icon in the top right to mute or unmute.

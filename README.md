# Adaptive Medium Lab

**[Open the interactive website](https://virtualorganics.github.io/adaptive-medium-lab/)**

A browser simulation for exploring local conversion, cohort motion, AM response, wear and returning branches. No installation is needed to use the website.

Select a starting state, a conversion hypothesis and an upstream recruitment rule, then press **Run**. Simulation settings allow cohort bulk speed above or below intrinsic AM speed. Settings apply with **Restart with these settings**.

The default uses current local geometry for recruitment and forward-probe steering. Recorded cohorts born together can form an O-shaped pair and meet again. **Sustained two-branch circulation remains unestablished.** This is an experimental model, not a validated physical theory.

- [Latest findings](GEOMETRY-FINDINGS.md)
- [Baseline assessment](REPORT.md)
- [Recorded returning pair](evidence/geometry/returning-pair.svg)
- [Geometry comparison measurements](evidence/geometry/results.json)

## Technology behind the simulation

**The live simulation runs in JavaScript on the visitor's CPU, inside a browser Web Worker. It does not run a simulation shader or Python.** The browser displays the results using Canvas 2D.

| Component | Technology and role |
| --- | --- |
| Simulation engine | Plain JavaScript ES modules in [model.js](model.js). This computes AM response, material transfers, compression, cohort formation, motion, wear and collisions. |
| Background computation | A [Web Worker](worker.js) runs the numerical steps separately from the page's main thread. Controls send messages to the worker; it sends state snapshots back for display. |
| Numerical state | A two-dimensional grid uses `Float64Array` storage for AM content, deformation and compression. Cohorts are individually tracked objects with positions, directions, content and recorded histories. |
| Time integration | Fixed numerical time steps, with a default of 0.025 model time units. The AM response uses a finite-difference damped wave update; material flights and release signals have explicit arrival times. Browser display timing is separate from model time. |
| Visual display | The browser's Canvas 2D API in [app.js](app.js) draws the field, cohort arrows, paths and charts. This build contains no custom WebGL, WebGPU or GLSL simulation shaders. |
| Interface | Standard [HTML](index.html), [CSS](style.css) and JavaScript. No React, Three.js, external UI framework or bundler is required. |
| Hosting | GitHub Pages serves static files over HTTPS. There is no simulation backend, Python service or database; the numerical work happens on each visitor's device. |
| Offline experiments and checks | Node.js runs the same simulation engine through [experiments.js](experiments.js), [geometry-experiments.js](geometry-experiments.js) and [tests.js](tests.js). The checks use Node's built-in test runner. |
| Saved evidence | JSON stores measurements and histories. SVG files show the prepared evidence figures. The geometry experiment script uses Node's built-in gzip support to compress full traces. |

The live flow is **controls → worker → simulation engine → state snapshots → Canvas display**. Running the website needs only a modern browser. Node.js is needed only for the optional local server, automated experiments and checks.

### Where Python and the original shaders fit

Python was used during development for offline tasks such as inspecting source papers, processing recorded results and producing evidence figures with ReportLab. It is not loaded by the website and is not needed to run the live simulation or the included Node.js experiment scripts. The offline Python preparation scripts remain in the original research workspace.

Earlier GLSL/Shadertoy simulations were studied as references. The current JavaScript model implements a comparison inspired by their forward-probe steering rule, but it does not execute those shaders. Its explicit cohort identities and dated transfer records make individual mechanisms easier to inspect. The tradeoff is a CPU simulation intended for modest grid sizes, rather than the large parallel grids of a GPU shader implementation.

## Run locally

Use Node.js 20 or newer and run `npm start`, then open http://localhost:5184/. There are no package dependencies or build steps.

## Reproduce the experiments

`npm test` runs 19 implementation checks. `npm run experiments` generates the baseline measurements and full traces. `npm run experiments:geometry` generates the separate geometry comparison and compressed traces. Summary measurements, figures and the saved check results are included; the large raw trace archives and private local source references are not part of this website.

The public copy uses standard `.js` module filenames for static hosting. The simulation rules match the local research build.

## Hosting

GitHub Pages serves the `main` branch root. The `.nojekyll` file keeps this a plain static website. The simulation runs entirely in the visitor's browser.

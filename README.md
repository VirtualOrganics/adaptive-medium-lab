# Adaptive Medium Lab

**[Open the interactive website](https://virtualorganics.github.io/adaptive-medium-lab/)**

A browser simulation for exploring local conversion, cohort motion, AM response, wear and returning branches. No installation is needed to use the website.

Select a starting state, a conversion hypothesis and an upstream recruitment rule, then press **Run**. Simulation settings allow cohort bulk speed above or below intrinsic AM speed. Settings apply with **Restart with these settings**.

The default uses current local geometry for recruitment and forward-probe steering. Recorded cohorts born together can form an O-shaped pair and meet again. **Sustained two-branch circulation remains unestablished.** This is an experimental model, not a validated physical theory.

- [Latest findings](GEOMETRY-FINDINGS.md)
- [Baseline assessment](REPORT.md)
- [Recorded returning pair](evidence/geometry/returning-pair.svg)
- [Geometry comparison measurements](evidence/geometry/results.json)

## Run locally

Use Node.js 20 or newer and run `npm start`, then open http://localhost:5184/. There are no package dependencies or build steps.

## Reproduce the experiments

`npm test` runs 19 implementation checks. `npm run experiments` generates the baseline measurements and full traces. `npm run experiments:geometry` generates the separate geometry comparison and compressed traces. Summary measurements, figures and the saved check results are included; the large raw trace archives and private local source references are not part of this website.

The public copy uses standard `.js` module filenames for static hosting. The simulation rules match the local research build.

## Hosting

GitHub Pages serves the `main` branch root. The `.nojekyll` file keeps this a plain static website. The simulation runs entirely in the visitor's browser.

# Adaptive Medium — new local implementation and experimental assessment

10 September 2026 · Baseline assessment (version 0.1.0)

**15 September update:** The current build adds geometry-based recruitment. Some cohorts born together now bend back into contact, but sustained local circulation is still unestablished. See [the latest findings](GEOMETRY-FINDINGS.md). The numerical findings below describe the preserved baseline suite.

The local lab is working. A release-feedback hypothesis produces repeated upstream **birth-site** advance at **0.2 c** in the axial tests. This is conditional on two explicit constitutive choices: a returning release signal and resistance from dense receiving AM even when the receiving face is not uphill. It does **not** establish an emergent invariant kickback law or the requested two-branch returning circulation.

The initial limited-withdrawal model dies out. Unrestricted aggregate withdrawal spreads even with export disabled. The longer coupled run eventually exhausts its activity: at t = 600 there are no organized cohorts, incoming supply or pending release signals. The requested stable O-like circulation remains unachieved.

## Use the lab

Open the [online lab](https://virtualorganics.github.io/adaptive-medium-lab/). To run locally, download this repository and run `npm start`; no dependency installation or build step is required.

The current default view is a tiny asymmetric dip with release feedback, dense resistance, strongest-local-cliff recruitment and original forward-probe steering. The inherited-direction baseline remains selectable. Run, pause, step, or advance five time units. The scenario menu also isolates opposing unorganized inflow, wear, head-on contact, quiet AM, shallow variation and two-cohort wake interaction. Other hypotheses remain selectable. Settings apply on restart; changing the starting state restarts that experiment.

Gold arrows are organized cohorts, cyan points are unorganized material in transit, and hollow mauve points are hypothetical returning release signals. White patches show held compression. Traces are recorded histories, not continuously occupied channels. The local zoom does not change the numerical resolution. The full-field view has open edges; no periodic wrap or reflecting loop is used.

## Requirements versus modelling choices

The user specifies a dense, stiff, pressurized exotic medium of fixed-speed vibrations; a tiny steep deficit; supply crossing into transient compression; organized release; a regenerated supplying deficit; recursive AM adaptation; wear; and local return at balanced head-on contact. Two returning branches are an outcome to establish. Individual vibrations and detailed initiation are deliberately unresolved.

The user clarified in this task that a cohort's bulk speed may be faster or slower than the intrinsic speed and should be assessed experimentally. Bulk speed is therefore a separate setting; the default ratio of one is a hypothesis, not a constraint. The suite also tests 0.6 c and 1.4 c.

The blueprint recommends, but does not mandate, a GPU host, directional aggregates and a separate response variable. This build uses a fresh numerical core in a browser worker because it permits individual cohort identity, exact material transactions, dated supply events and causal logs at modest cost. It does not reuse the former fluid model, shader transport packing or receiving quota. The original shader files are retained as references.

| State | Meaning and accounting |
| --- | --- |
| Free content, rho | Available AM; baseline 1 per cell, allowed to exceed baseline after local return. |
| Unorganized transit | Real content debited at its donor, with departure, destination, direction and arrival time. |
| Held compression, eight directions | Incoming content accumulated against resistance or through opposing local arrival. Directional contributions survive until interaction and release. |
| Adaptive response, q and its rate | Signed deformation driven by depletion and compression, not additional material. |
| Organized cohort | Persistent identity, position, direction, organized content, birth event and path. |
| Carried wake load | Separate AM content entrained from the path; it does not become organized content automatically. |
| Release signal, candidate only | A dated stress-reaction signal carrying a release amplitude, not material. Its provenance is an actual release and its recorded supplying location. |
| Escaped content | Organized content, carried load or supply that has left an open edge. |

The full content account is free + in transit + held + organized + carried + escaped. No rounding remainder or budget cap silently deletes content. The app pauses if it reaches its cohort budget. Live history is bounded for responsiveness; the fixed experiment traces are saved in full.

**Units:** lengths are in declared AM length units, time in AM transit units, c = 1. Cell spacing defaults to 1. State storage uses baseline-cell content equivalents. Multiply inventory amounts by dx squared when comparing physical integrated content between meshes. The physical initial dip width is held fixed in the refinement comparison; the conversion patch and contact discretization are not yet independent of mesh size. This is a mesoscopic model, not a converged continuum discretization.

## Local constitutive rules

**Supply and transit.** A steep neighbouring contrast triggers a finite loading interval, followed by a material transfer at c. Axial and diagonal flights use their actual lengths. The local signal/travel delays are explicit, but finite timing constants alone are not offered as proof of the intended kickback. A transfer's initially estimated amount may be reduced if donor stock is no longer available. The model has no receiving capacity quota.

**Unorganized interaction.** Arrivals at a common cell are grouped before onward transfer. Opposed directional contributions load compression even if their net direction is zero. Otherwise, supply crosses the dip to the next receiving location. Comparing with this contact interaction disabled exposes why testing only artificially preloaded compression would have been insufficient. The current simultaneous-arrival treatment and pairwise oblique extension retain discretization and ordering limits.

**Release directions.** A 32-angle probe examines surrounding free content and held compression, together with the directional compression tensor. Transverse stress relief and the forward incoming bias compete with local resistance. All positive local maxima can produce cohorts. There is no stored pair of exit angles, prescribed loop, stream attraction or global target shape. The stress/resistance score and its numerical weights are hypotheses; a square-grid sampling landscape can produce several exits. The number and orientation of exits are not established physical predictions.

**Amount and relaxation.** When held content exceeds a separate compression threshold and an exit is available, the currently accumulated content is released. Packet amount therefore follows the actual arrivals; it is not a fixed packet quota. Unreleased compression relaxes exponentially into free AM at the receiving site. The adaptive deformation persists and readjusts after material release. The release threshold, local preparation time and stress score still need constitutive justification; threshold sensitivity is reported rather than assumed away.

**AM adaptation.** The candidate response is a damped, locally forced wave: q_tt + 2 gamma q_t = c squared Laplacian(q) + omega squared [(1 - rho - held) - q]. This is a proposed AM response law, not a claim that AM is an ordinary fluid or that this equation follows from its microscopic vibrations. A small conservative free-content exchange supplies a healing hypothesis. That exchange is diffusive and has not been made into an invariant-speed causal law. The broad 14-cell source/response kernel in the original recursive shader is not retained. No imposed moving compression/depletion dipole is used.

**Travel, wake and return.** Surviving organized content travels at the selected bulk speed and is turned by q. Wake content is debited locally into a separate carried-load account. Basic wear returns the same fraction of core and carried load locally. Swept contact detects approaching cohorts before reducing their contributions. Equal head-on content loses all organized motion and returns locally; equal opposite fractions cancel in unequal contact. Oblique loss is an explicitly provisional pairwise rule. This is not a complete momentum or energy account with the prestressed AM.

## Five hypotheses tested

| Hypothesis | What changes | Result |
| --- | --- | --- |
| Limited withdrawal | Mobilized content is capped by the local contrast as well as available stock. | Small local burst; no sustained advancing head. |
| Aggregate withdrawal | A steep cliff mobilizes a larger fraction of its donor. | Wide activity also occurs without cohort export. Rejected as evidence of release-driven kickback. |
| AM response trigger | The adaptive deformation contrast controls initiation. | Brief local activity, then extinction. The delayed response does not supply the missing renewed head. |
| Release feedback + rising resistance | After the initial seed episode, actual releases send finite-speed responses to their suppliers. Only a fresh local cliff and rising receiver can recruit the next donor. | Additional supply, but births remain at one location and stop. A widened supply footprint is not a moving conversion site. |
| Release feedback + dense resistance | The receiving AM can resist aggregate arrival through its remaining dense prestress even without an uphill face. | Successive upstream births advance in several directions. Axial established speed is 0.2 c. Still no sustained two returning branches. |

The release-feedback cases are deliberately isolated cascade experiments: the initial dip supplies the root episode, and subsequent recruitment must trace to a real release. The signal amplitude limits the next withdrawal, it is consumed when evaluated, and it is neither decaying throughput memory nor a freely circulating activation reservoir. The next local cliff and receiver are rechecked on arrival. Nevertheless, **the directed back-reaction law is imposed as a hypothesis**. Its export-disabled control verifies that dependency; it does not derive the law from AM pressure dynamics.

Why 0.2 c: in the established axial sequence, the model spends two length units returning the response, one preparing the next aggregate and two crossing into the next receiver, while the receiving birth site advances one length unit. This five-part cycle explains the measured rate. It is not a discovery that the intrinsic speed itself is 0.2, nor a demonstration of relativistic invariance. Faster/slower cohort motion is separate.

## Recorded results

The suite contains **55 experiments**, plus the isolated scalar-wave comparison and runtime benchmarks. Sixteen implementation checks pass. These checks validate specific transactions and interactions; they do not validate the proposed AM theory.

| Experiment | Measured result | Interpretation |
| --- | --- | --- |
| Uniform and shallow AM | No births | Quiet background is not an automatic engine. |
| Tiny asymmetric dip, limited law | 4 receiving locations; maximum birth extent 1.0; total export 1.998 | Local conversion, then extinction. |
| Opposing unorganized supply | 0.9 held/exported with zero net incoming direction | Strong loading need not depend on alignment. Prepared test, complemented by actual dip contact. |
| No-export relaxation | 0.895965 of 0.9 returned by t = 20 | Held content has a measured local destination. |
| Wear over 30 time units | 0.8 becomes 0.558141; 0.241859 returns | Agrees with the chosen wear lifetime. The wear-off control retains 0.8. |
| Balanced head-on contact | 1.6 organized content returns at the meeting | No fictitious averaged survivor or missing material. |
| Aggregate export on/off | Donor extents 19.799 / 19.799 at t = 20 | The apparently propagating activity fails the export control. |
| Release + rising resistance | 1 birth location despite further supply | A stationary conversion site. |
| Release + dense resistance | 69 birth locations, extent 10.0 by t = 60; axial rate 0.2 c | Conditional advancing sequence, not yet the full mechanism. |
| Release feedback, export disabled | No follow-on signal; donor extent stays 1.414 | Causal dependency is explicit in this candidate. |
| Scalar-wave diagnostic | Peak speed 1.0 c at dt = 0.2 and 0.1 | Checks the isolated wave solver; not the nonlinear conversion front. |
| Long coupled run, t = 600 | Zero active cohorts or pending signals; last birth t = 250.825 | A finite transient, not persistent circulation. |

The largest final content-budget error across the saved runs is 2.21e-10 cell-equivalent units. This is bookkeeping evidence only.

### Speed, rotation, time step and scale

The established axial birth speed remains 0.2 c in the release/dense tests at dt = 0.025, 0.05 and 0.1, with loading fractions 0.34 and 0.50, and with halved cell spacing. Individual events, diagonal timing and the number of sites still vary. The refined release run has 379 birth locations and physical extent 11.511 at t = 60, versus 69 and 10.000 on the original mesh. A persistent axial speed does not establish mesh-independent geometry.

The initial local law is also sensitive to coarse time steps. The default was reduced to 0.025 after the 0.025 and 0.0125 limited-law exports agreed to about 0.12%, whereas the larger steps changed the burst materially. A missing cell-spacing factor in the initial cliff comparison was corrected before the final refinement runs. Refinement still changes the process; that remaining difference is not hidden as a display setting.

Rotation perturbs the local asymmetric seed; it does not rotate the square lattice. A sub-cell shift of (0.35, -0.25) changes the release run to 39 birth sites by t = 100, versus 121 under the rotated comparison, and produces no collision returns. This is a substantial dependence of the geometry on discretization. Separate domain-size comparisons retain the same local seed and expose boundary losses. The grid-direction representation, fixed local contact scale and event threshold remain limitations.

### Curvature and the returning-loop test

The original shader's actual forward-probe steering was read and compared with continuous local-gradient steering on the new state. Its forward and side probes turn more strongly in the coupled experiments. It is a geometrical adaptation of the original rule, with time-step scaling; the original shader's imposed moving source pair and mass packing are not copied.

Recorded paths show some substantial turns: the original-probe release run has maximum accumulated turn 4.806 radians. This is not automatically a return. The checks distinguish simple late meetings from cohorts born in the same release, travelling more than eight units each and both turning at least pi/2 before meeting. There are **zero such candidate meetings** in the saved runs. This is a deliberately strict screen, not a topological proof that every possible circulation is absent. No repeated two-branch return with sustained conversion was found by inspecting the source identities and paths.

A relaxed check also finds 188 contacts in the original-probe run where both cohorts travelled more than eight units and accumulated at least pi/2 of turning. None of those pairs originated within three cells of one another. These are curved returns between different advancing conversion regions, not evidence of the requested single local two-branch engine.

The longer run contains 555 contacts after both cohorts have travelled more than twelve units, yet no returning pair under the stricter screen. These contacts largely involve streams launched from different advancing sites. Basic wear variations 0.006, 0.012 and 0.024 change survival and turning but do not establish the intended loop. No periodized boundary, imposed two-angle nozzle, closed path or direct stream-attraction force was added to obtain a picture.

## Performance and validation

On this Mac's arm64 runtime, at 96 x 64 cells and 16 numerical steps per batch, the recorded release-feedback benchmark has a median 3.90 ms and 95th percentile 4.97 ms. Each batch advances 0.4 AM time units. This excludes browser drawing and state transfer; the preview displays the observed worker batch time. The UI remains on a separate thread. Performance does not establish the physics.

Validation covers nonnegative finite stock, separate accounts, supply transit timing, unorganized opposing contact, compression relaxation, wear-off transport, equal and unequal head-on contact, separating births, local wake pickup, escaped material, actual supplier provenance, and release-signal timing. The known model failures are saved as experimental results rather than turned into misleading pass labels.

## What remains to solve

1. Replace the explicit reverse release message with a spatial AM stress response that reproduces the same causal supply sequence, or justify the message as a controlled coarse reduction. Test whether the observed 0.2 c process rate matches the intended relationship to c; do not silently rename the rate.
2. Establish a receiving-resistance/compression law for a dense, prestressed AM that sustains a small conversion region without creating independent radial fronts. The rising-only law fails; absolute dense resistance works conditionally but lacks a derived stress budget.
3. Determine whether the existing AM-mediated steering and an appropriate recursive response can close two branches from the same local conversion process. Current continuous steering is weak; the original probe law creates larger turns but no sustained paired return. More attractive-looking tuning would not resolve this.
4. Separate physical conversion width and contact width from mesh size, then repeat angular and spatial refinement. Only after those tests should the model expand toward large noisy scenes or 3D topology.

The lab is therefore a usable and inspectable research build, with a new conditional propagation experiment. The intended stable O-like mechanism is still unfinished.

## Source audit

The actual simulation bodies in both supplied JSON files were extracted and read: Common, material response, cohort formation/transport, carried load and, for the recursive program, gradual formation. Both original JSON files are copied in references. The source-manifest file records original paths, byte counts and SHA-256 hashes.

- **7cKGWd — Kickback Test / Vacancy:** prepared dock/plateau terrain, instantaneous or memory backfill stamps, scalar response and compact affine cohort distributions. Its backfill direction and moving lip are references; its vacancy memory is not proof of a finite-speed causal front.
- **73dGzH — Bipolar Cohorts / Recursive AM:** 14-cell neighbourhood response, source/coupling/recursion, gradual formation, one packed distribution per cell, carried load and forward/side steering. Its imposed moving front/rear dipole was specifically excluded. The new separate cohort objects avoid merging directions before contact.
- **Three supplied papers:** text was extracted again from the actual PDFs. The conceptual and continuum diagrams were rendered and inspected. The continuum's phase-field/fluid-like closure was not adopted as an approved AM law. The addendum's figure-8, gravitational and relativistic claims are not treated as demonstrated outcomes.
- **Six supplied images:** original output and the evolving few-cell dip/compression/exit diagrams were visually inspected. Their whole-page outlines were not drawn into the simulation as domain-sized templates.
- **Previous application and failed experiments:** reviewed as references. No source in the old application was changed. Its original server was no longer listening at the final check, so its existing built preview was restarted on port 5173 without operating any old browser tabs. Only the new folder contains the implementation, launcher and evidence.

## Reproduce

Run npm test for the 19 current transaction and interaction checks. Run npm run experiments for the fixed numerical suite and complete traces. Run node benchmark.js for local batch performance. The app imports the same model.js as these experiments; there is no separate visual-only solver.

- evidence/summary.svg: vector evidence figure with a common trajectory observation window.
- evidence/results.json: parameters and aggregate measurements for every run.
- evidence/traces.json: generated locally by npm run experiments; records dated births, suppliers, transfers, collisions, signals and paths. Full trace archives are not included in this public website.
- evidence/front-speed.json: actual axial birth records used for the speed comparison.
- evidence/tests.txt: test results.
- evidence/performance.json: measured batch costs and their scope.
- Original input files and the local source manifest are retained in the research workspace, outside this public website.

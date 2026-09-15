import { Medium } from "./model.js";
let medium,
  running = false,
  timer = null,
  lastCost = 0;
const send = () =>
  postMessage({ type: "state", state: medium.snapshot(), cost: lastCost, running });
function tick() {
  if (!running) return;
  const start = performance.now();
  medium.step(Math.max(1, Math.round(0.4 / medium.p.dt)));
  lastCost = performance.now() - start;
  if (medium.stopped) running = false;
  send();
  if (running) timer = setTimeout(tick, Math.max(4, 33 - lastCost));
}
onmessage = ({ data }) => {
  try {
    if (data.type === "reset") {
      running = false;
      lastCost = 0;
      clearTimeout(timer);
      medium = new Medium({ ...data.options, maxHistory: 1500, maxCohorts: 16000 });
      send();
    }
    if (data.type === "run") {
      running = !!data.running;
      clearTimeout(timer);
      if (running) tick();
      else send();
    }
    if (data.type === "step") {
      running = false;
      clearTimeout(timer);
      const start = performance.now();
      medium.step(data.time ? Math.round(data.time / medium.p.dt) : (data.count ?? 1));
      lastCost = performance.now() - start;
      send();
    }
    if (data.type === "export")
      postMessage({
        type: "export",
        data: {
          p: medium.p,
          summary: medium.summary(),
          births: medium.births,
          transfers: medium.transfers,
          collisions: medium.collisions,
          signals: medium.signalHistory,
          paths: [...medium.paths],
          note: "Live history is bounded to protect responsiveness. Full fixed experiments are in evidence/traces.json.",
        },
      });
  } catch (e) {
    running = false;
    postMessage({ type: "error", message: e.stack || e.message });
  }
};

const $ = (id) => document.getElementById(id),
  worker = new Worker("./worker.js", { type: "module" });
let state = null,
  history = [],
  running = false,
  currentOptions = {},
  domain = null;
const notes = {
  dip: "A 20% central deficit, with a small local asymmetry. Initial depletion is confined to a few cells.",
  symmetric:
    "The same tiny dip without an asymmetric perturbation. Inspect grid dependence before interpreting its exits.",
  converging:
    "A prepared local diagnostic: two equal unorganized supply packets approach one receiver. Natural conversion elsewhere is disabled.",
  collision:
    "A prepared transport test: two equal cohorts approach head-on. New formation is disabled.",
  wear: "A paid-for cohort travels through AM. New formation is disabled; wear returns material along its path.",
  "wake-pair":
    "Two prepared cohorts interact only through the AM. This tests curvature; it does not demonstrate two branches born from one dip.",
  quiet: "Uniform, dense AM. With no perturbation, cohort generation should stay absent.",
  shallow: "A broad, shallow deficit. Readjustment should not produce widespread ignition.",
  noisy: "The same tiny dip with mild, reproducible background variation.",
};
function config() {
  const scenario = $("scenario").value,
    isolated = ["converging", "collision", "wear", "wake-pair"].includes(scenario);
  const choice = $("closure").value;
  return {
    scenario,
    closure: choice.startsWith("release-") ? "release" : choice,
    resistanceLaw: choice === "release-dense" ? "dense" : "rising",
    steeringLaw: $("steeringLaw").value,
    recruitment: $("recruitment").value,
    conversion: !isolated,
    export: $("export").checked,
    steering: $("steer").checked ? 1.2 : 0,
    wake: $("wake").checked ? 0.035 : 0,
    wear: Number($("wear").value),
    bulkSpeed: Number($("speed").value),
    record: true,
  };
}
function reset() {
  currentOptions = config();
  history = [];
  worker.postMessage({ type: "reset", options: currentOptions });
  $("notice").textContent = "";
  $("scenarioNote").textContent = notes[currentOptions.scenario];
}
$("scenario").onchange = () => {
  const s = $("scenario").value;
  $("scenarioNote").textContent = notes[s];
  if (["converging", "collision", "wear"].includes(s)) {
    $("steer").checked = false;
    $("wake").checked = false;
  } else {
    $("steer").checked = true;
    $("wake").checked = true;
  }
  if (["converging", "collision"].includes(s)) {
    $("wear").value = 0;
    $("wearValue").textContent = "0.000 / time";
  } else {
    $("wear").value = 0.012;
    $("wearValue").textContent = "0.012 / time";
  }
  reset();
};
$("apply").onclick = reset;
$("reset").onclick = reset;
$("play").onclick = () => worker.postMessage({ type: "run", running: !running });
$("step").onclick = () => worker.postMessage({ type: "step", count: 1 });
$("advance").onclick = () => worker.postMessage({ type: "step", time: 5 });
$("download").onclick = () => worker.postMessage({ type: "export" });
$("speed").oninput = () =>
  ($("speedValue").textContent = Number($("speed").value).toFixed(1) + " × c");
$("wear").oninput = () =>
  ($("wearValue").textContent = Number($("wear").value).toFixed(3) + " / time");
for (const id of ["view", "paths", "zoom"]) $(id).onchange = draw;
worker.onmessage = ({ data }) => {
  if (data.type === "error") {
    $("notice").textContent = data.message;
    running = false;
    $("play").textContent = "Run";
    return;
  }
  if (data.type === "export") {
    const a = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json" }),
      );
    a.href = url;
    a.download = "adaptive-medium-experiment.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  if (data.type !== "state") return;
  state = data.state;
  running = data.running;
  window.labStatus = { t: state.t, running, cohorts: state.cohorts.length, summary: state.summary };
  $("play").textContent = running ? "Pause" : "Run";
  $("clock").textContent = `t = ${state.t.toFixed(2)} · c = 1`;
  $("performance").textContent =
    (running ? "Running" : "Paused") + ` · ${data.cost.toFixed(1)} ms / batch`;
  const s = state.summary;
  $("mass").textContent = s.moving.toFixed(3);
  $("carried").textContent = s.carried.toFixed(3);
  $("held").textContent = s.held.toFixed(3) + " / " + s.flight.toFixed(3);
  $("collisions").textContent = s.totals.collision.toFixed(3);
  $("budget").textContent = s.error.toExponential(1);
  $("notice").textContent = s.stopped || "";
  if (!history.length || history.at(-1).t !== s.t) history.push({ ...s });
  if (history.length > 1500) history.shift();
  draw();
};
function surface(canvas) {
  const dpr = Math.min(devicePixelRatio, 2),
    r = canvas.getBoundingClientRect(),
    w = Math.max(1, r.width),
    h = Math.max(1, r.height);
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const c = canvas.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);
  return { c, w, h };
}
function draw() {
  if (!state) return;
  const { c, w, h } = surface($("field")),
    zoom = $("zoom").checked;
  const vw = zoom ? 20 : Math.max(state.w, (state.h * w) / h),
    vh = (vw * h) / w,
    cx = (state.w - 1) / 2,
    cy = (state.h - 1) / 2,
    x0 = cx - vw / 2,
    y0 = cy - vh / 2,
    scale = w / vw;
  domain = { x0, y0, scale };
  const X = (x) => (x - x0 + 0.5) * scale,
    Y = (y) => (y - y0 + 0.5) * scale;
  const mode = $("view").value;
  for (let y = Math.max(0, Math.floor(y0)); y < Math.min(state.h, Math.ceil(y0 + vh) + 1); y++)
    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(state.w, Math.ceil(x0 + vw) + 1); x++) {
      const i = y * state.w + x,
        rho = state.rho[i];
      let color;
      if (mode === "content") {
        const d = Math.min(1, Math.max(0, (1 - rho) * 2)),
          over = Math.min(1, Math.max(0, (rho - 1) * 2));
        color = `rgb(${Math.round(21 + 27 * d + 186 * over)},${Math.round(31 + 91 * d + 181 * over)},${Math.round(41 + 131 * d + 178 * over)})`;
      } else if (mode === "response") {
        const q = state.q[i],
          v = Math.min(1, Math.abs(q) * 5);
        color =
          q > 0
            ? `rgb(${20 + 20 * v},${30 + 140 * v},${43 + 170 * v})`
            : `rgb(${20 + 210 * v},${30 + 140 * v},${43 + 60 * v})`;
      } else {
        const field =
            mode === "compression"
              ? state.held
              : mode === "birth"
                ? state.birthMap
                : mode === "return"
                  ? state.returnMap
                  : state.debit,
          v = Math.min(1, field[i] * 2);
        color =
          mode === "birth"
            ? `rgb(${20 + 220 * v},${28 + 160 * v},${38 + 80 * v})`
            : `rgb(${20 + 210 * v},${28 + 210 * v},${38 + 210 * v})`;
      }
      c.fillStyle = color;
      c.fillRect((x - x0) * scale, (y - y0) * scale, scale + 0.5, scale + 0.5);
      if (zoom) {
        c.strokeStyle = "#b2d0e00c";
        c.lineWidth = 0.5;
        c.strokeRect((x - x0) * scale, (y - y0) * scale, scale, scale);
      }
      if (mode === "content" && state.held[i] > 0.001) {
        c.fillStyle = `rgba(244,243,229,${Math.min(0.9, state.held[i] * 2)})`;
        c.fillRect((x - x0 + 0.18) * scale, (y - y0 + 0.18) * scale, 0.64 * scale, 0.64 * scale);
      }
    }
  if ($("paths").checked) {
    c.lineWidth = 1;
    c.strokeStyle = "#edcc7855";
    for (const [, path] of state.paths) {
      if (path.length < 2) continue;
      c.beginPath();
      path.forEach((p, i) => (i ? c.lineTo(X(p[1]), Y(p[2])) : c.moveTo(X(p[1]), Y(p[2]))));
      c.stroke();
    }
  }
  for (const f of state.releaseSignals ?? []) {
    const u = Math.max(0, Math.min(1, (state.t - f.start) / Math.max(1e-9, f.arrive - f.start))),
      x = f.x + (f.tx - f.x) * u,
      y = f.y + (f.ty - f.y) * u;
    c.strokeStyle = "#d69edc";
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(X(x), Y(y), Math.max(2, Math.min(scale * 0.15, 5)), 0, Math.PI * 2);
    c.stroke();
  }
  for (const f of state.flights) {
    const u = Math.max(0, Math.min(1, (state.t - f.start) / (f.arrive - f.start))),
      x = f.x + (f.tx - f.x) * u,
      y = f.y + (f.ty - f.y) * u;
    c.fillStyle = "#7cd9e2";
    c.beginPath();
    c.arc(X(x), Y(y), Math.max(1.2, Math.min(scale * 0.15, 3)), 0, Math.PI * 2);
    c.fill();
  }
  for (const a of state.cohorts) {
    const x = X(a.x),
      y = Y(a.y),
      length = Math.max(3, Math.min(scale * 0.7, 13)),
      ux = Math.cos(a.a),
      uy = Math.sin(a.a);
    c.strokeStyle = "#f5d390";
    c.lineWidth = Math.max(1, Math.min(3, Math.sqrt(a.m) * 4));
    c.beginPath();
    c.moveTo(x - ux * length * 0.4, y - uy * length * 0.4);
    c.lineTo(x + ux * length * 0.6, y + uy * length * 0.6);
    c.stroke();
    c.fillStyle = "#f7dda6";
    c.beginPath();
    c.moveTo(x + ux * length * 0.8, y + uy * length * 0.8);
    c.lineTo(x + uy * 2, y - ux * 2);
    c.lineTo(x - uy * 2, y + ux * 2);
    c.closePath();
    c.fill();
  }
  plotBirths();
  plotAccount();
}
function axes(canvas, maxX, maxY, yLabel) {
  const { c, w, h } = surface(canvas);
  const l = 28,
    r = w - 10,
    t = 8,
    b = h - 20;
  c.strokeStyle = "#34414a";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(l, t);
  c.lineTo(l, b);
  c.lineTo(r, b);
  c.stroke();
  c.fillStyle = "#8496a5";
  c.font = "9px -apple-system,sans-serif";
  c.fillText("0", l - 12, b + 3);
  c.fillText(maxY.toFixed(1), 0, t + 5);
  c.fillText(maxX.toFixed(0) + " time", r - 40, h - 3);
  c.fillText(yLabel, l + 5, t + 3);
  return {
    c,
    X: (v) => l + (v / Math.max(1, maxX)) * (r - l),
    Y: (v) => b - (v / Math.max(0.01, maxY)) * (b - t),
    l,
    r,
    t,
    b,
  };
}
function plotBirths() {
  const births = state.births,
    dist = (b) => Math.hypot(b.x - Math.floor(state.w / 2), b.y - Math.floor(state.h / 2)),
    maxR = Math.max(3, ...births.map(dist)),
    a = axes($("birthPlot"), Math.max(10, state.t), maxR, "cells from initial dip");
  a.c.fillStyle = "#edc97d";
  for (const b of births) {
    a.c.beginPath();
    a.c.arc(a.X(b.t), a.Y(dist(b)), 2.5, 0, Math.PI * 2);
    a.c.fill();
  }
}
function plotAccount() {
  const max = Math.max(0.1, ...history.map((s) => Math.max(s.moving, s.held, s.flight, s.carried))),
    a = axes($("accountPlot"), Math.max(10, state.t), max, "content");
  for (const [key, color] of [
    ["moving", "#edc97d"],
    ["held", "#e4ebef"],
    ["flight", "#74cedc"],
    ["carried", "#bd9ddb"],
  ]) {
    a.c.strokeStyle = color;
    a.c.lineWidth = 1.5;
    a.c.beginPath();
    history.forEach((s, i) =>
      i ? a.c.lineTo(a.X(s.t), a.Y(s[key])) : a.c.moveTo(a.X(s.t), a.Y(s[key])),
    );
    a.c.stroke();
  }
}
$("field").onmousemove = (e) => {
  if (!state || !domain) return;
  const r = $("field").getBoundingClientRect(),
    x = Math.floor((e.clientX - r.left) / domain.scale + domain.x0),
    y = Math.floor((e.clientY - r.top) / domain.scale + domain.y0);
  if (x < 0 || y < 0 || x >= state.w || y >= state.h) return;
  const i = y * state.w + x;
  $("readout").textContent =
    `Cell (${x}, ${y}) · free ${state.rho[i].toFixed(4)} · compression ${state.held[i].toFixed(4)} · response ${state.q[i].toFixed(4)}`;
};
new ResizeObserver(draw).observe($("field"));
document.addEventListener("visibilitychange", () => {
  if (document.hidden && running) worker.postMessage({ type: "run", running: false });
});
fetch("./evidence/results.json")
  .then((r) => r.json())
  .then((data) => {
    $("evidenceIntro").textContent =
      `${data.cases.length} baseline experiments and 21 geometry comparisons cover conversion, wear, contact, steering and bulk speed. Some same-birth pairs return into contact; sustained circulation remains unresolved.`;
    for (const row of data.cases) {
      const tr = document.createElement("tr");
      for (const value of [
        row.name,
        row.birthSites.length,
        row.birthExtent.toFixed(2) + " cells",
        row.summary.totals.exported.toFixed(3),
        row.summary.totals.collision.toFixed(3),
      ]) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      $("results").append(tr);
    }
  })
  .catch(() => {
    $("evidenceIntro").textContent =
      "Saved evidence could not be loaded. Run the local experiment suite to regenerate it.";
  });
const wideLayout = matchMedia("(min-width: 761px)");
$("settings").open = wideLayout.matches;
wideLayout.addEventListener("change", (e) => {
  $("settings").open = e.matches;
});
$("zoom").checked = true;
reset();

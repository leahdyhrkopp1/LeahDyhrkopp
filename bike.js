// Interactive charts for the bike rental case study (HW5, Programming for Analytics).
// Data comes from bike-data.js: the same day_missing.csv the notebook uses, after
// the notebook's cleaning steps (IQR outlier rule at 2.1×, mean imputation).
(function () {
  const B = window.BIKE;
  if (!B) return;

  const F = Object.fromEntries(B.fields.map((f, i) => [f, i]));
  const rows = B.rows.map((r) => ({
    date: r[F.date],
    season: r[F.season],
    weather: r[F.weather],
    workingday: r[F.workingday],
    tempRaw: r[F.temp_raw],
    temp: r[F.temp],
    tempOut: !!r[F.temp_out],
    cnt: r[F.cnt],
    casual: r[F.casual],
    casualOut: !!r[F.casual_out],
    registered: r[F.registered],
  }));

  const C = {
    ink: "#2b1b1e",
    axis: "#6b5a5c",
    grid: "#e8dcc8",
    surface: "#fbf7ef",
    maroon: "#6e1a2b",
    tint: "#dcc6c1",
    weather: { 1: "#b07a1c", 2: "#a12a41", 3: "#3a78b5" },
    day: { 1: "#a12a41", 0: "#b07a1c" },
  };
  const WEATHER = { 1: "Clear", 2: "Mist", 3: "Light rain or snow" };
  const DAY = { 1: "Working day", 0: "Non-working day" };
  const SEASONS = ["Winter", "Spring", "Summer", "Fall"];

  const fmt = (n) => Math.round(n).toLocaleString("en-US");
  const fmtDate = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  // The dataset stores temperature divided by 41 °C.
  const toF = (t) => Math.round((t * 41 * 9) / 5 + 32);

  // ---------- Tooltip ----------
  const tip = document.createElement("div");
  tip.className = "tooltip";
  tip.setAttribute("role", "status");
  document.body.appendChild(tip);
  function showTip(html, e) {
    tip.innerHTML = html;
    tip.classList.add("show");
    const pad = 14;
    const r = tip.getBoundingClientRect();
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad;
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }
  const hideTip = () => tip.classList.remove("show");
  addEventListener("scroll", hideTip, { passive: true });

  // ---------- SVG helpers ----------
  const NS = "http://www.w3.org/2000/svg";
  function el(name, attrs, parent) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function text(parent, x, y, str, attrs = {}) {
    const t = el("text", Object.assign({ x, y, "font-size": 11, fill: C.axis }, attrs), parent);
    t.textContent = str;
    return t;
  }
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
  }
  function ticks(max, target = 4) {
    const step = niceStep(max / target);
    const top = Math.ceil(max / step) * step;
    const out = [];
    for (let v = 0; v <= top + 1e-9; v += step) out.push(+v.toFixed(6));
    return { top, list: out };
  }
  function frame(container, height, m) {
    container.innerHTML = "";
    const width = Math.max(container.clientWidth, 280);
    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, role: "img" }, container);
    return { svg, width, height, x0: m.l, x1: width - m.r, y0: height - m.b, y1: m.t };
  }
  function gridY(f, yScale, tickList, label) {
    tickList.forEach((v) => {
      const y = yScale(v);
      el("line", { x1: f.x0, x2: f.x1, y1: y, y2: y, stroke: C.grid }, f.svg);
      text(f.svg, f.x0 - 8, y + 4, label(v), { "text-anchor": "end" });
    });
  }
  function gridX(f, xScale, tickList, label) {
    tickList.forEach((v) => {
      const x = xScale(v);
      el("line", { x1: x, x2: x, y1: f.y1, y2: f.y0, stroke: C.grid }, f.svg);
      text(f.svg, x, f.y0 + 16, label(v), { "text-anchor": "middle" });
    });
  }
  function axisTitle(f, xTitle, yTitle) {
    if (xTitle) text(f.svg, (f.x0 + f.x1) / 2, f.height - 4, xTitle, { "text-anchor": "middle", fill: C.ink, "font-size": 12 });
    if (yTitle) {
      const t = text(f.svg, 0, 0, yTitle, { "text-anchor": "middle", fill: C.ink, "font-size": 12 });
      t.setAttribute("transform", `translate(14 ${(f.y0 + f.y1) / 2}) rotate(-90)`);
    }
  }
  // Nearest-point hover for scatter plots: one overlay, hit radius bigger than the mark.
  function nearestHover(f, pts, html) {
    const ring = el("circle", { r: 7, fill: "none", stroke: C.ink, "stroke-width": 1.5, opacity: 0 }, f.svg);
    const overlay = el("rect", { x: f.x0, y: f.y1, width: f.x1 - f.x0, height: f.y0 - f.y1, fill: "transparent" }, f.svg);
    overlay.addEventListener("mousemove", (e) => {
      const box = f.svg.getBoundingClientRect();
      const sx = f.width / box.width;
      const mx = (e.clientX - box.left) * sx;
      const my = (e.clientY - box.top) * sx;
      let best = null;
      let bd = 22 * 22;
      for (const p of pts) {
        const d = (p.x - mx) ** 2 + (p.y - my) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
      if (best) {
        ring.setAttribute("cx", best.x);
        ring.setAttribute("cy", best.y);
        ring.setAttribute("opacity", 1);
        showTip(html(best.d), e);
      } else {
        ring.setAttribute("opacity", 0);
        hideTip();
      }
    });
    overlay.addEventListener("mouseleave", () => { ring.setAttribute("opacity", 0); hideTip(); });
  }
  function legend(container, items, state, onChange) {
    container.innerHTML = "";
    items.forEach(({ key, label, color }) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "legend-btn";
      b.setAttribute("aria-pressed", String(state[key]));
      b.innerHTML = `<span class="swatch" style="background:${color}"></span>${label}`;
      b.addEventListener("click", () => {
        const on = Object.values(state).filter(Boolean).length;
        if (state[key] && on === 1) return; // keep at least one series visible
        state[key] = !state[key];
        b.setAttribute("aria-pressed", String(state[key]));
        onChange();
      });
      container.appendChild(b);
    });
  }

  // ---------- 1. Cleaning: temperature before vs after ----------
  const cleanState = { view: "before" };
  function renderClean() {
    const box = document.getElementById("chart-clean");
    const f = frame(box, 300, { l: 52, r: 18, t: 16, b: 44 });
    f.svg.setAttribute("aria-label", cleanState.view === "before" ? "Raw temperature values, with six impossible outliers far to the right" : "Histogram of cleaned temperature values");
    document.getElementById("clean-kurt").textContent = cleanState.view === "before" ? "162.45" : "−1.06";
    document.getElementById("clean-kurt-label").textContent = cleanState.view === "before" ? "Kurtosis before cleaning" : "Kurtosis after cleaning";

    if (cleanState.view === "before") {
      const vals = rows.filter((r) => r.tempRaw != null);
      const t = ticks(60, 6);
      const x = (v) => f.x0 + (v / t.top) * (f.x1 - f.x0);
      gridX(f, x, t.list, (v) => v);
      axisTitle(f, "Recorded temperature value (should be between 0 and 1)", null);
      const mid = (f.y0 + f.y1) / 2;
      const pts = [];
      vals.forEach((r, i) => {
        const jitter = ((i * 37) % 100) / 100 - 0.5;
        const px = x(r.tempRaw);
        const py = mid + jitter * (r.tempOut ? 40 : 120);
        el("circle", { cx: px, cy: py, r: r.tempOut ? 6 : 2.5, fill: r.tempOut ? C.maroon : C.tint, stroke: C.surface, "stroke-width": r.tempOut ? 2 : 0.5 }, f.svg);
        pts.push({ x: px, y: py, d: r });
      });
      let lastX = -Infinity;
      let lift = 0;
      vals.filter((r) => r.tempOut).sort((a, b) => a.tempRaw - b.tempRaw).forEach((r) => {
        const lx = x(r.tempRaw);
        lift = lx - lastX < 40 ? lift + 16 : 0;
        lastX = lx;
        text(f.svg, lx, mid - 34 - lift, r.tempRaw.toFixed(2), { "text-anchor": "middle", fill: C.ink, "font-weight": 600 });
      });
      const normal = vals.filter((r) => !r.tempOut).length;
      text(f.svg, x(1) + 10, f.y1 + 14, `← ${normal} normal days, all squeezed between 0 and 1`, { fill: C.ink });
      nearestHover(f, pts, (r) => `<strong>${fmtDate(r.date)}</strong>Recorded value: ${r.tempRaw}${r.tempOut ? '<br><span class="t-muted">Impossible on a 0–1 scale</span>' : ""}`);
    } else {
      const bins = 20;
      const counts = Array.from({ length: bins }, () => ({ n: 0, filled: 0 }));
      rows.forEach((r) => {
        const b = Math.min(bins - 1, Math.floor(r.temp * bins));
        counts[b].n++;
        if (r.tempOut) counts[b].filled++;
      });
      const yt = ticks(Math.max(...counts.map((c) => c.n)), 4);
      const x = (v) => f.x0 + v * (f.x1 - f.x0);
      const y = (v) => f.y0 - (v / yt.top) * (f.y0 - f.y1);
      gridY(f, y, yt.list, (v) => v);
      [0, 0.25, 0.5, 0.75, 1].forEach((v) => text(f.svg, x(v), f.y0 + 16, v, { "text-anchor": "middle" }));
      axisTitle(f, "Cleaned temperature (0 to 1)", "Days");
      const bw = (f.x1 - f.x0) / bins;
      counts.forEach((c, i) => {
        const bx = x(i / bins) + 1;
        const w = bw - 2;
        const realH = y(0) - y(c.n - c.filled);
        const fillH = y(0) - y(c.filled);
        el("rect", { x: bx, y: y(c.n - c.filled), width: w, height: realH, fill: C.maroon, rx: 2 }, f.svg);
        if (c.filled) el("rect", { x: bx, y: y(c.n), width: w, height: fillH - 2, fill: "#b07a1c", rx: 2 }, f.svg);
        const hit = el("rect", { x: bx - 1, y: f.y1, width: bw, height: f.y0 - f.y1, fill: "transparent" }, f.svg);
        const lo = (i / bins).toFixed(2);
        const hi = ((i + 1) / bins).toFixed(2);
        hit.addEventListener("mousemove", (e) => showTip(`<strong>${lo}–${hi}</strong>${c.n} days (about ${toF(+lo)}–${toF(+hi)}°F)${c.filled ? `<br><span class="t-muted">Includes the ${c.filled} outliers, now filled with the mean</span>` : ""}`, e));
        hit.addEventListener("mouseleave", hideTip);
      });
    }
  }
  document.querySelectorAll("[data-clean]").forEach((b) =>
    b.addEventListener("click", () => {
      cleanState.view = b.dataset.clean;
      document.querySelectorAll("[data-clean]").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
      hideTip();
      renderClean();
    })
  );

  // ---------- 2. Temperature vs rentals by weather ----------
  const weatherOn = { 1: true, 2: true, 3: true };
  function renderWeatherShare() {
    const box = document.getElementById("weather-share");
    const total = Object.values(B.weather).reduce((a, w) => a + w.sum, 0);
    box.innerHTML = "";
    [1, 2, 3].forEach((k) => {
      const w = B.weather[k];
      const share = (w.sum / total) * 100;
      const seg = document.createElement("div");
      seg.className = "share-seg";
      seg.style.flex = Math.max(share, 1.6);
      seg.style.background = C.weather[k];
      seg.addEventListener("mousemove", (e) => showTip(`<strong>${WEATHER[k]}</strong>${share.toFixed(1)}% of all rentals<br><span class="t-muted">${fmt(w.sum)} rentals over ${w.days} days</span>`, e));
      seg.addEventListener("mouseleave", hideTip);
      box.appendChild(seg);
    });
    document.getElementById("weather-share-labels").innerHTML = [1, 2, 3]
      .map((k) => `<span><span class="swatch" style="background:${C.weather[k]}"></span>${WEATHER[k]} ${((B.weather[k].sum / total) * 100).toFixed(0)}%</span>`)
      .join("");
  }
  function renderTemp() {
    const box = document.getElementById("chart-temp");
    const f = frame(box, 340, { l: 56, r: 16, t: 12, b: 44 });
    f.svg.setAttribute("aria-label", "Scatter plot of temperature against daily rentals, colored by weather");
    const data = rows.filter((r) => r.cnt != null && weatherOn[r.weather]);
    const yt = ticks(9000, 4);
    const x = (v) => f.x0 + v * (f.x1 - f.x0);
    const y = (v) => f.y0 - (v / yt.top) * (f.y0 - f.y1);
    gridY(f, y, yt.list, (v) => fmt(v));
    [0, 0.25, 0.5, 0.75, 1].forEach((v) => {
      el("line", { x1: x(v), x2: x(v), y1: f.y1, y2: f.y0, stroke: C.grid }, f.svg);
      text(f.svg, x(v), f.y0 + 16, `${v} (${toF(v)}°F)`, { "text-anchor": "middle" });
    });
    axisTitle(f, "Temperature", "Daily rentals");
    const pts = [];
    [1, 2, 3].forEach((k) =>
      data.filter((r) => r.weather === k).forEach((r) => {
        const px = x(r.temp);
        const py = y(r.cnt);
        el("circle", { cx: px, cy: py, r: 3.6, fill: C.weather[k], "fill-opacity": 0.8, stroke: C.surface, "stroke-width": 1 }, f.svg);
        pts.push({ x: px, y: py, d: r });
      })
    );
    nearestHover(f, pts, (r) => `<strong>${fmtDate(r.date)}</strong>${fmt(r.cnt)} rentals<br>${WEATHER[r.weather]}, about ${toF(r.temp)}°F`);
  }
  legend(document.getElementById("legend-temp"), [1, 2, 3].map((k) => ({ key: k, label: WEATHER[k], color: C.weather[k] })), weatherOn, renderTemp);

  // ---------- 3. Rentals by season (box plots) ----------
  function renderSeason() {
    const box = document.getElementById("chart-season");
    const f = frame(box, 320, { l: 56, r: 16, t: 12, b: 36 });
    f.svg.setAttribute("aria-label", "Box plots of daily rentals by season");
    const yt = ticks(9000, 4);
    const y = (v) => f.y0 - (v / yt.top) * (f.y0 - f.y1);
    gridY(f, y, yt.list, (v) => fmt(v));
    const band = (f.x1 - f.x0) / SEASONS.length;
    const bw = Math.min(64, band * 0.42);
    SEASONS.forEach((s, i) => {
      const b = B.box[s];
      const cx = f.x0 + band * (i + 0.5);
      el("line", { x1: cx, x2: cx, y1: y(b.lo), y2: y(b.q1), stroke: C.maroon, "stroke-width": 1.5 }, f.svg);
      el("line", { x1: cx, x2: cx, y1: y(b.q3), y2: y(b.hi), stroke: C.maroon, "stroke-width": 1.5 }, f.svg);
      [b.lo, b.hi].forEach((v) => el("line", { x1: cx - bw / 4, x2: cx + bw / 4, y1: y(v), y2: y(v), stroke: C.maroon, "stroke-width": 1.5 }, f.svg));
      el("rect", { x: cx - bw / 2, y: y(b.q3), width: bw, height: y(b.q1) - y(b.q3), fill: C.tint, stroke: C.maroon, "stroke-width": 1.5, rx: 4 }, f.svg);
      el("line", { x1: cx - bw / 2, x2: cx + bw / 2, y1: y(b.med), y2: y(b.med), stroke: C.maroon, "stroke-width": 3 }, f.svg);
      b.out.forEach((v) => el("circle", { cx, cy: y(v), r: 3.5, fill: "none", stroke: C.maroon, "stroke-width": 1.5 }, f.svg));
      text(f.svg, cx, f.y0 + 18, s, { "text-anchor": "middle", fill: C.ink, "font-size": 12.5 });
      const hit = el("rect", { x: cx - band / 2, y: f.y1, width: band, height: f.y0 - f.y1, fill: "transparent" }, f.svg);
      hit.addEventListener("mousemove", (e) => showTip(`<strong>${s}</strong>Median: ${fmt(b.med)} rentals<br>Middle 50%: ${fmt(b.q1)}–${fmt(b.q3)}<br><span class="t-muted">${b.n} days</span>`, e));
      hit.addEventListener("mouseleave", hideTip);
    });
    axisTitle(f, null, "Daily rentals");
  }

  // ---------- 4. Casual vs registered riders ----------
  const dayOn = { 1: true, 0: true };
  function renderRiders() {
    const box = document.getElementById("chart-riders");
    const f = frame(box, 340, { l: 56, r: 16, t: 12, b: 44 });
    f.svg.setAttribute("aria-label", "Scatter plot of casual against registered riders, colored by working day");
    const data = rows.filter((r) => r.registered != null && dayOn[r.workingday]);
    const xt = ticks(3500, 4);
    const yt = ticks(7000, 4);
    const x = (v) => f.x0 + (v / xt.top) * (f.x1 - f.x0);
    const y = (v) => f.y0 - (v / yt.top) * (f.y0 - f.y1);
    gridY(f, y, yt.list, (v) => fmt(v));
    gridX(f, x, xt.list, (v) => fmt(v));
    axisTitle(f, "Casual riders per day", "Registered riders per day");
    const pts = [];
    [1, 0].forEach((k) =>
      data.filter((r) => r.workingday === k).forEach((r) => {
        const px = x(r.casual);
        const py = y(r.registered);
        el("circle", { cx: px, cy: py, r: 3.6, fill: C.day[k], "fill-opacity": 0.8, stroke: C.surface, "stroke-width": 1 }, f.svg);
        pts.push({ x: px, y: py, d: r });
      })
    );
    nearestHover(f, pts, (r) => `<strong>${fmtDate(r.date)}</strong>${DAY[r.workingday]}<br>${fmt(r.casual)} casual · ${fmt(r.registered)} registered${r.casualOut ? '<br><span class="t-muted">Casual count was an outlier, filled with the mean</span>' : ""}`);
  }
  legend(document.getElementById("legend-riders"), [1, 0].map((k) => ({ key: k, label: DAY[k], color: C.day[k] })), dayOn, renderRiders);

  // ---------- Render ----------
  function renderAll() {
    renderClean();
    renderWeatherShare();
    renderTemp();
    renderSeason();
    renderRiders();
  }
  let t;
  addEventListener("resize", () => { clearTimeout(t); t = setTimeout(renderAll, 120); });
  renderAll();
})();

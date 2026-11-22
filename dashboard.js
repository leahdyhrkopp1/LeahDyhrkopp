// Interactive recreation of the "Executive Overview" dashboard from my Tableau final.
// Mirrors the workbook: Number of Applicants = COUNTD(Student ID), a Mean/Median salary
// parameter, an average reference line on salary, and a country filter action that
// drives the other two views. Data: assets/js/admissions-data.js (aggregated, no IDs).
(function () {
  const D = window.ADMISSIONS;
  if (!D) return;

  const C = {
    bar: "#6e1a2b",
    barFaded: "#dcc6c1",
    barLow: "#c4949d",
    grid: "#e8dcc8",
    axis: "#6b5a5c",
    ink: "#2b1b1e",
    ref: "#8a6a3a",
  };

  const STATUS_ORDER = ["Inquiry", "App In Process", "WITHDREW", "DENY", "DEFER", "MATRICULATED"];
  const STATUS_LABEL = {
    Inquiry: "Inquiry",
    "App In Process": "In process",
    WITHDREW: "Withdrew",
    DENY: "Denied",
    DEFER: "Deferred",
    MATRICULATED: "Matriculated",
  };
  const DECIDED = ["WITHDREW", "DENY", "DEFER", "MATRICULATED"];

  const state = { country: null, measure: "Mean" };

  const fmtInt = (n) => n.toLocaleString("en-US");
  const fmtUSD = (n) => "$" + Math.round(n).toLocaleString("en-US");
  const fmtK = (n) => "$" + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + "K";
  const pct = (a, b) => (b ? ((a / b) * 100).toFixed(1) + "%" : "–");
  const median = (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const countryName = (code) => (D.countries.find((c) => c.code === code) || {}).name || code;

  // ---------- Tooltip ----------
  const tip = document.createElement("div");
  tip.className = "tooltip";
  tip.setAttribute("role", "status");
  document.body.appendChild(tip);
  function showTip(html, evt) {
    tip.innerHTML = html;
    tip.classList.add("show");
    moveTip(evt);
  }
  function moveTip(evt) {
    const pad = 14;
    const r = tip.getBoundingClientRect();
    let x = evt.clientX + pad;
    let y = evt.clientY + pad;
    if (x + r.width > window.innerWidth - 8) x = evt.clientX - r.width - pad;
    if (y + r.height > window.innerHeight - 8) y = evt.clientY - r.height - pad;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }
  const hideTip = () => tip.classList.remove("show");

  // ---------- SVG helpers ----------
  const NS = "http://www.w3.org/2000/svg";
  function el(name, attrs, parent) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  // Horizontal bar with a 4px rounded data end, square at the baseline.
  function barPath(x, y, w, h, r) {
    r = Math.min(r, w, h / 2);
    if (w <= 0) return "";
    return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  }
  function niceMax(v) {
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / p;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * p;
  }

  /**
   * Horizontal bar chart.
   * rows: [{key,label,value,fill,tip,onClick,ariaLabel}]
   */
  function hbars(container, rows, opts) {
    container.innerHTML = "";
    const width = Math.max(container.clientWidth, 280);
    const narrow = width < 460;
    const labelW = Math.min(opts.labelW || 130, Math.round(width * (narrow ? 0.45 : 0.36)));
    const labelSize = narrow ? 11.5 : 12.5;
    const valueW = narrow ? 52 : 64;
    const rowH = opts.rowH || 30;
    const barH = opts.barH || 16;
    const top = opts.top || 8;
    const height = top + rows.length * rowH + 26;
    const plotW = width - labelW - valueW;
    const rawMax = opts.max || Math.max(...rows.map((r) => r.value), 1);
    const step = niceMax(rawMax / 4);
    const max = Math.ceil(rawMax / step) * step;
    const ticks = Math.round(max / step);
    const x = (v) => (v / max) * plotW;

    const svg = el("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-label": opts.aria }, container);

    // Gridlines + axis ticks (recessive)
    for (let i = 0; i <= ticks; i++) {
      const v = step * i;
      const gx = labelW + x(v);
      el("line", { x1: gx, x2: gx, y1: top - 4, y2: height - 22, stroke: C.grid, "stroke-width": 1 }, svg);
      const every = Math.ceil(46 / (plotW / ticks));
      if (i % every !== 0 && i !== ticks) continue;
      if (i !== ticks && i + every > ticks && ticks - i < every) continue;
      const t = el("text", { x: gx, y: height - 6, "text-anchor": "middle", "font-size": 11, fill: C.axis }, svg);
      t.textContent = opts.tickFmt ? opts.tickFmt(v) : fmtInt(v);
    }

    rows.forEach((r, i) => {
      const y = top + i * rowH;
      const by = y + (rowH - barH) / 2;
      const g = el("g", {}, svg);
      const lab = el("text", { x: labelW - 10, y: y + rowH / 2 + 4, "text-anchor": "end", "font-size": labelSize, fill: C.ink }, g);
      lab.textContent = r.label;
      el("path", { d: barPath(labelW, by, Math.max(x(r.value), 2), barH, 4), fill: r.fill || C.bar, class: "bar" }, g);
      const val = el("text", { x: labelW + x(r.value) + 8, y: y + rowH / 2 + 4, "font-size": 12, fill: C.axis, "font-variant-numeric": "tabular-nums" }, g);
      val.textContent = r.valueLabel;
      // Hit target larger than the mark
      const hit = el("rect", { x: 0, y, width, height: rowH, class: "hit", tabindex: r.onClick ? 0 : -1, "aria-label": r.ariaLabel || r.label }, g);
      if (r.onClick) hit.setAttribute("role", "button");
      hit.addEventListener("mousemove", (e) => showTip(r.tip, e));
      hit.addEventListener("mouseenter", (e) => showTip(r.tip, e));
      hit.addEventListener("mouseleave", hideTip);
      if (r.onClick) {
        hit.addEventListener("click", r.onClick);
        hit.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            r.onClick();
          }
        });
      }
    });

    if (opts.refValue != null) {
      const rx = labelW + x(opts.refValue);
      el("line", { x1: rx, x2: rx, y1: top - 6, y2: height - 22, stroke: C.ref, "stroke-width": 1.5, "stroke-dasharray": "4 4" }, svg);
      const t = el("text", { x: rx + 6, y: top + 2, "font-size": 11, "font-weight": 600, fill: C.ref }, svg);
      t.textContent = opts.refLabel;
    }
  }

  // ---------- Data selectors ----------
  function statusCounts() {
    return D.status[state.country || "ALL"] || {};
  }
  function salaryRecords() {
    return state.country ? D.salaries.filter((s) => s[0] === state.country) : D.salaries;
  }
  function industryStats() {
    const by = {};
    salaryRecords().forEach(([, ind, sal]) => (by[ind] = by[ind] || []).push(sal));
    return Object.entries(by)
      .map(([ind, arr]) => ({ ind, n: arr.length, mean: mean(arr), median: median(arr) }))
      .sort((a, b) => b[state.measure.toLowerCase()] - a[state.measure.toLowerCase()]);
  }

  // ---------- Render ----------
  const $ = (id) => document.getElementById(id);

  function renderKPIs() {
    const sc = statusCounts();
    const total = Object.values(sc).reduce((a, b) => a + b, 0);
    const decided = DECIDED.reduce((a, k) => a + (sc[k] || 0), 0);
    const mat = sc.MATRICULATED || 0;
    const sal = salaryRecords().map((s) => s[2]);
    $("kpi-applicants").textContent = fmtInt(total);
    $("kpi-matric").textContent = fmtInt(mat);
    $("kpi-rate").textContent = pct(mat, decided);
    $("kpi-salary").textContent = sal.length ? fmtK(state.measure === "Mean" ? mean(sal) : median(sal)) : "–";
    $("kpi-salary-label").textContent = `${state.measure} starting salary (${fmtInt(sal.length)} grads)`;
  }

  function renderCountries() {
    const rows = D.countries.map((c) => {
      const selected = state.country === c.code;
      const faded = state.country && !selected;
      return {
        key: c.code,
        label: c.name,
        value: c.n,
        valueLabel: fmtInt(c.n),
        fill: faded ? C.barFaded : C.bar,
        ariaLabel: `${c.name}: ${fmtInt(c.n)} applicants. ${selected ? "Selected. Press to clear filter." : "Press to filter."}`,
        tip: `<strong>${c.name}</strong>${fmtInt(c.n)} applicants<br><span class="t-muted">${selected ? "Click to clear filter" : "Click to filter the dashboard"}</span>`,
        onClick: () => setCountry(selected ? null : c.code),
      };
    });
    hbars($("chart-country"), rows, { labelW: 140, aria: "Applicants by country of origin", rowH: 28, barH: 15 });
  }

  function renderStatus() {
    const sc = statusCounts();
    const total = Object.values(sc).reduce((a, b) => a + b, 0);
    const rows = STATUS_ORDER.map((s) => {
      const v = sc[s] || 0;
      return {
        key: s,
        label: STATUS_LABEL[s],
        value: v,
        valueLabel: fmtInt(v),
        fill: C.bar,
        tip: `<strong>${STATUS_LABEL[s]}</strong>${fmtInt(v)} applicants · ${pct(v, total)} of total`,
      };
    });
    hbars($("chart-status"), rows, { labelW: 104, aria: "Applicants by admission status" });
  }

  function renderSalary() {
    const stats = industryStats();
    const key = state.measure.toLowerCase();
    const container = $("chart-salary");
    const note = $("salary-empty");
    if (!stats.length) {
      container.innerHTML = "";
      note.hidden = false;
      return;
    }
    note.hidden = true;
    const values = stats.map((s) => s[key]);
    const avg = mean(values);
    const rows = stats.map((s) => ({
      key: s.ind,
      label: s.ind,
      value: s[key],
      valueLabel: fmtK(s[key]),
      fill: s.n < 10 ? C.barLow : C.bar,
      tip: `<strong>${s.ind}</strong>${state.measure}: ${fmtUSD(s[key])}<br><span class="t-muted">${s.n} placement${s.n === 1 ? "" : "s"}${s.n < 10 ? " · small sample" : ""}</span>`,
    }));
    hbars(container, rows, {
      labelW: 170,
      max: Math.max(100000, Math.ceil(Math.max(...values) / 20000) * 20000),
      tickFmt: (v) => fmtK(v),
      aria: `${state.measure} starting salary by industry`,
      refValue: avg,
      refLabel: `Avg ${fmtK(avg)}`,
      top: 18,
      rowH: 26,
      barH: 14,
    });
  }

  function renderTable() {
    const sc = statusCounts();
    $("tbl-status").innerHTML =
      "<tr><th>Status</th><th class='num'>Applicants</th></tr>" +
      STATUS_ORDER.map((s) => `<tr><td>${STATUS_LABEL[s]}</td><td class="num">${fmtInt(sc[s] || 0)}</td></tr>`).join("");
    $("tbl-salary").innerHTML =
      "<tr><th>Industry</th><th class='num'>Placements</th><th class='num'>Mean</th><th class='num'>Median</th></tr>" +
      industryStats()
        .map((s) => `<tr><td>${s.ind}</td><td class="num">${s.n}</td><td class="num">${fmtUSD(s.mean)}</td><td class="num">${fmtUSD(s.median)}</td></tr>`)
        .join("");
  }

  function renderFilter() {
    const chip = $("filter-chip");
    if (state.country) {
      chip.classList.add("show");
      $("filter-name").textContent = countryName(state.country);
    } else {
      chip.classList.remove("show");
    }
    document.querySelectorAll("[data-filter-label]").forEach((n) => {
      n.textContent = state.country ? `Filtered to ${countryName(state.country)}` : "All countries";
    });
  }

  function render() {
    renderFilter();
    renderKPIs();
    renderCountries();
    renderStatus();
    renderSalary();
    renderTable();
  }

  function setCountry(code) {
    state.country = code;
    hideTip();
    render();
  }

  // ---------- Controls ----------
  $("filter-chip").addEventListener("click", () => setCountry(null));
  document.querySelectorAll("[data-measure]").forEach((b) =>
    b.addEventListener("click", () => {
      state.measure = b.dataset.measure;
      document.querySelectorAll("[data-measure]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      render();
    })
  );

  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(render, 120);
  });
  window.addEventListener("scroll", hideTip, { passive: true });

  render();
})();

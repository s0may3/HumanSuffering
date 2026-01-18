// js/sections/protection.js
import { markColor } from "../theme.js";

export async function update(ctx) {
  const { g, width, height, theme } = ctx;

  // clear
  g.marks.selectAll("*").remove();
  g.axes.selectAll("*").remove();
  g.anno.selectAll("*").remove();

  // ---------- tooltip ----------
  let tip = document.getElementById("viz-tooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "viz-tooltip";
    tip.style.position = "fixed";
    tip.style.pointerEvents = "none";
    tip.style.background = "rgba(2,6,23,92)";
    tip.style.border = "1px solid rgba(148,163,184,25)";
    tip.style.borderRadius = "10px";
    tip.style.padding = "8px 10px";
    tip.style.color = theme.text;
    tip.style.fontSize = "12px";
    tip.style.display = "none";
    tip.style.zIndex = "2147483647";
    document.body.appendChild(tip);
  } else {
    tip.style.zIndex = "2147483647";
  }

  const showTip = (event, html) => {
    tip.innerHTML = html;
    const pad = 12;
    tip.style.left = `${Math.min(window.innerWidth - 380, event.clientX + pad)}px`;
    tip.style.top = `${Math.min(window.innerHeight - 190, event.clientY + pad)}px`;
    tip.style.display = "block";
  };
  const hideTip = () => (tip.style.display = "none");

  // ---------- helpers ----------
  const parseYear = (d) => {
    if (!d) return null;
    const s = String(d).trim();
    if (/^\d{4}/.test(s)) return +s.slice(0, 4);
    const p = s.split(/[\/\-]/);
    return p.length === 3 ? +p[2] : null;
  };
  const toNumber = (x) => {
    const n = +String(x ?? "").replace(/,/g, "").trim();
    return Number.isFinite(n) ? n : 0;
  };
  const fmt = d3.format(",");

  async function tryLoadCsv(path) {
    try {
      const rows = await d3.csv(path);
      return rows && rows.length ? rows : null;
    } catch {
      return null;
    }
  }

  // ==========================================================
  // 0) Try PREPROCESSED first: data/processed/protection_composition.csv
  // ==========================================================
  const processedCandidates = [
    "./data/processed/protection_composition.csv",
    "./data/processed/protection_composition_by_year.csv",
    "./dataset/derived/protection_composition.csv",
    "./dataset/derived/protection_composition_by_year.csv",
  ];

  let processed = null;
  for (const p of processedCandidates) {
    processed = await tryLoadCsv(p);
    if (processed) break;
  }

  // We'll build `rows` = [{year, REF, ASY, RET, total}, ...]
  let rows = null;

  if (processed) {
    // detect columns robustly
    const keys = Object.keys(processed[0] || {});
    const lower = (s) => String(s || "").toLowerCase();

    const yearKey = keys.find(k => lower(k) === "year") || keys[0];
    const refKey  = keys.find(k => lower(k) === "ref")  || keys.find(k => lower(k).includes("ref")) || "REF";
    const asyKey  = keys.find(k => lower(k) === "asy")  || keys.find(k => lower(k).includes("asy")) || "ASY";
    const retKey  = keys.find(k => lower(k) === "ret")  || keys.find(k => lower(k).includes("ret")) || "RET";

    rows = processed
      .map(r => {
        const year = +r[yearKey];
        const REF = toNumber(r[refKey]);
        const ASY = toNumber(r[asyKey]);
        const RET = toNumber(r[retKey]);
        const total = REF + ASY + RET;
        return { year, REF, ASY, RET, total };
      })
      .filter(d => Number.isFinite(d.year) && d.total > 0)
      .sort((a, b) => a.year - b.year);
  }

  // ==========================================================
  // 1) Fallback: RAW aggregation (your current logic)
  // ==========================================================
  if (!rows) {
    const refugeesPath = "./dataset/hdx_hapi_refugees_afg.csv";
    const returneesCandidates = [
      "./dataset/hdx_hapi_returnees_afg.csv",
      "./dataset/hdx_hapi_afg_returnees.csv",
      "./dataset/hdx_hapi_returnees.csv",
    ];

    const refugees = await tryLoadCsv(refugeesPath);

    let returnees = null;
    for (const p of returneesCandidates) {
      returnees = await tryLoadCsv(p);
      if (returnees) break;
    }

    if (!refugees && !returnees) {
      g.marks.append("text")
        .attr("x", 18).attr("y", 30)
        .attr("fill", theme.text).attr("font-size", 13).attr("font-weight", 700)
        .text("Section 6: missing datasets");

      g.marks.append("text")
        .attr("x", 18).attr("y", 54)
        .attr("fill", theme.mutedText).attr("font-size", 12)
        .text("Expected at least ./dataset/hdx_hapi_refugees_afg.csv (and optionally returnees).");
      return;
    }

    const yearly = new Map(); // year => { REF, ASY, RET }
    function ensureYear(y) {
      if (!yearly.has(y)) yearly.set(y, { REF: 0, ASY: 0, RET: 0 });
      return yearly.get(y);
    }

    // REF/ASY from refugees dataset (origin AFG)
    if (refugees) {
      for (const r of refugees) {
        if ((r.origin_location_code || "").trim() !== "AFG") continue;
        const y = parseYear(r.reference_period_start);
        if (!y) continue;

        const group = (r.population_group || "").trim().toUpperCase();
        const pop = toNumber(r.population);
        if (pop <= 0) continue;

        if (group !== "REF" && group !== "ASY") continue;

        const row = ensureYear(y);
        row[group] += pop;
      }
    }

    // Returnees -> RET (best effort)
    if (returnees) {
      for (const r of returnees) {
        const y =
          parseYear(r.reference_period_start) ??
          parseYear(r.reference_period) ??
          parseYear(r.date) ??
          parseYear(r.period_start) ??
          (String(r.year || "").match(/^\d{4}$/) ? +r.year : null);

        if (!y) continue;

        const pop =
          toNumber(r.population) ||
          toNumber(r.value) ||
          toNumber(r.count) ||
          toNumber(r.returnees) ||
          0;

        if (pop <= 0) continue;

        const row = ensureYear(y);
        row.RET += pop;
      }
    }

    rows = Array.from(yearly.entries())
      .map(([year, d]) => {
        const total = (d.REF || 0) + (d.ASY || 0) + (d.RET || 0);
        return { year: +year, REF: d.REF || 0, ASY: d.ASY || 0, RET: d.RET || 0, total };
      })
      .filter(d => d.total > 0)
      .sort((a, b) => a.year - b.year);
  }

  if (!rows.length) {
    g.marks.append("text")
      .attr("x", 18).attr("y", 30)
      .attr("fill", theme.text).attr("font-size", 13).attr("font-weight", 700)
      .text("Section 6: no usable yearly totals found.");
    return;
  }

  const hasREF = rows.some(d => d.REF > 0);
  const hasASY = rows.some(d => d.ASY > 0);
  const hasRET = rows.some(d => d.RET > 0);

  // stack order: bottom -> top
  const keys = [];
  if (hasRET) keys.push("RET");
  if (hasREF) keys.push("REF");
  if (hasASY) keys.push("ASY");

  const shareRows = rows.map(d => ({
    year: d.year,
    RET: d.total ? d.RET / d.total : 0,
    REF: d.total ? d.REF / d.total : 0,
    ASY: d.total ? d.ASY / d.total : 0,
  }));

  // semantic colors (consistent with whole project palette)
  const C_RET = markColor("route");        // returnees = movement pathway
  const C_REF = markColor("destination");  // refugees = hosted population
  const C_ASY = markColor("pressure");     // asylum = protection pressure

  const color = (k) => (k === "RET" ? C_RET : k === "REF" ? C_REF : C_ASY);
  const labelKey = (k) => (k === "RET" ? "Returnees (RET)" : k === "REF" ? "Refugees (REF)" : "Asylum-seekers (ASY)");

  // ---------- layout ----------
  // More top space for title + subtitle; legend goes INSIDE plot frame
  const m = { top: 62, right: 18, bottom: 28, left: 46 };
  const W = Math.max(10, width - m.left - m.right);
  const H = Math.max(10, height - m.top - m.bottom);

  const root = g.marks.append("g")
    .attr("transform", `translate(${m.left},${m.top})`);

  // title & subtitle (above plot)
  g.anno.append("text")
    .attr("x", 16).attr("y", 16)
    .attr("fill", theme.context)
    .attr("font-size", 11)
    .text("Return & protection: outcome composition over time (100%)");

  g.anno.append("text")
    .attr("x", 16).attr("y", 32)
    .attr("fill", theme.mutedText)
    .attr("font-size", 10)
    .text("Stacked area = share. Hover to see counts + percentages.");

  // ---------- CLEAN LEGEND (inside chart frame, stacked order) ----------
  const leg = g.anno.append("g")
    .attr("transform", `translate(${m.left + 8}, ${m.top + 18})`);

  const legendItems = [];
  if (hasRET) legendItems.push({ key: "RET", label: "Returnees (RET)", color: C_RET, opacity: 0.80 });
  if (hasREF) legendItems.push({ key: "REF", label: "Refugees (REF)", color: C_REF, opacity: 0.75 });
  if (hasASY) legendItems.push({ key: "ASY", label: "Asylum-seekers (ASY)", color: C_ASY, opacity: 0.95 });

  legendItems.forEach((d, i) => {
    const gRow = leg.append("g").attr("transform", `translate(0, ${i * 18})`);

    gRow.append("rect")
      .attr("x", 0)
      .attr("y", -8)
      .attr("width", 12)
      .attr("height", 12)
      .attr("rx", 3)
      .attr("fill", d.color)
      .attr("opacity", d.opacity);

    gRow.append("text")
      .attr("x", 18)
      .attr("y", 2)
      .attr("fill", theme.mutedText)
      .attr("font-size", 11)
      .text(d.label);
  });

  // scales
  const x = d3.scaleLinear()
    .domain(d3.extent(shareRows, d => d.year))
    .range([0, W]);

  const y = d3.scaleLinear()
    .domain([0, 1])
    .range([H, 0]);

  // axes
  g.axes.append("g")
    .attr("transform", `translate(${m.left},${m.top + H})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")))
    .call(sel => sel.selectAll("path, line").attr("stroke", "rgba(148,163,184,22)"))
    .call(sel => sel.selectAll("text").attr("fill", theme.mutedText).attr("font-size", 10));

  g.axes.append("g")
    .attr("transform", `translate(${m.left},${m.top})`)
    .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".0%")))
    .call(sel => sel.selectAll("path, line").attr("stroke", "rgba(148,163,184,22)"))
    .call(sel => sel.selectAll("text").attr("fill", theme.mutedText).attr("font-size", 10));

  // subtle grid
  root.append("g")
    .attr("opacity", 0.16)
    .call(d3.axisLeft(y).ticks(5).tickSize(-W).tickFormat(""))
    .call(sel => sel.selectAll("path").remove())
    .call(sel => sel.selectAll("line").attr("stroke", "rgba(148,163,184,22)"));

  // stack + area
  const stack = d3.stack().keys(keys);
  const series = stack(shareRows);

  const area = d3.area()
    .x(d => x(d.data.year))
    .y0(d => y(d[0]))
    .y1(d => y(d[1]))
    .curve(d3.curveMonotoneX);

  root.selectAll("path.layer")
    .data(series)
    .enter()
    .append("path")
    .attr("class", "layer")
    .attr("fill", d => color(d.key))
    .attr("opacity", d => {
      if (d.key === "REF") return 0.75;
      if (d.key === "ASY") return 0.95;
      if (d.key === "RET") return 0.80;
      return 0.8;
    })
    .attr("d", d => area(d));

  // interaction: guide + tooltip
  const years = rows.map(d => d.year);
  const byYear = new Map(rows.map(d => [d.year, d]));
  const bisect = d3.bisector(d => d).left;

  const guide = root.append("line")
    .attr("y1", 0)
    .attr("y2", H)
    .attr("stroke", "rgba(251,191,36,35)")
    .attr("stroke-width", 1)
    .attr("opacity", 0);

  const overlay = root.append("rect")
    .attr("x", 0).attr("y", 0)
    .attr("width", W).attr("height", H)
    .attr("fill", "transparent")
    .style("cursor", "crosshair");

  function tooltipHtml(yVal) {
    const base = byYear.get(yVal);
    if (!base) return null;

    const parts = [];
    if (hasRET) parts.push({ k: "RET", v: base.RET, s: base.total ? base.RET / base.total : 0 });
    if (hasREF) parts.push({ k: "REF", v: base.REF, s: base.total ? base.REF / base.total : 0 });
    if (hasASY) parts.push({ k: "ASY", v: base.ASY, s: base.total ? base.ASY / base.total : 0 });

    const lines = parts
      .filter(p => p.v > 0)
      .map(p => `<div style="color:${theme.mutedText};">${labelKey(p.k)}: ${fmt(p.v)} <span style="opacity:.9">(${(p.s * 100).toFixed(1)}%)</span></div>`)
      .join("");

    return `
      <div style="font-weight:700;">Year: ${yVal}</div>
      <div style="color:${theme.mutedText}; margin-top:4px;">Total: ${fmt(base.total)}</div>
      <div style="margin-top:8px;">${lines || `<div style="color:${theme.mutedText};">No breakdown available</div>`}</div>
    `;
  }

  overlay
    .on("mouseenter", () => guide.attr("opacity", 1))
    .on("mouseleave", () => {
      guide.attr("opacity", 0);
      hideTip();
    })
    .on("mousemove", (event) => {
      const [mx] = d3.pointer(event, overlay.node());
      const yearApprox = x.invert(mx);
      const idx = Math.max(0, Math.min(years.length - 1, bisect(years, yearApprox)));
      const yVal = years[idx];

      guide.attr("x1", x(yVal)).attr("x2", x(yVal));

      const html = tooltipHtml(yVal);
      if (html) showTip(event, html);
    });
}

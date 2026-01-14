// js/storywide.js
// STORYWIDE (scrubbable autoplay) — simplified narrative (line-only) + story text:
// - Keeps ONLY the main (yellow) outflow line.
// - Replaces lower decorative visuals with a narrative text box that updates at the current scrub position.
// - Adds a clear legend for the yellow line.
// Interaction:
// - Autoplay starts when section enters view (runs until end, then stops)
// - Hover/move on chart: pauses + scrubs + shows tooltip
// - Click: toggle pause/resume
//
// Phases: 6 phases (5 & 6 are text-only refinements at the end).
//
// Requirements: global d3 loaded in index.html; local ./js/theme.js exists.

import { theme } from "./theme.js";

let hasInit = false;
let hasStarted = false;

const fmt = d3.format(",");

function parseYear(d) {
  if (!d) return null;
  const s = String(d).trim();
  if (/^\d{4}/.test(s)) return +s.slice(0, 4);
  const p = s.split(/[\/\-]/);
  return p.length === 3 ? +p[2] : null;
}
function toNumber(x) {
  const n = +String(x ?? "").replace(/,/g, "").trim();
  return Number.isFinite(n) ? n : 0;
}
function parseDate(s) {
  const d = new Date(String(s).trim());
  return isNaN(d.getTime()) ? null : d;
}

// Shared tooltip
function ensureTooltip() {
  let tip = document.getElementById("viz-tooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.id = "viz-tooltip";
    tip.style.position = "fixed";
    tip.style.pointerEvents = "none";
    tip.style.background = "rgba(2,6,23,.92)";
    tip.style.border = "1px solid rgba(148,163,184,.25)";
    tip.style.borderRadius = "10px";
    tip.style.padding = "8px 10px";
    tip.style.color = theme.text;
    tip.style.fontSize = "12px";
    tip.style.boxShadow = "0 12px 30px rgba(0,0,0,.55)";
    tip.style.display = "none";
    tip.style.zIndex = "2147483647";
    document.body.appendChild(tip);
  } else {
    tip.style.zIndex = "2147483647";
  }
  return tip;
}
function showTip(tip, event, html) {
  tip.innerHTML = html;
  const pad = 12;
  tip.style.left = `${Math.min(window.innerWidth - 380, event.clientX + pad)}px`;
  tip.style.top  = `${Math.min(window.innerHeight - 220, event.clientY + pad)}px`;
  tip.style.display = "block";
}
function hideTip(tip) { tip.style.display = "none"; }

// 6-phase mapping over global progress t∈[0,1]
// (soft overlaps are not necessary now; we want clarity for text)
function phaseAt(t) {
  if (t < 0.22) return { phase: 1, p: t / 0.22 };
  if (t < 0.42) return { phase: 2, p: (t - 0.22) / 0.20 };
  if (t < 0.62) return { phase: 3, p: (t - 0.42) / 0.20 };
  if (t < 0.78) return { phase: 4, p: (t - 0.62) / 0.16 };
  if (t < 0.90) return { phase: 5, p: (t - 0.78) / 0.12 };
  return { phase: 6, p: (t - 0.90) / 0.10 };
}

function phaseTitle(phase) {
  if (phase === 1) return "Phase 1 — Pressure";
  if (phase === 2) return "Phase 2 — Displacement";
  if (phase === 3) return "Phase 3 — Cross-border routes";
  if (phase === 4) return "Phase 4 — Destinations";
  if (phase === 5) return "Phase 5 — Uneven hosting";
  return "Phase 6 — Unknown / missing paths";
}

function narrativeSentence(phase, year, meta) {
  // 1–2 sentences, crisp.
  const pct = Math.round((meta.topShare || 0) * 100);

  if (phase === 1) {
    return `Pressure builds: outward movement grows as conditions worsen. Around ${year}, the trend shows mounting stress on everyday life.`;
  }
  if (phase === 2) {
    return `Displacement comes first: many people move inside Afghanistan before crossing borders. IDPs snapshot (${meta.idpsLatestISO}) signals concentrated internal strain.`;
  }
  if (phase === 3) {
    return `Cross-border movement expands into corridors: nearby countries absorb most flows, then Europe and beyond. The routes widen as pressure persists.`;
  }
  if (phase === 4) {
    return `Destinations become visible: the movement is not random, it clusters into a limited set of countries. In the latest year, the top destinations account for ~${pct}%.`;
  }
  if (phase === 5) {
    return `Uneven hosting: the burden concentrates on a small number of places, creating long-term pressure on services, housing, and legal pathways. Concentration is itself a key outcome.`;
  }
  return `Unknown paths remain: not every movement is recorded or assigned a destination. Missing data here does not mean missing people — it means blind spots in reporting.`;
}

async function loadData() {
  const refugees = await d3.csv("./dataset/hdx_hapi_refugees_afg.csv");
  const idps = await d3.csv("./dataset/hdx_hapi_idps_afg.csv");

  // Latest year in refugees data
  let latestYear = null;
  for (const r of refugees) {
    const y = parseYear(r.reference_period_start);
    if (y && (!latestYear || y > latestYear)) latestYear = y;
  }
  if (!latestYear) latestYear = 2024;

  // Outflow by year (REF+ASY) + destSum (latest year)
  const byYear = new Map();
  const destSum = new Map();
  let minY = null, maxY = null;

  for (const r of refugees) {
    if ((r.origin_location_code || "").trim() !== "AFG") continue;
    if ((r.asylum_location_code || "").trim() === "AFG") continue;

    const group = (r.population_group || "").trim().toUpperCase();
    if (group && group !== "REF" && group !== "ASY") continue;

    const y = parseYear(r.reference_period_start);
    if (!y) continue;

    const pop = toNumber(r.population);
    if (pop <= 0) continue;

    byYear.set(y, (byYear.get(y) || 0) + pop);
    minY = (minY === null || y < minY) ? y : minY;
    maxY = (maxY === null || y > maxY) ? y : maxY;

    if (y === latestYear) {
      const dest = (r.asylum_location_code || "").trim().toUpperCase();
      if (dest && dest !== "AFG") destSum.set(dest, (destSum.get(dest) || 0) + pop);
    }
  }

  const series = Array.from(byYear, ([year, value]) => ({ year: +year, value }))
    .sort((a, b) => a.year - b.year);

  // Top12 share (latest year)
  const totalLatest = Array.from(destSum.values()).reduce((a, b) => a + b, 0) || 1;
  const top12 = Array.from(destSum.entries())
    .map(([iso3, value]) => ({ iso3, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);
  const sumTop12 = top12.reduce((a, d) => a + d.value, 0);
  const topShare = sumTop12 / totalLatest;

  // IDPs latest snapshot (admin_level=1)
  const level1 = idps.filter(r => String(r.admin_level).trim() === "1");
  let latestDate = null;
  for (const r of level1) {
    const d = parseDate(r.reference_period_start);
    if (d && (!latestDate || d > latestDate)) latestDate = d;
  }
  let idpsLatest = 0;
  let idpsLatestISO = "—";
  if (latestDate) {
    idpsLatestISO = latestDate.toISOString().slice(0, 10);
    for (const r of level1) {
      const d = parseDate(r.reference_period_start);
      if (!d || d.getTime() !== latestDate.getTime()) continue;
      idpsLatest += toNumber(r.population);
    }
  }

  return {
    series,
    minYear: minY ?? (series[0]?.year ?? 2015),
    maxYear: maxY ?? (series.at(-1)?.year ?? latestYear),
    latestYear,
    topShare,
    idpsLatest,
    idpsLatestISO,
  };
}

function buildChart(container, data) {
  const host = d3.select(container);
  host.selectAll("*").remove();

  const rect = container.getBoundingClientRect();
  const W = Math.max(760, Math.floor(rect.width));
  const H = 520;

  const svg = host.append("svg")
    .attr("viewBox", `0 0 ${W} ${H}`)
    .attr("preserveAspectRatio", "xMidYMid meet");

  const g = svg.append("g").attr("transform", "translate(24,22)");
  const w = W - 48;
  const h = H - 44;

  // frame
  g.append("rect")
    .attr("x", 0).attr("y", 0)
    .attr("width", w).attr("height", h)
    .attr("rx", 18)
    .attr("fill", "rgba(2,6,23,.28)")
    .attr("stroke", "rgba(148,163,184,.14)");

  // Legend (explicit for yellow line)
  const leg = g.append("g").attr("transform", `translate(${w - 250}, 18)`);
  leg.append("line")
    .attr("x1", 0).attr("x2", 34)
    .attr("y1", 6).attr("y2", 6)
    .attr("stroke", theme.pressure)
    .attr("stroke-width", 3)
    .attr("stroke-linecap", "round");
  leg.append("text")
    .attr("x", 44).attr("y", 10)
    .attr("fill", theme.mutedText)
    .attr("font-size", 12)
    .text("Outflow (REF + ASY)");

  // Plot band + narrative band
  const plot = { y0: 70, y1: 300 };
  const narrative = { y0: 318, y1: h - 18 };

  // caption
  const capTitle = g.append("text")
    .attr("x", 14).attr("y", 28)
    .attr("fill", theme.text)
    .attr("font-size", 14)
    .attr("font-weight", 800)
    .text("Phase 1 — Pressure");

  const capSub = g.append("text")
    .attr("x", 14).attr("y", 50)
    .attr("fill", theme.mutedText)
    .attr("font-size", 12)
    .text("Scrub the line to read the story at that moment.");

  // Narrative box
  const nBox = g.append("g").attr("transform", `translate(14, ${narrative.y0})`);
  nBox.append("rect")
    .attr("x", 0).attr("y", 0)
    .attr("width", w - 28)
    .attr("height", (narrative.y1 - narrative.y0))
    .attr("rx", 14)
    .attr("fill", "rgba(15,23,42,.35)")
    .attr("stroke", "rgba(148,163,184,.14)");

  nBox.append("text")
    .attr("x", 14).attr("y", 26)
    .attr("fill", theme.text)
    .attr("font-size", 13)
    .attr("font-weight", 800)
    .text("What’s happening here?");

  const nText = nBox.append("text")
    .attr("x", 14).attr("y", 48)
    .attr("fill", theme.mutedText)
    .attr("font-size", 12);

  function wrapText(textSel, text, maxWidth, lineHeight = 16) {
    textSel.selectAll("tspan").remove();
    const words = String(text).split(/\s+/).filter(Boolean);
    let line = [];
    let lineNumber = 0;

    const newTspan = () => textSel.append("tspan")
      .attr("x", 14)
      .attr("dy", lineNumber === 0 ? 0 : lineHeight);

    let cur = newTspan();
    for (const w0 of words) {
      line.push(w0);
      cur.text(line.join(" "));
      if (cur.node().getComputedTextLength() > (maxWidth - 28)) {
        line.pop();
        cur.text(line.join(" "));
        line = [w0];
        lineNumber += 1;
        cur = newTspan().text(w0);
      }
    }
  }

  // Scales
  const x = d3.scaleLinear()
    .domain([data.minYear, data.maxYear])
    .range([18, w - 18]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(data.series, d => d.value) || 1])
    .nice()
    .range([plot.y1, plot.y0]);

  // baseline
  g.append("line")
    .attr("x1", 18).attr("x2", w - 18)
    .attr("y1", plot.y1).attr("y2", plot.y1)
    .attr("stroke", "rgba(148,163,184,.18)");

  // line
  const lineFn = d3.line()
    .x(d => x(d.year))
    .y(d => y(d.value))
    .curve(d3.curveMonotoneX);

  const linePath = g.append("path")
    .datum(data.series)
    .attr("d", lineFn)
    .attr("fill", "none")
    .attr("stroke", theme.pressure)
    .attr("stroke-width", 3)
    .attr("stroke-linecap", "round")
    .attr("opacity", 0.95);

  // clip reveal
  const clipId = "sw-line-clip";
  svg.append("defs").append("clipPath").attr("id", clipId)
    .append("rect")
    .attr("x", 0).attr("y", 0)
    .attr("width", 0).attr("height", H);
  linePath.attr("clip-path", `url(#${clipId})`);
  const clipRect = svg.select(`#${clipId} rect`);

  // cursor
  const cursor = g.append("g");
  const cursorLine = cursor.append("line")
    .attr("y1", plot.y0 - 6).attr("y2", plot.y1 + 10)
    .attr("stroke", "rgba(148,163,184,.22)")
    .attr("stroke-dasharray", "4,6")
    .attr("opacity", 0);

  const cursorDot = cursor.append("circle")
    .attr("r", 6)
    .attr("fill", theme.pressure)
    .attr("stroke", "rgba(229,231,235,.85)")
    .attr("stroke-width", 1.5)
    .attr("opacity", 0);

  // state
  const state = {
    t: 0,
    playing: false,
    lastTs: null,
    durationMs: 16000,
  };

  // Helpers
  const bisect = d3.bisector(d => d.year).left;

  function valueAtYear(y0) {
    const s = data.series;
    if (!s.length) return 0;
    const i = bisect(s, y0);
    if (i <= 0) return s[0].value;
    if (i >= s.length) return s[s.length - 1].value;
    const a = s[i - 1], b = s[i];
    const t = (y0 - a.year) / (b.year - a.year || 1);
    return a.value + (b.value - a.value) * t;
  }

  function render(t01) {
    const t = Math.max(0, Math.min(1, t01));
    state.t = t;

    const year = Math.round(data.minYear + (data.maxYear - data.minYear) * t);
    const ph = phaseAt(t).phase;

    capTitle.text(phaseTitle(ph));

    // reveal the line progressively
    const reveal = Math.max(0, Math.min(1, t / 0.90));
    clipRect.attr("width", W * reveal);

    // cursor
    const show = t > 0.02;
    const cx = x(year);
    const cy = y(valueAtYear(year));
    cursorLine.attr("x1", cx).attr("x2", cx).attr("opacity", show ? 0.95 : 0);
    cursorDot.attr("cx", cx).attr("cy", cy).attr("opacity", show ? 0.98 : 0);

    const txt = narrativeSentence(ph, year, {
      latestYear: data.latestYear,
      idpsLatestISO: data.idpsLatestISO,
      topShare: data.topShare,
    });
    wrapText(nText, txt, w - 28);
  }

  // tooltip
  const tip = ensureTooltip();
  function tipHtml(t01) {
    const year = Math.round(data.minYear + (data.maxYear - data.minYear) * t01);
    const ph = phaseAt(t01).phase;
    const outNow = valueAtYear(year);

    const lines = [];
    lines.push(`<div style="font-weight:800;">Year: ${year}</div>`);
    lines.push(`<div style="color:${theme.mutedText}; margin-top:4px;">${phaseTitle(ph)}</div>`);
    lines.push(`<div style="margin-top:8px;"><span style="color:${theme.mutedText};">Outflow (REF+ASY):</span> ${fmt(outNow)}</div>`);

    if (ph >= 2) {
      lines.push(`<div><span style="color:${theme.mutedText};">IDPs (snapshot ${data.idpsLatestISO}):</span> ${fmt(data.idpsLatest)}</div>`);
    }
    if (ph >= 4) {
      lines.push(`<div><span style="color:${theme.mutedText};">Top destinations (latest ${data.latestYear}):</span> ${(data.topShare*100).toFixed(0)}%</div>`);
    }
    lines.push(`<div style="color:${theme.mutedText}; margin-top:8px;">Click: ${state.playing ? "pause" : "resume"} · Move: scrub</div>`);
    return lines.join("");
  }

  // interactive overlay (only over plot band)
  const overlay = g.append("rect")
    .attr("x", 0).attr("y", plot.y0 - 18)
    .attr("width", w).attr("height", (plot.y1 - plot.y0) + 36)
    .attr("fill", "transparent")
    .style("cursor", "ew-resize");

  function setFromPointer(evt) {
    const [mx] = d3.pointer(evt, overlay.node());
    const clamped = Math.max(18, Math.min(w - 18, mx));
    const yr = x.invert(clamped);
    const t = (yr - data.minYear) / (data.maxYear - data.minYear || 1);
    render(t);
    showTip(tip, evt, tipHtml(t));
  }

  overlay
    .on("mouseenter", (event) => {
      state.playing = false;   // pause while reading
      state.lastTs = null;
      setFromPointer(event);
    })
    .on("mousemove", (event) => setFromPointer(event))
    .on("mouseleave", () => hideTip(tip))
    .on("click", (event) => {
      state.playing = !state.playing;
      state.lastTs = null;
      showTip(tip, event, tipHtml(state.t));
      if (state.playing) requestAnimationFrame(tick);
    });

  function tick(ts) {
    if (!state.playing) return;

    if (state.lastTs === null) state.lastTs = ts;
    const dt = ts - state.lastTs;
    state.lastTs = ts;

    const next = Math.min(1, state.t + (dt / state.durationMs));
    render(next);

    if (next >= 1) {
      state.playing = false;
      state.lastTs = null;
      return;
    }
    requestAnimationFrame(tick);
  }

  function playFromStart() {
    state.t = 0;
    render(0);
    state.playing = true;
    state.lastTs = null;
    requestAnimationFrame(tick);
  }

  // initial render
  render(0);

  return { playFromStart };
}

async function init() {
  if (hasInit) return;
  hasInit = true;

  const section = document.getElementById("storywide");
  const container = document.getElementById("storywide-viz");
  if (!section || !container) return;

  const data = await loadData();
  const chart = buildChart(container, data);

  const io = new IntersectionObserver((entries) => {
    const e = entries[0];
    if (!e || !e.isIntersecting) return;
    if (hasStarted) return;
    hasStarted = true;
    chart.playFromStart();
  }, { threshold: 0.35 });

  io.observe(section);
}

init();

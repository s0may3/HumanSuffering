// js/sections/destinations.js
import { markColor } from "../theme.js";

export async function update(ctx) {
  const { g, width, height, theme } = ctx;

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
    tip.style.left = `${Math.min(window.innerWidth - 340, event.clientX + pad)}px`;
    tip.style.top = `${Math.min(window.innerHeight - 160, event.clientY + pad)}px`;
    tip.style.display = "block";
  };
  const hideTip = () => (tip.style.display = "none");

  // ---------- number formatting ----------
  const fmt = d3.format(",");
  const fmtShort = d3.format(".2s");
  function pretty(n) {
    return fmtShort(n).replace("G", "B").replace("k", "K");
  }

  const toNumber = (x) => {
    const n = +String(x ?? "").replace(/,/g, "").trim();
    return Number.isFinite(n) ? n : 0;
  };

  async function tryLoadCsv(path) {
    try {
      const rows = await d3.csv(path);
      return rows && rows.length ? rows : null;
    } catch {
      return null;
    }
  }

  // ---------- load PREPROCESSED data ----------
  // Expected columns: year, iso3, value
  const candidates = [
    "./data/processed/destinations_yearly_top12.csv",
    "./dataset/derived/destinations_yearly_top12.csv",
  ];

  let rows = null;
  for (const p of candidates) {
    rows = await tryLoadCsv(p);
    if (rows) break;
  }

  if (!rows) {
    g.marks.append("text")
      .attr("x", 16).attr("y", 26)
      .attr("fill", theme.context).attr("font-size", 12)
      .text("Missing processed destinations file: data/processed/destinations_trend_top.csv");
    return;
  }

  // detect keys robustly (year / iso3 / value)
  const keys = Object.keys(rows[0] || {});
  const lower = (s) => String(s || "").toLowerCase();

  const yearKey =
    keys.find(k => lower(k) === "year") ||
    keys.find(k => lower(k).includes("year")) ||
    keys[0];

  const isoKey =
    keys.find(k => lower(k) === "iso3") ||
    keys.find(k => lower(k).includes("iso")) ||
    keys.find(k => lower(k).includes("asylum")) ||
    keys[1];

  const valueKey =
    keys.find(k => lower(k) === "value") ||
    keys.find(k => lower(k).includes("value")) ||
    keys.find(k => lower(k).includes("pop")) ||
    keys.find(k => k !== yearKey && k !== isoKey) ||
    keys[2];

  // aggregate by (year, dest)
  const byYearDest = new Map(); // `${year}|${iso3}` => value
  let latestYear = null;

  for (const r of rows) {
    const y = +r[yearKey];
    if (!Number.isFinite(y)) continue;
    if (!latestYear || y > latestYear) latestYear = y;

    const dest = (r[isoKey] || "").trim().toUpperCase();
    if (!dest || dest === "AFG") continue;

    const pop = toNumber(r[valueKey]);
    if (pop <= 0) continue;

    const k = `${y}|${dest}`;
    byYearDest.set(k, (byYearDest.get(k) || 0) + pop);
  }

  if (!latestYear) latestYear = 2024;

  // top N in latest year
  const latest = [];
  for (const [k, v] of byYearDest.entries()) {
    const [yStr, iso3] = k.split("|");
    if (+yStr === latestYear) latest.push({ iso3, value: v });
  }
  latest.sort((a, b) => b.value - a.value);

  const TOP_N = 12;
  const top = latest.slice(0, TOP_N);
  if (!top.length) {
    g.marks.append("text")
      .attr("x", 16).attr("y", 26)
      .attr("fill", theme.context).attr("font-size", 12)
      .text("No destination data found in the latest year.");
    return;
  }

  // years list
  const years = Array.from(new Set(Array.from(byYearDest.keys()).map(k => +k.split("|")[0])))
    .sort((a, b) => a - b);

  // series per iso3 for top list
  const seriesByISO3 = new Map();
  for (const d of top) {
    const s = years.map(y => ({
      year: y,
      value: byYearDest.get(`${y}|${d.iso3}`) || 0
    }));
    seriesByISO3.set(d.iso3, s);
  }

  // selection state
  let selected = top[0].iso3;

  // ---------- semantic colors (match global legend) ----------
  // Destination = destination, Trend = route, Focus = pressure
  const C_DEST = markColor("destination");
  const C_ROUTE = markColor("route");
  const C_FOCUS = markColor("pressure");

  // ---------- layout ----------
  const M = { top: 28, right: 18, bottom: 16, left: 18 };
  const W = Math.max(10, width - M.left - M.right);
  const H = Math.max(10, height - M.top - M.bottom);

  const root = g.marks.append("g")
    .attr("transform", `translate(${M.left},${M.top})`);

  const gap = 14;
  const listH = Math.max(170, Math.floor(H * 0.46));
  const chartH = Math.max(160, H - listH - gap);

  const listG = root.append("g").attr("transform", `translate(0,0)`);
  const chartG = root.append("g").attr("transform", `translate(0,${listH + gap})`);

  // title (inside viz)
  g.anno.append("text")
    .attr("x", 16).attr("y", 16)
    .attr("fill", theme.context)
    .attr("font-size", 11)
    .text(`Destinations: top ${TOP_N} in ${latestYear} + multi-year trend`);

  // ---------- TOP LIST (ranked dot list + mini bars) ----------
  const maxLatest = d3.max(top, d => d.value) || 1;

  const yBand = d3.scaleBand()
    .domain(top.map(d => d.iso3))
    .range([0, listH])
    .padding(0.25);

  // dot track range (leave space for right mini-bar column)
  const xDot = d3.scaleLinear()
    .domain([0, maxLatest])
    .range([90, W - 190]);

  // right mini-bar column
  const colW = 180;
  const colX = W - colW;
  const barX = colX + 12;
  const barW = colW - 24;
  const barH = 10;
  const barR = 999;

  const xBar = d3.scaleLinear()
    .domain([0, maxLatest])
    .range([0, barW]);

  // right column background
  listG.append("rect")
    .attr("x", colX)
    .attr("y", 0)
    .attr("width", colW)
    .attr("height", listH)
    .attr("rx", 12)
    .attr("fill", "rgba(15,23,42,28)")
    .attr("stroke", "rgba(148,163,184,10)");

  // faint baseline for dot track
  listG.append("line")
    .attr("x1", 90).attr("x2", (W - colW - 12))
    .attr("y1", 8).attr("y2", 8)
    .attr("stroke", "rgba(148,163,184,14)");

  const row = listG.selectAll("g.row")
    .data(top)
    .enter()
    .append("g")
    .attr("class", "row")
    .attr("transform", d => `translate(0,${yBand(d.iso3)})`)
    .style("cursor", "pointer");

  // left ISO label
  row.append("text")
    .attr("data-role", "iso")
    .attr("x", 0)
    .attr("y", yBand.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("fill", theme.mutedText)
    .attr("font-size", 12)
    .attr("opacity", 0.9)
    .text(d => d.iso3);

  // dot track
  row.append("line")
    .attr("x1", 90).attr("x2", (W - colW - 12))
    .attr("y1", yBand.bandwidth() / 2)
    .attr("y2", yBand.bandwidth() / 2)
    .attr("stroke", "rgba(148,163,184,10)");

  // rank dot
  row.append("circle")
    .attr("data-role", "rankDot")
    .attr("cx", d => xDot(d.value))
    .attr("cy", yBand.bandwidth() / 2)
    .attr("r", 6.5)
    .attr("fill", C_DEST)
    .attr("opacity", 0.55)
    .attr("stroke", "rgba(148,163,184,25)");

  // mini bar track
  row.append("rect")
    .attr("data-role", "barTrack")
    .attr("x", barX)
    .attr("y", yBand.bandwidth() / 2 - barH / 2)
    .attr("width", barW)
    .attr("height", barH)
    .attr("rx", barR)
    .attr("fill", "rgba(148,163,184,10)");

  // mini bar fill
  row.append("rect")
    .attr("data-role", "barFill")
    .attr("x", barX)
    .attr("y", yBand.bandwidth() / 2 - barH / 2)
    .attr("width", d => xBar(d.value))
    .attr("height", barH)
    .attr("rx", barR)
    .attr("fill", C_DEST)
    .attr("opacity", 0.55);

  // short value label
  row.append("text")
    .attr("data-role", "val")
    .attr("x", W - 12)
    .attr("y", yBand.bandwidth() / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", "end")
    .attr("fill", theme.mutedText)
    .attr("font-size", 11)
    .attr("font-weight", 500)
    .attr("opacity", 0.78)
    .text(d => pretty(d.value));

  function applySelection() {
    // dim non-selected rows
    row.attr("opacity", d => (!selected || d.iso3 === selected) ? 1 : 0.35);

    // ISO labels
    row.selectAll('text[data-role="iso"]')
      .attr("fill", d => (!selected || d.iso3 === selected) ? theme.text : theme.mutedText)
      .attr("opacity", d => (!selected || d.iso3 === selected) ? 1 : 0.9);

    // rank dots
    row.selectAll('circle[data-role="rankDot"]')
      .attr("fill", d => (!selected || d.iso3 === selected) ? C_FOCUS : C_DEST)
      .attr("opacity", d => (!selected || d.iso3 === selected) ? 0.95 : 0.22)
      .attr("r", d => (!selected || d.iso3 === selected) ? 7.5 : 5.5);

    // mini bar fill
    row.selectAll('rect[data-role="barFill"]')
      .attr("fill", d => (!selected || d.iso3 === selected) ? C_FOCUS : C_DEST)
      .attr("opacity", d => (!selected || d.iso3 === selected) ? 0.90 : 0.30)
      .attr("width", d => xBar(d.value));

    // values
    row.selectAll('text[data-role="val"]')
      .attr("fill", d => (!selected || d.iso3 === selected) ? theme.text : theme.mutedText)
      .attr("font-weight", d => (!selected || d.iso3 === selected) ? 700 : 500)
      .attr("font-size", d => (!selected || d.iso3 === selected) ? 12 : 11)
      .attr("opacity", d => (!selected || d.iso3 === selected) ? 1 : 0.78)
      .text(d => pretty(d.value));
  }

  row
    .on("mouseenter", (event, d) => {
      showTip(event, `
        <div style="font-weight:700;">${d.iso3}</div>
        <div style="color:${theme.mutedText}; margin-top:4px;">Latest year (${latestYear}): ${fmt(d.value)}</div>
        <div style="color:${theme.mutedText}; margin-top:6px;">Click to focus (trend below)</div>
      `);
    })
    .on("mousemove", (event) => {
      const pad = 12;
      tip.style.left = `${Math.min(window.innerWidth - 340, event.clientX + pad)}px`;
      tip.style.top = `${Math.min(window.innerHeight - 160, event.clientY + pad)}px`;
    })
    .on("mouseleave", () => hideTip())
    .on("click", (event, d) => {
      event.stopPropagation();
      selected = (selected === d.iso3) ? null : d.iso3;
      applySelection();
      renderTrend();
    });

  // ---------- TREND CHART ----------
  function renderTrend() {
    chartG.selectAll("*").remove();

    const iso = selected || top[0].iso3;
    const s = seriesByISO3.get(iso) || [];
    const maxY = d3.max(s, d => d.value) || 1;
const headerH = 44; // NEW: reserved space for title/subtitle

    const m2 = { top: headerH + 10, right: 10, bottom: 44, left: 50 };

const CW = Math.max(10, W - m2.left - m2.right);
const CH = Math.max(10, chartH - m2.top - m2.bottom);

    const cg = chartG.append("g").attr("transform", `translate(${m2.left},${m2.top})`);

    const x = d3.scaleLinear()
      .domain(d3.extent(s, d => d.year))
      .range([0, CW]);

    const y = d3.scaleLinear()
      .domain([0, maxY * 1.08])
      .range([CH, 0])
      .nice();

    chartG.append("g")
      .attr("transform", `translate(${m2.left},${m2.top + CH})`)
      .call(d3.axisBottom(x).ticks(Math.min(6, years.length)).tickFormat(d3.format("d")))
      .call(sel => sel.selectAll("path, line").attr("stroke", "rgba(148,163,184,22)"))
      .call(sel => sel.selectAll("text").attr("fill", theme.mutedText).attr("font-size", 10));

    chartG.append("g")
      .attr("transform", `translate(${m2.left},${m2.top})`)
      .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format(".2s")))
      .call(sel => sel.selectAll("path, line").attr("stroke", "rgba(148,163,184,22)"))
      .call(sel => sel.selectAll("text").attr("fill", theme.mutedText).attr("font-size", 10));

    chartG.append("text")
      .attr("x", 0)
      .attr("y", 14)
      .attr("fill", theme.text)
      .attr("font-size", 12)
      .attr("font-weight", 700)
      .text(`Trend for ${iso}`);

    chartG.append("text")
      .attr("x", 0)
      .attr("y", 30)
      .attr("fill", theme.mutedText)
      .attr("font-size", 10)
      .text("(Number of people, years)");

    const line = d3.line()
      .x(d => x(d.year))
      .y(d => y(d.value))
      .curve(d3.curveMonotoneX);

    cg.append("path")
      .datum(s)
      .attr("fill", "none")
      .attr("stroke", C_ROUTE)
      .attr("stroke-width", 2.4)
      .attr("opacity", 0.95)
      .attr("d", line);

    const lastYear = d3.max(s, d => d.year);

    cg.selectAll("circle.pt")
      .data(s)
      .enter()
      .append("circle")
      .attr("class", "pt")
      .attr("cx", d => x(d.year))
      .attr("cy", d => y(d.value))
      .attr("r", d => (d.year === lastYear ? 5.5 : 4.5))
      .attr("fill", d => (d.year === lastYear ? C_FOCUS : C_DEST))
      .attr("opacity", 0.95)
      .attr("stroke", "rgba(148,163,184,25)")
      .style("cursor", "default")
      .on("mouseenter", (event, d) => {
        showTip(event, `
          <div style="font-weight:700;">${iso} — ${d.year}</div>
          <div style="color:${theme.mutedText}; margin-top:4px;">Value: ${fmt(d.value)}</div>
        `);
      })
      .on("mousemove", (event) => {
        const pad = 12;
        tip.style.left = `${Math.min(window.innerWidth - 340, event.clientX + pad)}px`;
        tip.style.top = `${Math.min(window.innerHeight - 160, event.clientY + pad)}px`;
      })
      .on("mouseleave", () => hideTip());
  }

  // click background to clear selection
  g.marks.append("rect")
    .attr("x", 0).attr("y", 0)
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "transparent")
    .lower()
    .on("click", () => {
      selected = null;
      applySelection();
      renderTrend();
      hideTip();
    });

  applySelection();
  renderTrend();
}

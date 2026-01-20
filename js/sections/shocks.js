// js/sections/shocks.js
// Ridgeline plot — Food price YoY change distributions by year (interactive)
// Data file: ./data/processed/food_price_yoy_pct.csv
// Columns expected: year, pct_change_yoy

import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { markColor } from "../theme.js";

export async function update(ctx) {
  const { g, width, height, theme } = ctx;

  // clear layers
  g.marks.selectAll("*").remove();
  g.axes.selectAll("*").remove();
  g.anno.selectAll("*").remove();
  g.root.selectAll("*").remove();
  g.ui.selectAll("*").remove();

  // ---------- tooltip ----------
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
    tip.style.display = "none";
    tip.style.zIndex = "2147483647";
    document.body.appendChild(tip);
  } else {
    tip.style.zIndex = "2147483647";
  }

  const showTip = (event, html) => {
    tip.innerHTML = html;
    const pad = 12;
    tip.style.left = `${Math.min(window.innerWidth - 360, event.clientX + pad)}px`;
    tip.style.top = `${Math.min(window.innerHeight - 190, event.clientY + pad)}px`;
    tip.style.display = "block";
  };
  const hideTip = () => (tip.style.display = "none");

  // ---------- load data ----------
  const path = "./data/processed/food_price_yoy_pct.csv";
  let rows;
  try {
    rows = await d3.csv(path, d => ({
      year: +d.year,
      value: +d.pct_change_yoy
    }));
  } catch {
    g.marks.append("text")
      .attr("x", 20).attr("y", 30)
      .attr("fill", theme.context)
      .attr("font-size", 12)
      .text(`Failed to load ${path}`);
    return;
  }

  // ---------- group by year ----------
  const byYear = d3.group(
    rows.filter(d => Number.isFinite(d.year) && Number.isFinite(d.value)),
    d => d.year
  );

  const MIN_N = 10;
  const yearsAsc = Array.from(byYear.keys())
    .filter(y => byYear.get(y).length >= MIN_N)
    .sort((a, b) => a - b);

  if (yearsAsc.length < 2) {
    g.marks.append("text")
      .attr("x", 20).attr("y", 30)
      .attr("fill", theme.context)
      .attr("font-size", 12)
      .text("Not enough yearly data for ridgeline plot.");
    return;
  }

  // ---------- domain ----------
  const allValues = yearsAsc.flatMap(y => byYear.get(y).map(d => d.value)).sort((a, b) => a - b);
  const p01 = d3.quantileSorted(allValues, 0.01);
  const p99 = d3.quantileSorted(allValues, 0.99);
  const xMin = p01 ?? d3.min(allValues);
  const xMax = p99 ?? d3.max(allValues);

  // ---------- KDE ----------
  const gaussian = u => Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
  const sd = d3.deviation(allValues) || 1;
  const bw = Math.max(1e-6, 1.06 * sd * Math.pow(allValues.length, -0.2));
  const xs = d3.ticks(xMin, xMax, 90);

  const yearData = yearsAsc.map(year => {
    const values = byYear.get(year)
      .map(d => d.value)
      .filter(v => v >= xMin && v <= xMax)
      .sort((a, b) => a - b);

    const dens = xs.map(x => ({
      x,
      d: d3.mean(values, v => gaussian((x - v) / bw)) / bw
    }));

    return {
      year,
      n: values.length,
      q1: d3.quantileSorted(values, 0.25),
      med: d3.quantileSorted(values, 0.5),
      q3: d3.quantileSorted(values, 0.75),
      dens,
      maxD: d3.max(dens, d => d.d) || 1
    };
  });

  const maxDensity = d3.max(yearData, d => d.maxD) || 1;

  // ---------- layout ----------
  const margin = { top: 108, right: 18, bottom: 44, left: 64 };
  const W = Math.max(10, width - margin.left - margin.right);
  const H = Math.max(10, height - margin.top - margin.bottom);

  const C_FILL = markColor("context");
  const C_STROKE = markColor("shock");
  const C_MED = markColor("pressure");
  const C_IQR = "rgba(148,163,184,.12)";

  // ---------- header ----------
  g.ui.attr("transform", `translate(${margin.left},${22})`);

  const title = g.ui.append("text")
    .attr("x", 0).attr("y", 0)
    .attr("fill", theme.text)
    .attr("font-size", 13)
    .attr("font-weight", 800)
    .text("Economic shocks appear as wider and skewed food-price distributions");

  wrapSvgText(title, Math.max(120, W - 10), 1.2);

  g.ui.append("text")
    .attr("x", 0).attr("y", 32)
    .attr("fill", theme.mutedText)
    .attr("font-size", 10)
    .text("Ridgeline plot · Median + IQR shown · N = number of food samples");


  g.ui.append("text")
    .attr("x", W).attr("y", 32)
    .attr("text-anchor", "end")
    .attr("fill", theme.mutedText)
    .attr("font-size", 10)
    .text(`KDE bandwidth: ${d3.format(".2f")(bw)}`);

  // ---------- legend (header) ----------
  const leg = g.ui.append("g").attr("transform", "translate(0,54)");
  const items = [
    { label: "Distribution", kind: "area" },
    { label: "Median", kind: "line" },
    { label: "IQR", kind: "rect" },
  ];

  const xStep = 150;
  const itemG = leg.selectAll("g.item")
    .data(items)
    .enter()
    .append("g")
    .attr("transform", (d, i) => `translate(${i * xStep},0)`);

  itemG.each(function(d) {
    const gg = d3.select(this);
    if (d.kind === "area") {
      gg.append("rect")
        .attr("width", 14).attr("height", 10).attr("rx", 2)
        .attr("fill", C_FILL).attr("opacity", 0.35)
        .attr("stroke", C_STROKE).attr("stroke-width", 1.4);
    }
    if (d.kind === "line") {
      gg.append("line")
        .attr("x1", 0).attr("x2", 14)
        .attr("y1", 5).attr("y2", 5)
        .attr("stroke", C_MED).attr("stroke-width", 2);
    }
    if (d.kind === "rect") {
      gg.append("rect")
        .attr("width", 14).attr("height", 10).attr("rx", 2)
        .attr("fill", C_IQR).attr("stroke", "rgba(148,163,184,.18)");
    }
    gg.append("text")
      .attr("x", 20).attr("y", 9)
      .attr("fill", theme.mutedText)
      .attr("font-size", 10)
      .text(d.label);
  });

  // ---------- main plot ----------
  const root = g.root.attr("transform", `translate(${margin.left},${margin.top})`);
  const x = d3.scaleLinear().domain([xMin, xMax]).range([0, W]);
  const yearsDesc = yearsAsc.slice().sort((a, b) => b - a);

  const yBand = d3.scaleBand()
    .domain(yearsDesc)
    .range([0, H])
    .paddingInner(0.22);

  const amp = Math.min(36, yBand.bandwidth() * 0.9);
  const dScale = d3.scaleLinear().domain([0, maxDensity]).range([0, amp]);

  // axes
  g.axes.append("g")
    .attr("transform", `translate(${margin.left},${margin.top + H})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(d => `${d3.format(".0f")(d)}%`))
    .call(s => s.selectAll("path,line").attr("stroke", "rgba(148,163,184,.22)"))
    .call(s => s.selectAll("text").attr("fill", theme.mutedText).attr("font-size", 10));
// X-axis label
g.axes.append("text")
  .attr("x", margin.left + W / 2)
  .attr("y", margin.top + H + 36)
  .attr("text-anchor", "middle")
  .attr("fill", theme.mutedText)
  .attr("font-size", 10)
  .text("Year-over-year food price change (%)");

  g.axes.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`)
    .call(d3.axisLeft(yBand).tickSize(0))
    .call(s => s.selectAll("path").remove())
    .call(s => s.selectAll("text").attr("fill", theme.mutedText).attr("font-size", 10));

  // grid
  root.append("g")
    .attr("opacity", 0.14)
    .call(d3.axisBottom(x).ticks(6).tickSize(-H).tickFormat(""))
    .call(s => s.selectAll("path").remove())
    .call(s => s.selectAll("line").attr("stroke", "rgba(148,163,184,.22)"))
    .attr("transform", `translate(0,${H})`);

  // ridgelines
  const area = d3.area()
    .x(d => x(d.x))
    .y0(0)
    .y1(d => -dScale(d.d))
    .curve(d3.curveCatmullRom.alpha(0.85));

  const ridgeG = root.append("g");

  const row = ridgeG.selectAll("g.ridge")
    .data(yearData.slice().sort((a, b) => b.year - a.year))
    .enter()
    .append("g")
    .attr("transform", d =>
      `translate(0,${(yBand(d.year) ?? 0) + yBand.bandwidth() * 0.85})`
    );

  row.append("line")
    .attr("x2", W)
    .attr("stroke", "rgba(148,163,184,.12)");

  row.append("path")
    .attr("d", d => area(d.dens))
    .attr("fill", C_FILL)
    .attr("opacity", 0.22)
    .attr("stroke", C_STROKE)
    .attr("stroke-width", 1.6);

  row.append("rect")
    .attr("x", d => x(d.q1))
    .attr("y", -10)
    .attr("width", d => Math.max(1, x(d.q3) - x(d.q1)))
    .attr("height", 10)
    .attr("rx", 5)
    .attr("fill", C_IQR)
    .attr("stroke", "rgba(148,163,184,.18)");

  row.append("line")
    .attr("x1", d => x(d.med))
    .attr("x2", d => x(d.med))
    .attr("y2", -14)
    .attr("stroke", C_MED)
    .attr("stroke-width", 2);

  // ---------- interaction ----------
  const guide = root.append("line")
    .attr("y1", 0).attr("y2", H)
    .attr("stroke", "rgba(251,191,36,.35)")
    .attr("opacity", 0);

  const fmt1 = d3.format(".1f");
  const fmt0 = d3.format(",d");

  const overlay = root.append("rect")
    .attr("width", W).attr("height", H)
    .attr("fill", "transparent")
    .style("cursor", "crosshair")
    .on("mouseenter", () => guide.attr("opacity", 1))
    .on("mouseleave", () => {
      guide.attr("opacity", 0);
      hideTip();
    })
    .on("mousemove", (event) => {
      const [mx, my] = d3.pointer(event, overlay.node());
      guide.attr("x1", mx).attr("x2", mx);

      let nearest = yearsDesc[0];
      let best = Infinity;
      for (const yr of yearsDesc) {
        const y0 = yBand(yr);
        const c = y0 + yBand.bandwidth() * 0.5;
        const d = Math.abs(c - my);
        if (d < best) { best = d; nearest = yr; }
      }

      const yd = yearData.find(d => d.year === nearest);
      if (!yd) return;

      showTip(event, `
        <div style="font-weight:700;">Year: ${nearest}</div>
        <div style="color:${theme.mutedText};">YoY (cursor): ${fmt1(x.invert(mx))}%</div>
        <div style="color:${theme.mutedText}; margin-top:6px;">N: ${fmt0(yd.n)}</div>
        <div style="color:${theme.mutedText};">Median: ${fmt1(yd.med)}%</div>
        <div style="color:${theme.mutedText};">IQR: [${fmt1(yd.q1)}%, ${fmt1(yd.q3)}%]</div>
      `);
    });

  overlay.raise();

  // ---------- helpers ----------
  function wrapSvgText(textSel, maxWidth, lineHeight) {
    textSel.each(function () {
      const text = d3.select(this);
      const words = text.text().split(/\s+/).filter(Boolean);
      let line = [];
      let lineNumber = 0;
      const x = text.attr("x");
      const y = text.attr("y");
      text.text(null);
      let tspan = text.append("tspan").attr("x", x).attr("y", y);
      for (const w of words) {
        line.push(w);
        tspan.text(line.join(" "));
        if (tspan.node().getComputedTextLength() > maxWidth && line.length > 1) {
          line.pop();
          tspan.text(line.join(" "));
          line = [w];
          lineNumber += 1;
          tspan = text.append("tspan")
            .attr("x", x)
            .attr("y", y)
            .attr("dy", `${lineNumber * lineHeight}em`)
            .text(w);
        }
      }
    });
  }
}

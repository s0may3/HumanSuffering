// js/sections/flows.js
import { markColor } from "../theme.js";
import { sankey, sankeyLinkHorizontal } from "https://cdn.jsdelivr.net/npm/d3-sankey@0.12.3/+esm";
import { feature as topoFeature } from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";

export async function update(ctx) {
  const { g, width, height, theme } = ctx;

  if (!window.__flowsCache) window.__flowsCache = {};
  const cache = window.__flowsCache;

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
    tip.style.left = `${Math.min(window.innerWidth - 320, event.clientX + pad)}px`;
    tip.style.top = `${Math.min(window.innerHeight - 140, event.clientY + pad)}px`;
    tip.style.display = "block";
  }

  function hideTip(tip) {
    tip.style.display = "none";
  }

  // ---------- Modal overlay (fullscreen) ----------
  function ensureModal() {
    let modal = document.getElementById("flows-modal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "flows-modal";
    modal.style.position = "fixed";
    modal.style.inset = "0";
    modal.style.background = "rgba(0,0,0,.65)";
    modal.style.backdropFilter = "blur(2px)";
    modal.style.zIndex = "99990";
    modal.style.display = "none";

    const panel = document.createElement("div");
    panel.id = "flows-modal-panel";
    panel.style.position = "absolute";
    panel.style.inset = "20px";
    panel.style.borderRadius = "18px";
    panel.style.border = "1px solid rgba(148,163,184,.18)";
    panel.style.background = "rgba(2,6,23,.92)";
    panel.style.boxShadow = "0 30px 90px rgba(0,0,0,.60)";
    panel.style.overflow = "hidden";
    panel.style.display = "flex";
    panel.style.flexDirection = "column";

    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.alignItems = "center";
    top.style.justifyContent = "space-between";
    top.style.padding = "12px 14px";
    top.style.borderBottom = "1px solid rgba(148,163,184,.12)";

    const title = document.createElement("div");
    title.id = "flows-modal-title";
    title.style.color = theme.text;
    title.style.fontSize = "13px";
    title.style.fontWeight = "700";
    title.textContent = "Expanded view";

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "Close";
    close.style.cursor = "pointer";
    close.style.borderRadius = "999px";
    close.style.border = "1px solid rgba(148,163,184,.20)";
    close.style.background = "rgba(15,23,42,.45)";
    close.style.color = theme.text;
    close.style.padding = "8px 12px";
    close.style.fontSize = "12px";

    const body = document.createElement("div");
    body.id = "flows-modal-body";
    body.style.flex = "1";
    body.style.position = "relative";

    close.onclick = () => closeModal();
    top.appendChild(title);
    top.appendChild(close);
    panel.appendChild(top);
    panel.appendChild(body);
    modal.appendChild(panel);
    document.body.appendChild(modal);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });

    return modal;
  }

  function openModal(kind) {
    const modal = ensureModal();
    const title = document.getElementById("flows-modal-title");
    const body = document.getElementById("flows-modal-body");

    body.innerHTML = "";
    title.textContent = kind === "map" ? "Map (Fullscreen)" : "Sankey (Fullscreen)";
    modal.style.display = "block";
    document.body.style.overflow = "hidden";

    const tip = ensureTooltip();
    tip.style.zIndex = "2147483647";
    tip.style.display = "none";

    const rect = body.getBoundingClientRect();
    const W = Math.max(320, Math.floor(rect.width));
    const H = Math.max(240, Math.floor(rect.height));

    const svg = d3.select(body).append("svg")
      .attr("width", W)
      .attr("height", H)
      .attr("viewBox", `0 0 ${W} ${H}`)
      .style("display", "block");

    const gg = {
      root: svg.append("g"),
      marks: svg.append("g"),
    };

    const state = cache.__computedState;
    if (!state) return;

    if (kind === "map") {
      renderMap({
        g: gg,
        width: W,
        height: H,
        theme,
        sankTop: state.sankTop,
        maxV: state.maxV,
        sumTop: state.sumTop,
        latestYear: state.latestYear,
        geo: state.geo,
        getISO3: state.getISO3,
        getName: state.getName,
        selectedISO3: state.selectedISO3,
        setSelection: state.setSelection,
        applySelection: state.applySelection,
        tip,
        showTip,
        hideTip,
        flowsSelectionRef: null,
        onExpand: null,
        inModal: true,
      });
    } else {
      renderSankey({
        g: gg,
        width: W,
        height: H,
        theme,
        sankTop: state.sankTop,
        SANK_N: state.SANK_N,
        sumTop: state.sumTop,
        latestYear: state.latestYear,
        selectedISO3: state.selectedISO3,
        setSelection: state.setSelection,
        applySelection: state.applySelection,
        tip,
        showTip,
        hideTip,
        onExpand: null,
        inModal: true,
      });
    }
  }

  function closeModal() {
    const modal = document.getElementById("flows-modal");
    if (!modal) return;
    modal.style.display = "none";
    document.body.style.overflow = "";

    const tip = document.getElementById("viz-tooltip");
    if (tip) tip.style.display = "none";
  }

  // ---------- Load & compute data (cached) ----------
  if (!cache.rows) cache.rows = await d3.csv("./dataset/hdx_hapi_refugees_afg.csv");
  const rows = cache.rows;

  const parseYear = (d) => {
    if (!d) return null;
    const s = String(d).trim();
    if (/^\d{4}/.test(s)) return +s.slice(0, 4);
    const p = s.split(/[\/\-]/);
    return p.length === 3 ? +p[2] : null;
  };

  const toNumber = (x) => {
    const n = +String(x).replace(/,/g, "").trim();
    return Number.isFinite(n) ? n : 0;
  };

  let latestYear = cache.latestYear;
  if (!latestYear) {
    latestYear = null;
    for (const r of rows) {
      const y = parseYear(r.reference_period_start);
      if (!y) continue;
      if (!latestYear || y > latestYear) latestYear = y;
    }
    cache.latestYear = latestYear || 2024;
  }
  latestYear = cache.latestYear;

  const destSum = new Map();
  for (const r of rows) {
    if ((r.origin_location_code || "").trim() !== "AFG") continue;
    const y = parseYear(r.reference_period_start);
    if (y !== latestYear) continue;

    const group = (r.population_group || "").trim();
    if (group && group !== "REF" && group !== "ASY") continue;

    const dest = (r.asylum_location_code || "").trim();
    if (!dest || dest === "AFG") continue;

    const pop = toNumber(r.population);
    if (pop <= 0) continue;

    destSum.set(dest, (destSum.get(dest) || 0) + pop);
  }

  const SANK_N = 12;
  const sankTop = Array.from(destSum, ([iso3, value]) => ({ iso3, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, SANK_N);

  if (!sankTop.length) {
    g.marks.append("text")
      .attr("x", 20).attr("y", 30)
      .attr("fill", theme.context).attr("font-size", 12)
      .text("No destination data found for the latest year.");
    return;
  }

  const maxV = d3.max(sankTop, d => d.value) || 1;
  const sumTop = d3.sum(sankTop, d => d.value);

  if (!cache.geo) {
    const topo = await d3.json("./dataset/geo/world_countries.topojson");
    const objKey = topo && topo.objects ? Object.keys(topo.objects)[0] : null;
    if (!objKey) {
      g.marks.append("text")
        .attr("x", 20).attr("y", 30)
        .attr("fill", theme.context).attr("font-size", 12)
        .text("Invalid TopoJSON. Check dataset/geo/world_countries.topojson");
      return;
    }
    cache.geo = topoFeature(topo, topo.objects[objKey]);
  }
  const geo = cache.geo;

  const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").replace(/[^\w\s]/g, "").trim();
  const nameToISO3 = new Map([
    ["afghanistan", "AFG"],
    ["iran", "IRN"], ["iran islamic republic of", "IRN"],
    ["pakistan", "PAK"],
    ["turkey", "TUR"],
    ["germany", "DEU"],
    ["france", "FRA"],
    ["austria", "AUT"],
    ["united kingdom", "GBR"], ["great britain", "GBR"],
    ["greece", "GRC"],
    ["sweden", "SWE"],
    ["switzerland", "CHE"],
    ["italy", "ITA"],
    ["united states", "USA"], ["united states of america", "USA"],
    ["canada", "CAN"],
    ["netherlands", "NLD"],
    ["belgium", "BEL"],
    ["spain", "ESP"],
  ]);

  const getName = (f) => {
    const p = f.properties || {};
    return (p.ADMIN || p.name || p.NAME || p.SOVEREIGNT || "").toString() || "Unknown";
  };

  const getISO3 = (f) => {
    const p = f.properties || {};
    const direct = (p.ISO_A3 || p.iso_a3 || p.ADM0_A3 || p.id || "").toString().trim();
    if (direct && direct.length === 3) return direct.toUpperCase();
    return nameToISO3.get(norm(getName(f))) || "";
  };

  // ---------- Layout inside the normal panel ----------
  const margin = { top: 8, right: 8, bottom: 8, left: 8 };
  const W = Math.max(10, width - margin.left - margin.right);
  const H = Math.max(10, height - margin.top - margin.bottom);
  const chart = g.root.attr("transform", `translate(${margin.left},${margin.top})`);

  const gap = 12;
  const MIN_SANK_H = 200;
  const MIN_MAP_H = 220;

  let mapH = Math.floor(H * 0.68);
  let sankH = H - mapH - gap;

  if (sankH < MIN_SANK_H) {
    sankH = MIN_SANK_H;
    mapH = Math.max(MIN_MAP_H, H - sankH - gap);
  }
  if (mapH < MIN_MAP_H) {
    mapH = MIN_MAP_H;
    sankH = Math.max(MIN_SANK_H, H - mapH - gap);
  }

  const mapG = chart.append("g").attr("transform", `translate(0,0)`);
  const sankeyG = chart.append("g").attr("transform", `translate(0,${mapH + gap})`);

  if (cache.selectedISO3 === undefined) cache.selectedISO3 = null;

  const tip = ensureTooltip();

  function applySelection(flowsSel) {
    if (!flowsSel) return;
    if (!cache.selectedISO3) {
      flowsSel.attr("opacity", 0.18);
      return;
    }
    flowsSel.attr("opacity", d => (d.iso3 === cache.selectedISO3 ? 0.95 : 0.05));
  }

  function setSelection(iso3, flowsSel) {
    cache.selectedISO3 = (cache.selectedISO3 === iso3) ? null : iso3;
    applySelection(flowsSel);
  }

  const flowsSelectionRef = { sel: null };

  renderMap({
    g: { root: mapG, marks: mapG },
    width: W,
    height: mapH,
    theme,
    sankTop,
    maxV,
    sumTop,
    latestYear,
    geo,
    getISO3,
    getName,
    selectedISO3: () => cache.selectedISO3,
    setSelection: (iso3) => setSelection(iso3, flowsSelectionRef.sel),
    applySelection: () => applySelection(flowsSelectionRef.sel),
    tip,
    showTip,
    hideTip,
    flowsSelectionRef,
    onExpand: () => openModal("map"),
    inModal: false,
  });

  renderSankey({
    g: { root: sankeyG, marks: sankeyG },
    width: W,
    height: sankH,
    theme,
    sankTop,
    SANK_N,
    sumTop,
    latestYear,
    selectedISO3: () => cache.selectedISO3,
    setSelection: (iso3) => setSelection(iso3, flowsSelectionRef.sel),
    applySelection: () => applySelection(flowsSelectionRef.sel),
    tip,
    showTip,
    hideTip,
    onExpand: () => openModal("sankey"),
    inModal: false,
  });

  cache.__computedState = {
    sankTop,
    maxV,
    sumTop,
    latestYear,
    geo,
    getISO3,
    getName,
    SANK_N,
    selectedISO3: () => cache.selectedISO3,
    setSelection: (iso3) => setSelection(iso3, flowsSelectionRef.sel),
    applySelection: () => applySelection(flowsSelectionRef.sel),
  };
}

// ------------------------------
// Map renderer
// ------------------------------
function renderMap({
  g, width, height, theme,
  sankTop, maxV, sumTop, latestYear,
  geo, getISO3, getName,
  selectedISO3, setSelection, applySelection,
  tip, showTip, hideTip,
  flowsSelectionRef,
  onExpand,
  inModal,
}) {
  const W = Math.max(10, width);
  const H = Math.max(10, height);

  // helper: clamp a point to the plot bounds (so off-map destinations still land on the edge)
  function clampToBounds(x1, y1, x2, y2, pad = 10) {
    const xmin = pad, ymin = pad, xmax = W - pad, ymax = H - pad;

    const inside = (x, y) => x >= xmin && x <= xmax && y >= ymin && y <= ymax;
    if (inside(x2, y2)) return { x: x2, y: y2, clipped: false, side: null };

    const dx = x2 - x1;
    const dy = y2 - y1;

    const candidates = [];

    function addCandidate(t, side) {
      if (!Number.isFinite(t) || t <= 0 || t > 1) return;
      const x = x1 + t * dx;
      const y = y1 + t * dy;
      if (inside(x, y)) candidates.push({ t, x, y, side });
    }

    if (dx !== 0) {
      addCandidate((xmin - x1) / dx, "left");
      addCandidate((xmax - x1) / dx, "right");
    }
    if (dy !== 0) {
      addCandidate((ymin - y1) / dy, "top");
      addCandidate((ymax - y1) / dy, "bottom");
    }

    if (!candidates.length) {
      // fallback: hard clamp
      const x = Math.max(xmin, Math.min(xmax, x2));
      const y = Math.max(ymin, Math.min(ymax, y2));
      return { x, y, clipped: true, side: null };
    }

    candidates.sort((a, b) => a.t - b.t);
    const best = candidates[0];
    return { x: best.x, y: best.y, clipped: true, side: best.side };
  }

  const REGION = { lonMin: -12, lonMax: 85, latMin: 20, latMax: 62 };
  const inRegion = (f) => {
    const c = d3.geoCentroid(f);
    return c[0] >= REGION.lonMin && c[0] <= REGION.lonMax && c[1] >= REGION.latMin && c[1] <= REGION.latMax;
  };
  const regionGeo = { type: "FeatureCollection", features: geo.features.filter(inRegion) };

  const projection = d3.geoMercator().fitSize([W, H], regionGeo);
  const path = d3.geoPath(projection);

  const valByISO3 = new Map(sankTop.map(d => [d.iso3, d.value]));
  const destColor = d3.scaleSequential()
    .domain([0, maxV])
    .interpolator(d3.interpolateRgb("rgba(15,23,42,0.18)", markColor("destination")));

  const defs = d3.select(g.root.node().ownerSVGElement).append("defs");
  const markerId = inModal ? "arrowhead-modal" : "arrowhead";
  defs.selectAll(`#${markerId}`).remove();
  defs.append("marker")
    .attr("id", markerId)
    .attr("viewBox", "0 0 10 10")
    .attr("refX", 9)
    .attr("refY", 5)
    .attr("markerWidth", 7)
    .attr("markerHeight", 7)
    .attr("orient", "auto-start-reverse")
    .append("path")
    .attr("d", "M 0 0 L 10 5 L 0 10 z")
    .attr("fill", markColor("route"));

  g.marks.selectAll("path.country")
    .data(regionGeo.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("fill", (f) => {
      const iso = getISO3(f);
      const v = valByISO3.get(iso) || 0;
      return v > 0 ? destColor(v) : "rgba(15,23,42,0.10)";
    })
    .attr("stroke", "rgba(148,163,184,.14)")
    .attr("stroke-width", 0.8);

  const afgFeat = geo.features.find(f => getISO3(f) === "AFG");
  const afgCentroid = afgFeat ? path.centroid(afgFeat) : [W * 0.55, H * 0.55];

  g.marks.append("circle")
    .attr("cx", afgCentroid[0]).attr("cy", afgCentroid[1])
    .attr("r", 5.6)
    .attr("fill", markColor("pressure"))
    .attr("stroke", "rgba(229,231,235,.85)")
    .attr("stroke-width", 1.2);

  // compute destination points (projection space)
  const destPoints = sankTop.map(d => {
    const feat = geo.features.find(f => getISO3(f) === d.iso3);
    const c = feat ? path.centroid(feat) : null;
    return { ...d, name: feat ? getName(feat) : d.iso3, centroid: c };
  }).filter(d => d.centroid);

  const flowG = g.marks.append("g");

  const baseOpacity = inModal ? 0.42 : 0.18;
  const baseWidth = inModal ? 3 : 2;

  // precompute clipped endpoints so “off-map” destinations still have a visible endpoint + label
  const prepared = destPoints.map(d => {
    const [x2, y2] = d.centroid;
    const [x1, y1] = afgCentroid;
    const clipped = clampToBounds(x1, y1, x2, y2, inModal ? 14 : 10);
    return { ...d, end: [clipped.x, clipped.y], clipped: clipped.clipped, side: clipped.side };
  });

  const flows = flowG.selectAll("path.flow")
    .data(prepared)
    .enter()
    .append("path")
    .attr("class", "flow")
    .attr("fill", "none")
    .attr("stroke", markColor("route"))
    .attr("stroke-width", baseWidth)
    .style("pointer-events", "stroke")
    .style("stroke-linecap", "round")
    .attr("opacity", baseOpacity)
    .attr("marker-end", `url(#${markerId})`)
    .attr("d", d => {
      const [x1, y1] = afgCentroid;
      const [x2, y2] = d.end;

      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;

      // bend scales slightly with distance but stays stable
      const dist = Math.hypot(x2 - x1, y2 - y1);
      const bend = -Math.min(52, Math.max(24, dist * 0.08));

      return `M${x1},${y1} Q${mx},${my + bend} ${x2},${y2}`;
    });

  if (flowsSelectionRef) flowsSelectionRef.sel = flows;
  applySelection();

  // edge labels for clipped destinations (the “two arrows” case)
  const labelG = g.marks.append("g");

  const clippedOnes = prepared.filter(d => d.clipped);

  const label = labelG.selectAll("g.edgeLabel")
    .data(clippedOnes)
    .enter()
    .append("g")
    .attr("class", "edgeLabel")
    .attr("transform", d => {
      const [x, y] = d.end;
      // nudge label inward depending on which side we hit
      let dx = 0, dy = 0;
      if (d.side === "right") dx = -8;
      if (d.side === "left") dx = 8;
      if (d.side === "top") dy = 10;
      if (d.side === "bottom") dy = -10;
      return `translate(${x + dx},${y + dy})`;
    });

  // small pill background
  label.append("rect")
    .attr("x", d => (d.side === "right" ? -46 : -2))
    .attr("y", -11)
    .attr("width", 48)
    .attr("height", 22)
    .attr("rx", 999)
    .attr("fill", "rgba(2,6,23,.78)")
    .attr("stroke", "rgba(148,163,184,.22)");

  label.append("text")
    .attr("x", d => (d.side === "right" ? -22 : 22))
    .attr("y", 0)
    .attr("dy", "0.35em")
    .attr("text-anchor", "middle")
    .attr("fill", theme.text)
    .attr("font-size", inModal ? 12 : 11)
    .attr("font-weight", 700)
    .attr("opacity", 0.95)
    .text(d => d.iso3);

  // click background to clear selection + dblclick expand
  g.marks.append("rect")
    .attr("x", 0).attr("y", 0)
    .attr("width", W).attr("height", H)
    .attr("fill", "transparent")
    .lower()
    .on("click", () => {
      if (selectedISO3()) setSelection(selectedISO3());
      if (tip && hideTip) hideTip(tip);
    })
    .on("dblclick", (e) => {
      e.preventDefault();
      if (onExpand) onExpand();
    });

  flows
    .on("mouseenter", function (event, d) {
      if (!tip || !showTip) return;
      const share = (d.value / sumTop) * 100;
      showTip(tip, event, `
        <div style="font-weight:600;">AFG → ${d.name} (${d.iso3})</div>
        <div style="color:${theme.mutedText};">People (latest year): ${d3.format(",")(d.value)}</div>
        <div style="color:${theme.mutedText};">Share (top 12): ${d3.format(".1f")(share)}%</div>
        <div style="color:${theme.mutedText}; margin-top:4px;">Year: ${latestYear}</div>
        ${d.clipped ? `<div style="color:${theme.mutedText}; margin-top:6px;">Note: destination is outside map frame</div>` : ""}
        ${inModal ? "" : `<div style="color:${theme.mutedText}; margin-top:6px;">Tip: double-click to expand</div>`}
      `);
    })
    .on("mousemove", (event) => {
      if (!tip) return;
      const pad = 12;
      tip.style.left = `${Math.min(window.innerWidth - 320, event.clientX + pad)}px`;
      tip.style.top  = `${Math.min(window.innerHeight - 140, event.clientY + pad)}px`;
    })
    .on("mouseleave", () => {
      if (tip && hideTip) hideTip(tip);
    });

  g.marks.append("text")
    .attr("x", 8).attr("y", 14)
    .attr("fill", theme.context)
    .attr("font-size", inModal ? 12 : 10)
    .text(inModal ? `Map view · Year: ${latestYear}` : `Double-click map to expand · Year: ${latestYear}`);
}

// ------------------------------
// Sankey renderer (unchanged)
// ------------------------------
function renderSankey({
  g, width, height, theme,
  sankTop, SANK_N, sumTop, latestYear,
  selectedISO3, setSelection, applySelection,
  tip, showTip, hideTip,
  onExpand,
  inModal,
}) {
  const W = Math.max(10, width);
  const H = Math.max(10, height);

  const sankeyData = {
    nodes: [{ name: "AFG" }, ...sankTop.map(d => ({ name: d.iso3 }))],
    links: sankTop.map(d => ({ source: "AFG", target: d.iso3, value: d.value })),
  };

  const padL = inModal ? 18 : 12;
  const padR = inModal ? 90 : 60;
  const padT = inModal ? 34 : 26;
  const padB = inModal ? 34 : 26;

  const sk = sankey()
    .nodeId(d => d.name)
    .nodeWidth(inModal ? 18 : 14)
    .nodePadding(inModal ? 18 : 10)
    .extent([[padL, padT], [W - padR, H - padB]]);

  const graph = sk({
    nodes: sankeyData.nodes.map(d => ({ ...d })),
    links: sankeyData.links.map(d => ({ ...d })),
  });

  g.marks.append("text")
    .attr("x", 0).attr("y", inModal ? 18 : 14)
    .attr("fill", theme.context)
    .attr("font-size", inModal ? 12 : 10)
    .text(inModal ? `Sankey (top ${SANK_N}) · Year: ${latestYear}` : `Double-click sankey to expand · Year: ${latestYear}`);

  const linkG = g.marks.append("g");
  linkG.selectAll("path")
    .data(graph.links)
    .enter()
    .append("path")
    .attr("d", sankeyLinkHorizontal())
    .attr("fill", "none")
    .attr("stroke", markColor("route"))
    .attr("stroke-opacity", 0.45)
    .attr("stroke-width", d => Math.max(1, d.width))
    .style("cursor", "pointer")
    .style("pointer-events", "stroke")
    .style("stroke-linecap", "round")
    .on("click", (event, d) => {
      event.stopPropagation();
      setSelection(d.target.name);
    })
    .on("mouseenter", function (event, d) {
      d3.select(this).attr("stroke-opacity", 0.95);
      if (tip && showTip) {
        const share = (d.value / sumTop) * 100;
        showTip(tip, event, `
          <div style="font-weight:600;">${d.source.name} → ${d.target.name}</div>
          <div style="color:${theme.mutedText};">People (latest year): ${d3.format(",")(d.value)}</div>
          <div style="color:${theme.mutedText};">Share (top ${SANK_N}): ${d3.format(".1f")(share)}%</div>
          <div style="color:${theme.mutedText}; margin-top:4px;">Year: ${latestYear}</div>
        `);
      }
    })
    .on("mousemove", (event) => {
      if (!tip) return;
      const pad = 12;
      tip.style.left = `${Math.min(window.innerWidth - 320, event.clientX + pad)}px`;
      tip.style.top  = `${Math.min(window.innerHeight - 140, event.clientY + pad)}px`;
    })
    .on("mouseleave", function () {
      d3.select(this).attr("stroke-opacity", 0.45);
      if (tip && hideTip) hideTip(tip);
    });

  const node = g.marks.append("g")
    .selectAll("g")
    .data(graph.nodes)
    .enter()
    .append("g");

  node.append("rect")
    .attr("x", d => d.x0).attr("y", d => d.y0)
    .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
    .attr("fill", d => (d.name === "AFG" ? markColor("pressure") : markColor("destination")))
    .attr("opacity", 0.82)
    .attr("stroke", "rgba(148,163,184,.25)");

  const labelSet = new Set(sankTop.slice(0, 12).map(d => d.iso3));

  node.append("text")
    .attr("x", d => {
      const nearRight = d.x1 > (W - (inModal ? 210 : 170));
      return nearRight ? (d.x0 - 10) : (d.x1 + 10);
    })
    .attr("y", d => (d.y0 + d.y1) / 2)
    .attr("dy", "0.35em")
    .attr("text-anchor", d => (d.x1 > (W - (inModal ? 210 : 170))) ? "end" : "start")
    .attr("fill", theme.text)
    .attr("font-size", inModal ? 14 : 12)
    .attr("opacity", 0.92)
    .text(d => (d.name === "AFG" || labelSet.has(d.name)) ? d.name : "");

  node
    .style("cursor", "pointer")
    .on("mouseenter", function(event, d) {
      if (!tip || !showTip) return;
      const incoming = d.targetLinks ? d3.sum(d.targetLinks, l => l.value) : 0;
      showTip(tip, event, `
        <div style="font-weight:600;">Node: ${d.name}</div>
        <div style="color:${theme.mutedText};">Incoming (latest year): ${d3.format(",")(incoming)}</div>
        <div style="color:${theme.mutedText}; margin-top:4px;">Year: ${latestYear}</div>
      `);
    })
    .on("mousemove", (event) => {
      if (!tip) return;
      const pad = 12;
      tip.style.left = `${Math.min(window.innerWidth - 320, event.clientX + pad)}px`;
      tip.style.top  = `${Math.min(window.innerHeight - 140, event.clientY + pad)}px`;
    })
    .on("mouseleave", () => {
      if (tip && hideTip) hideTip(tip);
    });

  g.marks.append("rect")
    .attr("x", 0).attr("y", 0)
    .attr("width", W).attr("height", H)
    .attr("fill", "transparent")
    .lower()
    .on("click", () => {
      if (selectedISO3()) setSelection(selectedISO3());
      applySelection();
      if (tip && hideTip) hideTip(tip);
    })
    .on("dblclick", (e) => {
      e.preventDefault();
      if (onExpand) onExpand();
    });

  applySelection();
}

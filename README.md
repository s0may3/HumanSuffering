# Afghan Migration — Data-Driven Storytelling Website

A public, data-driven storytelling website built with **HTML + CSS + JavaScript + D3.js**.
The project frames Afghan migration as a multi-stage process:

**Pressure → Displacement → Routes → Destinations → Uneven Hosting → Unknown paths**


## 1) Run the website locally

### Option A (recommended): Python static server
From the repository root:

```
python3 -m http.server 8080
```

Open in your browser:
```
http://localhost:8080
```

### Option B: Node static server
```
npx serve .
```

---

## 2) Preprocessing (reproducibility)

This project includes **runnable preprocessing** in the form of Jupyter notebooks.
The preprocessing is intentionally lightweight and transparent.

### What preprocessing does
- Reads raw humanitarian datasets
- Parses numeric values and extracts years from date fields
- Applies conservative filtering (invalid dates, non-positive values, non-AFG origin where applicable)


---

## 2.1 raw inputs

Create the following folder and place the databases files inside:

---

## 2.2 Run preprocessing notebooks

```
downloads/jupyter_preprocess_notebooks_v2.zip
```
Workflow:
1. Unzip the file
2. Open Jupyter (`jupyter lab` or `jupyter notebook`)
3. Open a notebook
4. Run all cells

if new data coming, put in the notebooks and run
---

## 3) Folder structure

```
.
├─ index.html
├─ js/
│  ├─ app.js
│  ├─ scroll.js
│  ├─ data.js
│  ├─ theme.js
│  ├─ storywide.js
│  └─ sections/
│     ├─ overview.js
│     ├─ shocks.js
│     ├─ idps.js
│     ├─ flows.js
│     ├─ destinations.js
│     └─ protection.js
├─ dataset/
│  ├─ hdx_hapi_refugees_afg.csv
│  ├─ hdx_hapi_idps_afg.csv
│  ├─ hdx_hapi_food_price_afg.csv
│  ├─ hdx_hapi_returnees_afg.csv
│  ├─ geo/
│  │  ├─ afghanistan_adm1.geojson
│  │  └─ world_countries.topojson
└─ downloads/
│  └─ jupyter_preprocess_notebooks_v2.zip

---

## 4) Which visualization uses which data?

### Storywide (hero narrative)
- `dataset/hdx_hapi_refugees_afg.csv` — outflow time series
- `dataset/hdx_hapi_idps_afg.csv` — latest IDPs snapshot
- `dataset/hdx_hapi_refugees_afg.csv` — destination concentration

### Section 1 — Overview (overview.js)
- `dataset/hdx_hapi_refugees_afg.csv`
- Aggregation: origin AFG, destination ≠ AFG, REF/ASY, annual totals

### Section 2 — Shocks (shocks.js)
- `dataset/hdx_hapi_food_price_afg.csv`
- Transformation: year-to-year percentage change (histogram)

### Section 3 — IDPs (idps.js)
- `dataset/hdx_hapi_idps_afg.csv`
- `dataset/geo/afghanistan_adm1.geojson`
- Aggregation: latest snapshot, admin_level=1

### Section 4 — Flows (flows.js)
- `dataset/hdx_hapi_refugees_afg.csv`
- `dataset/geo/world_countries.topojson`
- Aggregation: latest year, top destinations

### Section 5 — Destinations (destinations.js)
- `dataset/hdx_hapi_refugees_afg.csv`
- Aggregation: multi-year trends for top destinations

### Section 6 — Protection (protection.js)
- `dataset/hdx_hapi_refugees_afg.csv`
- `dataset/hdx_hapi_returnees_afg.csv`
- Encoding: yearly totals and shares (REF / ASY / Returnees)

---

## 5) Data sources

Primary source:
- **HDX HAPI — Afghanistan**  
  https://data.humdata.org/dataset/hdx-hapi-afg

All data used are publicly available humanitarian datasets.

---

## 6) Team

- **Somayyeh Eslami** — Data storytelling & web development

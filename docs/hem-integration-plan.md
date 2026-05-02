# Plan: HEM-Ready Field Assessment Tool for Domestic Energy Assessors

## Context

The UK government is replacing SAP/RdSAP with the **Home Energy Model (HEM)** as the
official methodology behind Energy Performance Certificates. Voluntary use begins
H2 2027; HEM becomes **mandatory for new EPCs from 1 October 2029**. The new EPC
swaps the single A–G rating for **four metrics**: Fabric Performance, Heating System,
Smart Readiness, and Energy Cost.

For Domestic Energy Assessors (DEAs) this is disruptive: DESNZ early-testing puts a
typical assessment at **~1 h 40 min under HEM vs ~20 min under RdSAP** because
significantly more building data must be captured on-site. Existing accredited
software (Elmhurst, Stroma, Quidos, NHER) is being rebuilt around HEM, and the
"Existing Dwellings Wrapper" that defines RdSAP-style input defaults for HEM is
still in consultation (early 2026).

The HEM calculation engine has been published as **open source** —
[`communitiesuk/epb-home-energy-model`](https://github.com/communitiesuk/epb-home-energy-model)
— a Rust port of the official Python specification, MIT-licensed. It takes a
12-section JSON input plus an EPW weather file, and it ships an AWS Lambda binding.
The README explicitly notes the engine is **"functionally incomplete"** and the input
format **"not yet documented/stable"**, so any tool built today must track upstream.

This plan covers building a **tablet-first Progressive Web App** for independent
DEAs that captures HEM site data, runs the open-source HEM engine **client-side in
WebAssembly** (offline-capable), and produces a draft assessment showing the four
new metrics. **Lodgement to the official EPC register is explicitly out of scope
for the MVP** — it will become possible only via an accreditation scheme, and is a
later phase.

## Recommended Approach

A monorepo with three layers, each independently testable:

```
/engine     Rust crate wrapping epb-home-energy-model + wasm-bindgen exports
/wrapper    TypeScript: site-capture data model -> HEM core-input.schema.json
/web        Vite + React PWA with Capacitor shell for iOS/Android stores
/weather    Bundled EPW files + postcode -> region lookup
/docs       Mapping notes vs the DESNZ consultation; ADRs
```

### 1. Engine layer — `/engine`

- Vendor `communitiesuk/epb-home-energy-model` as a **git submodule pinned to a
  specific commit** (the project is pre-1.0 and unstable). Do **not** fork unless we
  need to patch.
- Add a thin Rust crate `hem-wasm` next to the existing `hem-lambda` crate that
  exposes a single function: `run(input_json: &str, epw: &str) -> String` via
  `wasm-bindgen` and builds with `wasm-pack build --target web`.
- Mirror the CLI entry point (`src/main.rs` in upstream) so behaviour is identical
  to `cargo run -- input.json -e weather.epw`.
- Ship the resulting `.wasm` + JS glue as an npm package consumed by `/web`.
- CI: rebuild WASM against latest upstream `main` weekly and run the bundled
  `examples/` to detect breaking changes early.

### 2. Wrapper layer — `/wrapper`

The official Existing Dwellings Wrapper isn't published yet, so we build a
**candidate wrapper** that we'll swap out when DESNZ releases theirs.

- TypeScript module exporting `buildCoreInput(siteData: Assessment): CoreInput`
  whose output validates against
  [`schemas/core-input.schema.json`](https://github.com/communitiesuk/epb-home-energy-model/blob/main/schemas/core-input.schema.json)
  (12 required sections: `ColdWaterSource`, `Control`, `EnergySupply`, `Events`,
  `ExternalConditions`, `HotWaterDemand`, `HotWaterSource`,
  `InfiltrationVentilation`, `InternalGains`, `SimulationTime`, `Zone`,
  `temp_internal_air_static_calcs`).
- Use the **DESNZ consultation defaults** for unknowns (mirror RdSAP-style assumed
  values for unmeasurable U-values, infiltration rates, occupancy, etc.).
- Keep the wrapper a **pure function** with no I/O — easy to unit-test against
  golden input/output pairs.
- Generate TypeScript types from the JSON Schema with `json-schema-to-typescript`
  so the wrapper can't drift silently when upstream updates the schema.

### 3. PWA — `/web`

- **Stack**: TypeScript, React, Vite, Workbox (service worker), Dexie.js
  (IndexedDB), Tailwind, `react-hook-form` + `zod` for capture screens.
- **Capacitor wrapper** for App Store / Play Store distribution and access to
  native Bluetooth (Leica Disto laser measures), camera EXIF, and persistent
  storage. PWA remains the source of truth; Capacitor is just a shell.
- **Capture flow** mirrors HEM core-input sections, presented in a friendlier order
  for a site visit:
  1. Property identification (address, UPRN, postcode → weather region)
  2. Geometry: zones, walls, roofs, floors, windows, doors, thermal bridges
  3. Infiltration / ventilation (blower-door results, MVHR if present)
  4. Heating system + controls + hot water source
  5. Renewables (PV, battery, diverter)
  6. Appliances / internal gains (mostly defaults)
  7. Photos and notes per element, geotagged
- **Persistence**: each `Assessment` is a single JSON document in IndexedDB,
  written on every change; photo blobs stored separately. Offline-first.
- **Engine bridge**: WASM runs in a Web Worker so the UI stays responsive on a
  long simulation.
- **Results screen**: shows the four new EPC metrics, a breakdown of heat loss by
  element, and a draft PDF report (jsPDF or browser-print).

### 4. Weather data — `/weather`

Bundle the small set of UK climate-region EPW files (publicly available via NCM)
plus a postcode-prefix → region lookup table. Loaded lazily by the engine bridge.

### 5. What we deliberately defer

- **Lodgement to the EPC register** — requires accreditation-scheme membership
  (Elmhurst/Stroma/Quidos/NHER) and an as-yet-unpublished scheme API. Plan a
  Phase 4 once the wrapper is finalised and a scheme partnership is agreed.
- **The official Existing Dwellings Wrapper** — swap in when published.
- **Cloud sync / multi-device** — single-device IndexedDB is enough for MVP. Add
  optional sync (Supabase) once the data model has stabilised.

## Critical Files to Create

- `/engine/Cargo.toml`, `/engine/src/lib.rs` — wasm-bindgen entry point mirroring
  upstream `src/main.rs`
- `/engine/upstream/` — git submodule of `communitiesuk/epb-home-energy-model`
- `/wrapper/src/buildCoreInput.ts` — site data → HEM core input
- `/wrapper/src/types/core-input.ts` — generated from `core-input.schema.json`
- `/wrapper/src/defaults/` — RdSAP-equivalent default tables from the consultation
- `/web/src/engine/runHem.ts` — Web Worker harness around the WASM engine
- `/web/src/persistence/db.ts` — Dexie schema for `Assessment`, `Photo`,
  `Measurement`
- `/web/src/capture/*` — capture screens (one per HEM section)
- `/web/src/results/Metrics.tsx` — four-metric display
- `/weather/regions.json` + `/weather/*.epw`
- `/docs/adr/` — architecture decision records (engine pinning, wrapper strategy,
  Capacitor decision)

## Phasing

| Phase | Duration | Deliverable |
|---|---|---|
| **0. Spike** | 2–4 weeks | WASM build of upstream engine; bundled `examples/*.json` runs in a browser and matches the Rust CLI output byte-for-byte. Measure WASM size + simulation time on a mid-range tablet. |
| **1. Vertical slice** | 6–8 weeks | One dwelling archetype (e.g. solid-wall Victorian terrace) end-to-end: hand-built capture form, candidate wrapper, engine call, four-metric output. |
| **2. PWA shell** | 8–12 weeks | Multi-screen capture flow with IndexedDB persistence, photo capture, offline service worker, draft PDF report. |
| **3. Breadth** | 8–12 weeks | All common UK dwelling archetypes; tablet UX polish; Capacitor iOS/Android builds; field beta with friendly DEAs. |
| **4. Productionise** | ongoing | Track upstream HEM releases, swap in official Existing Dwellings Wrapper when published, prepare accreditation-scheme partnership for lodgement. |

## Key Risks & Mitigations

1. **Engine is pre-1.0 and unstable.** Pin to a specific commit; weekly CI rebuild
   against upstream `main` to detect breakage early; isolate engine behind the
   `/engine` boundary so churn doesn't ripple.
2. **Existing Dwellings Wrapper not yet published.** Our wrapper is provisional
   and labelled as such; built behind a stable interface so the official one drops
   in cleanly. Track DESNZ publications.
3. **WASM binary size.** The full HEM engine is non-trivial Rust. Measure in
   Phase 0; if >5 MB compressed, consider splitting non-critical modules behind
   dynamic import or a server-side fallback toggle.
4. **iOS Web Bluetooth gap** for Disto laser measures. Capacitor BLE plugin
   covers iOS; PWA-only users fall back to manual entry.
5. **5× longer assessments.** UX must be exceptional — voice notes, smart
   defaults, copy-zone-from-zone, photo OCR for meter readings. Prioritise field
   ergonomics over feature breadth.
6. **No lodgement = no revenue from official EPCs.** Position the MVP as a
   training/practice tool for the 2027–29 voluntary period and stock-modelling
   for retrofit consultants; line up an accreditation-scheme partnership in
   parallel for Phase 4.
7. **Legal/regulatory.** We are not an accreditation body. Marketing must be
   careful: the tool produces a "draft assessment", not a lodged EPC, until
   Phase 4.

## Verification

- **Engine parity**: `npm test` in `/engine` runs each upstream example through
  WASM and `diff`s the JSON output against `cargo run --release` output.
- **Wrapper validation**: golden-file tests — known site-data fixtures →
  expected core-input JSON, validated against `core-input.schema.json` with `ajv`.
- **End-to-end**: Playwright test walks through the capture flow for a sample
  dwelling on a tablet viewport, runs the engine, and asserts the four metrics
  fall in expected ranges.
- **Field test**: at the end of Phase 3, a real DEA performs an assessment on a
  known property and we compare results against the equivalent RdSAP output for
  sanity (acknowledging they will differ by design).
- **Performance budget**: full simulation must complete in <30 s on a 2023
  mid-range Android tablet; capture screens <100 ms interaction latency offline.

## Sources

- [communitiesuk/epb-home-energy-model](https://github.com/communitiesuk/epb-home-energy-model) — official Rust HEM engine (MIT)
- [HEM EPCs methodology consultation (gov.uk)](https://www.gov.uk/government/consultations/home-energy-model-energy-performance-certificates/home-energy-model-hem-methodology-for-assessing-existing-dwellings-and-producing-new-energy-performance-certificates-metrics-accessible-webpage)
- [HEM project resources](https://home-energy-model.co.uk/resources/)
- [Elmhurst Energy: HEM consultation for existing homes](https://www.elmhurstenergy.co.uk/blog/2026/01/27/government-seeks-views-on-home-energy-model-for-existing-homes/)
- [HEM delayed to 2027 — EPCGuide](https://www.epcguide.co.uk/blog/home-energy-model-delayed-2027-landlords)
- [How EPCs change under HEM](https://home-energy-model.co.uk/epcs/how-epcs-change/)

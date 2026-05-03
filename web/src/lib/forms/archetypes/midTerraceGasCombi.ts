import type { ArchetypeDef, FormParams, HemInput } from "../types";

type MidTerraceForm = {
  floorArea: number;
  numberOfStoreys: number;
  ceilingHeight: number;
  initialSetpoint: number;
  wallUValue: number;
  groundFloorUValue: number;
  occupants: number;
};

type WallShape = {
  type?: string;
  area?: number;
  height?: number;
  width?: number;
  pitch?: number;
  orientation360?: number;
  thermal_resistance_construction?: number;
  u_value?: number;
};

type ZoneShape = {
  area?: number;
  volume?: number;
  temp_setpnt_init?: number;
  BuildingElement?: Record<string, WallShape>;
};

type InternalGainsShape = {
  "metabolic gains"?: { schedule?: { main?: number[] } };
};

type Input = {
  Zone?: { "zone 1"?: ZoneShape };
  InternalGains?: InternalGainsShape;
  [k: string]: unknown;
};

const SURFACE_R = 0.17;
const BASELINE_OCCUPANTS = 2;
// Plan-shape assumption for mid-terraces: front longer than depth.
// Typical UK terraced footprint ratio is roughly 1.6:1.
const FRONT_TO_DEPTH = 1.6;

function uValueToRConstruction(u: number): number {
  return Math.max(0.05, 1 / u - SURFACE_R);
}

function round(n: number, dp = 2): number {
  const k = Math.pow(10, dp);
  return Math.round(n * k) / k;
}

export const midTerraceGasCombi: ArchetypeDef = {
  id: "mid-terrace-gas-combi-1990",
  name: "Mid-terrace, post-1990, gas combi",
  description:
    "Typical UK mid-terrace built between 1990 and 2002 with cavity wall insulation, double glazing, and a gas combi boiler. Defaults reflect Building Regulations of the period; tweak fields to match the actual property.",
  templatePath: "examples/mid_terrace_post_1990.json",
  defaults: {
    floorArea: 80,
    numberOfStoreys: 2,
    ceilingHeight: 2.4,
    initialSetpoint: 20,
    wallUValue: 0.45,
    groundFloorUValue: 0.45,
    occupants: 2,
  },
  fields: [
    {
      key: "floorArea",
      label: "Total floor area",
      unit: "m²",
      step: 1,
      min: 30,
      max: 250,
      hint: "Sum of internal floor areas across all storeys.",
    },
    {
      key: "numberOfStoreys",
      label: "Number of storeys",
      unit: "",
      step: 1,
      min: 1,
      max: 3,
      hint: "Most UK terraces are 2 storeys; some Victorian ones are 3.",
    },
    {
      key: "ceilingHeight",
      label: "Average ceiling height",
      unit: "m",
      step: 0.05,
      min: 2,
      max: 4,
      hint: "Typical UK terraced house = 2.4 m. Drives volume and wall heights.",
    },
    {
      key: "initialSetpoint",
      label: "Heating setpoint",
      unit: "°C",
      step: 0.5,
      min: 14,
      max: 24,
      hint: "Standard UK assessment assumption is 20 °C in the main living zone.",
    },
    {
      key: "wallUValue",
      label: "External wall U-value",
      unit: "W/m²K",
      step: 0.05,
      min: 0.1,
      max: 2.5,
      hint: "Filled cavity (post-1990) ≈ 0.45; modern PIR-insulated ≈ 0.18; solid uninsulated ≈ 1.5.",
    },
    {
      key: "groundFloorUValue",
      label: "Ground floor U-value",
      unit: "W/m²K",
      step: 0.05,
      min: 0.05,
      max: 3,
      hint: "Insulated suspended floor ≈ 0.25; uninsulated solid concrete ≈ 1.4.",
    },
    {
      key: "occupants",
      label: "Number of occupants",
      unit: "people",
      step: 1,
      min: 1,
      max: 8,
      hint: "Drives metabolic gains in the engine. Baseline calibrated to 2 occupants.",
    },
  ],
  applyForm(template, raw: FormParams): HemInput {
    const params = raw as MidTerraceForm;
    const next = structuredClone(template) as Input;
    const zone = next.Zone?.["zone 1"];
    if (!zone) return next as HemInput;

    // Plan geometry derived from floor area + storeys + ceiling height
    const storeys = Math.max(1, Math.round(params.numberOfStoreys));
    const footprint = params.floorArea / storeys;
    const frontWidth = round(Math.sqrt(footprint * FRONT_TO_DEPTH));
    const depth = round(footprint / frontWidth);
    const totalHeight = round(storeys * params.ceilingHeight);

    zone.area = params.floorArea;
    zone.volume = round(params.floorArea * params.ceilingHeight);
    zone.temp_setpnt_init = params.initialSetpoint;

    const elements = zone.BuildingElement ?? {};
    const wallR = uValueToRConstruction(params.wallUValue);

    for (const [name, el] of Object.entries(elements)) {
      if (!el || typeof el !== "object") continue;

      // External walls: rebuild dimensions + R-value from form
      if (name.startsWith("wall ") && el.type === "BuildingElementOpaque" && el.pitch === 90) {
        const orient = el.orientation360 ?? 0;
        // Front/back faces: orientation 0 (north) and 180 (south).
        // Side party walls in the demo template are at 90/270 — we keep them
        // as Opaque external walls for now, sized by depth, since the inherited
        // template doesn't carve out adjacent-zone party walls cleanly.
        const isFrontBack = orient === 0 || orient === 180;
        const faceWidth = isFrontBack ? frontWidth : depth;
        el.height = totalHeight;
        el.width = faceWidth;
        el.area = round(faceWidth * totalHeight);
        el.thermal_resistance_construction = round(wallR, 3);
      }

      // Ground floor: footprint
      if (name === "ground" && el.type === "BuildingElementGround") {
        el.area = round(footprint);
        el.u_value = params.groundFloorUValue;
      }
    }

    // Per-occupant scaling of the metabolic gains schedule (baseline = 2 occ)
    const scaled = next.InternalGains?.["metabolic gains"]?.schedule;
    const baseline = (template as Input).InternalGains?.["metabolic gains"]?.schedule?.main;
    if (baseline && scaled) {
      const factor = params.occupants / BASELINE_OCCUPANTS;
      scaled.main = baseline.map((v) => Math.round(v * factor));
    }

    return next as HemInput;
  },
};

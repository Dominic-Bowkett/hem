import type { ArchetypeDef, FormParams, HemInput } from "../types";

type MidTerraceForm = {
  floorArea: number;
  ceilingHeight: number;
  initialSetpoint: number;
  wallUValue: number;
  groundFloorUValue: number;
  occupants: number;
};

type ZoneShape = {
  area?: number;
  volume?: number;
  temp_setpnt_init?: number;
  BuildingElement?: Record<
    string,
    {
      type?: string;
      thermal_resistance_construction?: number;
      u_value?: number;
    }
  >;
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

function uValueToRConstruction(u: number): number {
  return Math.max(0.05, 1 / u - SURFACE_R);
}

export const midTerraceGasCombi: ArchetypeDef = {
  id: "mid-terrace-gas-combi-1990",
  name: "Mid-terrace, post-1990, gas combi",
  description:
    "Typical UK mid-terrace built between 1990 and 2002 with cavity wall insulation, double glazing, and a gas combi boiler. Defaults reflect Building Regulations of the period; tweak fields to match the actual property.",
  templatePath: "examples/mid_terrace_post_1990.json",
  defaults: {
    floorArea: 80,
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
      key: "ceilingHeight",
      label: "Average ceiling height",
      unit: "m",
      step: 0.05,
      min: 2,
      max: 4,
      hint: "Typical UK terraced house = 2.4 m. Volume is computed as area × this.",
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
    if (zone) {
      zone.area = params.floorArea;
      zone.volume = +(params.floorArea * params.ceilingHeight).toFixed(2);
      zone.temp_setpnt_init = params.initialSetpoint;

      const elements = zone.BuildingElement ?? {};
      const wallR = uValueToRConstruction(params.wallUValue);
      for (const [name, el] of Object.entries(elements)) {
        if (!el || typeof el !== "object") continue;
        if (name.startsWith("wall ") && el.type === "BuildingElementOpaque") {
          el.thermal_resistance_construction = +wallR.toFixed(3);
        }
      }
      if (elements.ground) {
        elements.ground.u_value = params.groundFloorUValue;
      }
    }

    const scaled = next.InternalGains?.["metabolic gains"]?.schedule;
    const baseline = (template as Input).InternalGains?.["metabolic gains"]?.schedule?.main;
    if (baseline && scaled) {
      const factor = params.occupants / BASELINE_OCCUPANTS;
      scaled.main = baseline.map((v) => Math.round(v * factor));
    }

    return next as HemInput;
  },
};

export type ParametricForm = {
  floorArea: number;
  volume: number;
  initialSetpoint: number;
  groundFloorUValue: number;
  internalGainsMultiplier: number;
};

export const DEFAULT_FORM: ParametricForm = {
  floorArea: 80,
  volume: 250,
  initialSetpoint: 21,
  groundFloorUValue: 1.4,
  internalGainsMultiplier: 1,
};

export type FormFieldSpec = {
  key: keyof ParametricForm;
  label: string;
  unit: string;
  step: number;
  min?: number;
  max?: number;
  hint: string;
};

export const FIELDS: FormFieldSpec[] = [
  {
    key: "floorArea",
    label: "Total floor area",
    unit: "m²",
    step: 1,
    min: 10,
    max: 500,
    hint: "Internal floor area of the heated zone.",
  },
  {
    key: "volume",
    label: "Heated volume",
    unit: "m³",
    step: 5,
    min: 30,
    max: 1500,
    hint: "Internal volume of the heated zone (area × ceiling height).",
  },
  {
    key: "initialSetpoint",
    label: "Initial setpoint",
    unit: "°C",
    step: 0.5,
    min: 10,
    max: 28,
    hint: "Zone temperature at the start of the simulation.",
  },
  {
    key: "groundFloorUValue",
    label: "Ground floor U-value",
    unit: "W/m²K",
    step: 0.05,
    min: 0.05,
    max: 3,
    hint: "Lower is better. Modern insulated floor ≈ 0.15; uninsulated solid floor ≈ 1.4.",
  },
  {
    key: "internalGainsMultiplier",
    label: "Occupancy / gains scale",
    unit: "×",
    step: 0.1,
    min: 0,
    max: 4,
    hint: "Multiplies the demo's hourly metabolic gains. 1× ≈ demo baseline, 2× ≈ twice as many occupants.",
  },
];

export type DemoTemplate = Record<string, unknown>;

type ZoneShape = {
  area?: number;
  volume?: number;
  temp_setpnt_init?: number;
  BuildingElement?: { ground?: { u_value?: number } };
};

type InternalGainsShape = {
  "metabolic gains"?: { schedule?: { main?: number[] } };
};

type ParametricInput = {
  Zone?: { "zone 1"?: ZoneShape };
  InternalGains?: InternalGainsShape;
  [k: string]: unknown;
};

export function applyForm(template: DemoTemplate, params: ParametricForm): DemoTemplate {
  const next = structuredClone(template) as ParametricInput;

  const zone = next.Zone?.["zone 1"];
  if (zone) {
    zone.area = params.floorArea;
    zone.volume = params.volume;
    zone.temp_setpnt_init = params.initialSetpoint;
    if (zone.BuildingElement?.ground) {
      zone.BuildingElement.ground.u_value = params.groundFloorUValue;
    }
  }

  const baseline = (template as ParametricInput).InternalGains?.["metabolic gains"]?.schedule?.main;
  const scaled = next.InternalGains?.["metabolic gains"]?.schedule;
  if (baseline && scaled) {
    scaled.main = baseline.map((v) => Math.round(v * params.internalGainsMultiplier));
  }

  return next as DemoTemplate;
}

export type HemInput = Record<string, unknown>;

export type FormParams = Record<string, number>;

export type FieldSpec = {
  key: string;
  label: string;
  unit: string;
  step: number;
  min?: number;
  max?: number;
  hint: string;
};

export type ArchetypeDef = {
  id: string;
  name: string;
  description: string;
  defaults: FormParams;
  fields: FieldSpec[];
  applyForm: (template: HemInput, params: FormParams) => HemInput;
};

import type { ArchetypeDef } from "./types";
import { demoParametric } from "./archetypes/demoParametric";
import { midTerraceGasCombi } from "./archetypes/midTerraceGasCombi";

export const ARCHETYPES: readonly ArchetypeDef[] = [
  midTerraceGasCombi,
  demoParametric,
];

export function findArchetype(id: string): ArchetypeDef | undefined {
  return ARCHETYPES.find((a) => a.id === id);
}

export const DEFAULT_ARCHETYPE_ID = midTerraceGasCombi.id;

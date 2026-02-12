export { parseSpec } from "./parser";
export { validateSpec } from "./validator";
export { buildGraphIR } from "./graph-builder";
export { generateArtifacts } from "./generators";
export { generateTerraform } from "./generators/terraform";
export type {
  SpecResource,
  ParsedSpec,
  SpecDiagnostic,
  ResourceType,
} from "./schema";
export { RESOURCE_TYPES } from "./schema";
export type { BuildGraphResult } from "./graph-builder";

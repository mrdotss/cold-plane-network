import type { SpecResource } from "../../schema";

/** A single generated Terraform file. */
export interface TerraformFile {
  /** Relative path (e.g., "modules/networking/main.tf"). */
  path: string;
  /** HCL content. */
  content: string;
}

/** Result of modular Terraform generation. */
export interface TerraformOutput {
  files: TerraformFile[];
  warnings: string[];
}

/** Output from a single service HCL generator. */
export interface ResourceHclOutput {
  /** The resource block(s) for main.tf. */
  mainBlock: string;
  /** Variable declarations for variables.tf. */
  variableBlocks: string[];
  /** Output declarations for outputs.tf. */
  outputBlocks: string[];
}

/** Generator function signature for a specific service type. */
export type ServiceGenerator = (resource: SpecResource) => ResourceHclOutput;

/**
 * @deprecated — Use `./terraform/index` for modular Terraform generation.
 * This file is kept for backward compatibility with existing imports.
 */
export { generateTerraformModular as generateTerraform } from "./terraform/index";
export type { TerraformOutput, TerraformFile } from "./terraform/types";

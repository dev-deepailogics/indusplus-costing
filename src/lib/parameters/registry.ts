export * from "@/features/parameters/services/ParametersService";
export { ParametersService as default } from "@/features/parameters/services/ParametersService";

import { ParametersService } from "@/features/parameters";
export function getParameterDef(slug: string) {
  return ParametersService.getParameterDef(slug);
}

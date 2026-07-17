import type { ValidatedBusiness } from "../types";

type LegacyCRMStatus = NonNullable<ValidatedBusiness["crmStatus"]>;

export function legacyStatusToCRMStage(status?: ValidatedBusiness["crmStatus"]): string {
  switch (status) {
    case "contactado":
      return "contactado";
    case "interesado":
      return "diagnostico";
    case "aprobado":
      return "aprobado";
    case "descartado":
      return "perdido";
    case "nuevo":
    default:
      return "capturado";
  }
}

export function crmStageToLegacyStatus(stageId: string): LegacyCRMStatus {
  if (stageId === "contactado") return "contactado";
  if (["diagnostico", "documentacion", "solicitud", "estudio"].includes(stageId)) return "interesado";
  if (["aprobado", "desembolsado"].includes(stageId)) return "aprobado";
  if (["no_elegible", "perdido", "duplicado", "sin_respuesta"].includes(stageId)) return "descartado";
  return "nuevo";
}

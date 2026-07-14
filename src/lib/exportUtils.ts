import * as XLSX from "xlsx";
import { ValidatedBusiness } from "../types";
import { translateTypes } from "./typeTranslations";

export function exportToExcel(data: ValidatedBusiness[], filename = "negocios_extraidos.xlsx") {
  // Format data for Excel
  const excelData = data.map(b => {
    let estado = "Operacional";
    if (b.businessStatus === "CLOSED_TEMPORARILY") estado = "Cerrado Temporalmente";
    if (b.businessStatus === "CLOSED_PERMANENTLY") estado = "Cerrado Permanentemente";

    return {
      "Nombre del Negocio": b.name,
      "Teléfono": b.phone || "No disponible",
      "Dirección": b.address,
      "Municipio": b.municipality,
      "Sitio Web": b.website || "No disponible",
      "Categorías": translateTypes(b.types),
      "Calificación": b.rating || "N/A",
      "Número de Reseñas": b.userRatingsTotal || 0,
      "Estado": estado,
      "Es Micro/PYME": b.isMicroSME ? "Sí" : "No",
      "Confiabilidad Datos (1-10)": b.reliabilityScore,
      "Score Oportunidad (%)": b.opportunityScore,
      "Tamaño Estimado": b.estimatedSize,
      "Necesidad Financiera": b.predictedNeed,
      "Huella Digital": b.digitalFootprint,
      "Estado CRM": b.crmStatus ? b.crmStatus.toUpperCase() : "NUEVO",
      "Notas del Asesor": b.userNotes || "",
      "Descripción del Negocio": b.reasoning
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  
  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Negocios");
  
  // Set column widths
  worksheet["!cols"] = [
    { wch: 30 }, // Nombre
    { wch: 15 }, // Teléfono
    { wch: 40 }, // Dirección
    { wch: 15 }, // Municipio
    { wch: 25 }, // Sitio Web
    { wch: 30 }, // Categorías
    { wch: 12 }, // Calificación
    { wch: 18 }, // Reseñas
    { wch: 15 }, // Estado
    { wch: 15 }, // Es Micro/PYME
    { wch: 25 }, // Confiabilidad Datos
    { wch: 20 }, // Score Oportunidad
    { wch: 18 }, // Tamaño Estimado
    { wch: 25 }, // Necesidad Financiera
    { wch: 15 }, // Huella Digital
    { wch: 15 }, // Estado CRM
    { wch: 35 }, // Notas
    { wch: 40 }  // Razonamiento
  ];

  XLSX.writeFile(workbook, filename);
}


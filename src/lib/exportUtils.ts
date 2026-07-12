import * as XLSX from "xlsx";
import { ValidatedBusiness } from "../types";

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
      "Categorías": b.types.map(t => t.replace(/_/g, ' ')).join(", "),
      "Calificación": b.rating || "N/A",
      "Número de Reseñas": b.userRatingsTotal || 0,
      "Estado": estado,
      "Es Micro/PYME": b.isMicroSME ? "Sí" : "No",
      "Confiabilidad (1-10)": b.reliabilityScore
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(excelData);
  
  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Negocios");
  
  // Set some column widths
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
    { wch: 20 }  // Confiabilidad
  ];

  XLSX.writeFile(workbook, filename);
}

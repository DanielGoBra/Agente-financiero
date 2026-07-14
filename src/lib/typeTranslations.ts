export const TYPE_TRANSLATIONS: Record<string, string> = {
  restaurant: "Restaurante",
  bakery: "Panadería",
  store: "Tienda / Comercio",
  food: "Alimentos",
  hair_care: "Estética / Peluquería",
  hardware_store: "Ferretería",
  clothing_store: "Tienda de ropa / Boutique",
  beauty_salon: "Salón de belleza",
  bar: "Bar / Discoteca",
  cafe: "Cafetería",
  meal_takeaway: "Comida para llevar",
  meal_delivery: "Comida a domicilio",
  car_repair: "Taller mecánico",
  gas_station: "Estación de servicio",
  supermarket: "Supermercado",
  grocery_or_supermarket: "Supermercado / Fruver",
  convenience_store: "Tienda de conveniencia",
  pharmacy: "Farmacia / Droguería",
  laundry: "Lavandería",
  gym: "Gimnasio",
  spa: "Spa / Centro de relajación",
  hotel: "Hotel / Hospedaje",
  bank: "Banco / Servicios financieros",
  finance: "Finanzas",
  dentist: "Odontología / Dentista",
  doctor: "Consultorio médico",
  health: "Salud",
  school: "Colegio / Escuela",
  liquor_store: "Licorería",
  shoe_store: "Zapatería",
  electronics_store: "Tienda de tecnología",
  home_goods_store: "Artículos para el hogar",
  pet_store: "Tienda de mascotas",
  florist: "Floristería",
  book_store: "Librería",
  car_dealer: "Concesionario",
  car_wash: "Lavadero de autos",
  furniture_store: "Mueblería / Decoración",
  bicycle_store: "Tienda de bicicletas",
  jewelry_store: "Joyería",
  shopping_mall: "Centro comercial",
  department_store: "Tienda por departamentos",
  office: "Oficina corporativa",
  local_government_office: "Oficina gubernamental",
  general_contractor: "Contratista general",
  real_estate_agency: "Inmobiliaria",
  insurance_agency: "Agencia de seguros",
  travel_agency: "Agencia de viajes",
  post_office: "Oficina de correos",
  library: "Biblioteca",
  museum: "Museo",
  art_gallery: "Galería de arte",
  stadium: "Estadio",
  point_of_interest: "Punto de interés",
  establishment: "Establecimiento"
};

export function translateTypes(types: string[]): string {
  if (!types || types.length === 0) return "General";
  
  // Filter out generic tags like 'point_of_interest' or 'establishment' if we have better ones
  const filtered = types.filter(t => t !== "point_of_interest" && t !== "establishment");
  const typesToTranslate = filtered.length > 0 ? filtered : types;
  
  // Translate each type and return unique translated values
  const translated = typesToTranslate.map(t => {
    const key = t.toLowerCase();
    return TYPE_TRANSLATIONS[key] || t.replace(/_/g, ' ');
  });
  
  return Array.from(new Set(translated)).join(", ");
}

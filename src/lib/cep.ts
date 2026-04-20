export type CepResult = {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

export const lookupCep = async (rawCep: string): Promise<CepResult | null> => {
  const cep = rawCep.replace(/\D/g, "");
  if (cep.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return {
      cep: data.cep,
      street: data.logradouro ?? "",
      neighborhood: data.bairro ?? "",
      city: data.localidade ?? "",
      state: data.uf ?? "",
    };
  } catch {
    return null;
  }
};

export const geocodeAddress = async (
  query: string,
): Promise<{ lat: number; lng: number } | null> => {
  if (!query.trim()) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(
      query,
    )}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return { lat: parseFloat(arr[0].lat), lng: parseFloat(arr[0].lon) };
  } catch {
    return null;
  }
};

export type ReverseAddress = {
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
};

export const reverseGeocode = async (
  lat: number,
  lng: number,
): Promise<ReverseAddress | null> => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=pt-BR`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address ?? {};
    return {
      cep: (a.postcode ?? "").replace(/\D/g, "").replace(/(\d{5})(\d{3})/, "$1-$2"),
      street: a.road ?? a.pedestrian ?? a.cycleway ?? "",
      number: a.house_number ?? "",
      neighborhood: a.suburb ?? a.neighbourhood ?? a.city_district ?? "",
      city: a.city ?? a.town ?? a.village ?? a.municipality ?? "",
      state: a.state ?? "",
      country: a.country ?? "Brasil",
    };
  } catch {
    return null;
  }
};

export const formatCep = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
};

// Haversine em km
export const distanceKm = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number => {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
};

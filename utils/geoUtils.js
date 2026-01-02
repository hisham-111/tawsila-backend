export const haversineDistance = (coords1, coords2) => {
  const toRad = deg => deg * Math.PI / 180;
  const R = 6371; // km
  const dLat = toRad(coords2.lat - coords1.lat);
  const dLng = toRad(coords2.lng - coords1.lng);
  const a = 
    Math.sin(dLat/2) ** 2 +
    Math.cos(toRad(coords1.lat)) * Math.cos(toRad(coords2.lat)) * Math.sin(dLng/2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // distance in km
};

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

/** Keeps the Leaflet map sized correctly and framed on all live points. */
const MapAutoFit = ({ points }: { points: { lat: number; lng: number }[] }) => {
  const map = useMap();
  const fitted = useRef(0);
  useEffect(() => {
    const fix = () => map.invalidateSize();
    const t1 = setTimeout(fix, 100);
    const t2 = setTimeout(fix, 600);
    window.addEventListener("resize", fix);
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener("resize", fix); };
  }, [map]);
  useEffect(() => {
    if (!points.length || fitted.current === points.length) return;
    fitted.current = points.length;
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 16);
    else map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])), { padding: [50, 50], maxZoom: 17 });
  }, [map, points]);
  return null;
};
export default MapAutoFit;

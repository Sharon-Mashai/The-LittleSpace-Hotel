import { useEffect } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L, { divIcon } from "leaflet";
import "leaflet/dist/leaflet.css";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Configure Leaflet's default marker images for Vite.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom LittleSpace hotel location marker.
const hotelMarkerIcon = divIcon({
  className: "hotel-map-marker-wrapper",
  html: `
    <div class="hotel-map-marker">
      <span>H</span>
    </div>
  `,
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

type BranchMapProps = {
  branchName: string;
  latitude: number | string | null;
  longitude: number | string | null;
};

function MapCenterUpdater({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.setView([latitude, longitude], 15);
  }, [latitude, longitude, map]);

  return null;
}

function BranchMap({ branchName, latitude, longitude }: BranchMapProps) {
  // Convert coordinates to numbers because PostgreSQL may return them as strings.
  const numericLatitude = latitude === null ? NaN : Number(latitude);
  const numericLongitude = longitude === null ? NaN : Number(longitude);

  // Check that both coordinates are valid.
  if (
    !Number.isFinite(numericLatitude) ||
    !Number.isFinite(numericLongitude) ||
    numericLatitude < -90 ||
    numericLatitude > 90 ||
    numericLongitude < -180 ||
    numericLongitude > 180
  ) {
    return (
      <section className="branch-map-section">
        <h2>Find this branch</h2>
        <div className="branch-map-unavailable">
          <p>
            Map location is currently unavailable for this branch. Please use
            the branch address above.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="branch-map-section">
      <h2>Find this branch</h2>
      <p>Explore the location of {branchName} on the map.</p>

      <div className="branch-map-container">
        <MapContainer
          center={[numericLatitude, numericLongitude]}
          zoom={15}
          scrollWheelZoom={false}
          className="branch-map"
        >
          <MapCenterUpdater
            latitude={numericLatitude}
            longitude={numericLongitude}
          />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <Marker
            position={[numericLatitude, numericLongitude]}
            icon={hotelMarkerIcon}
          >
            <Popup>{branchName}</Popup>
          </Marker>
        </MapContainer>
      </div>

      <p className="branch-map-attribution">
        Map data provided by OpenStreetMap.
      </p>
    </section>
  );
}

export default BranchMap;

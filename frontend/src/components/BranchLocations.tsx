import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L, { divIcon } from "leaflet";
import "leaflet/dist/leaflet.css";

import { getHotelBranches, type HotelBranch } from "../services/branches";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Configure Leaflet's default marker images.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Custom LittleSpace map marker.
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

// Available branch display options.
export type BranchView = "map" | "list";

type BranchLocationsProps = {
  view: BranchView;
  selectedBranchId?: string | null;
};

// Controls the map position based on the selected branch.
function MapController({
  branches,
  selectedBranchId,
}: {
  branches: HotelBranch[];
  selectedBranchId: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedBranchId) {
      const selectedBranch = branches.find(
        (branch) => String(branch.id) === selectedBranchId,
      );

      if (
        selectedBranch &&
        selectedBranch.latitude !== null &&
        selectedBranch.longitude !== null
      ) {
        map.flyTo([selectedBranch.latitude, selectedBranch.longitude], 14, {
          duration: 1.2,
        });

        return;
      }
    }

    // Display all branch locations when no specific branch is selected.
    if (branches.length > 0) {
      const bounds = L.latLngBounds(
        branches.map((branch) => [branch.latitude!, branch.longitude!]),
      );

      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 7,
      });
    }
  }, [branches, selectedBranchId, map]);

  return null;
}

function BranchLocations({
  view,
  selectedBranchId = null,
}: BranchLocationsProps) {
  const [branches, setBranches] = useState<HotelBranch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch all LittleSpace branches from the backend.
  useEffect(() => {
    async function loadBranches() {
      try {
        setIsLoading(true);
        setError("");

        const data = await getHotelBranches();
        setBranches(data);
      } catch (err) {
        console.error("Failed to load branch locations:", err);

        setError("We could not load our branch locations. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }

    loadBranches();
  }, []);

  // Only branches with valid coordinates can appear on the map.
  const branchesWithCoordinates = branches.filter(
    (branch) =>
      branch.latitude !== null &&
      branch.longitude !== null &&
      Number.isFinite(branch.latitude) &&
      Number.isFinite(branch.longitude),
  );

  return (
    <div className="branch-locations-content">
      {isLoading && (
        <div className="branch-locations-message">
          Loading our branch locations...
        </div>
      )}

      {!isLoading && error && (
        <div className="branch-locations-message error">{error}</div>
      )}

      {!isLoading && !error && branches.length === 0 && (
        <div className="branch-locations-message">
          No branch locations are currently available.
        </div>
      )}

      {/* Map view */}
      {!isLoading && !error && view === "map" && (
        <div className="all-branches-map-container">
          {branchesWithCoordinates.length > 0 ? (
            <MapContainer
              center={[-28.4793, 24.6727]}
              zoom={5}
              scrollWheelZoom={false}
              className="all-branches-map"
            >
              <MapController
                branches={branchesWithCoordinates}
                selectedBranchId={selectedBranchId}
              />

              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {branchesWithCoordinates.map((branch) => (
                <Marker
                  key={branch.id}
                  position={[branch.latitude!, branch.longitude!]}
                  icon={hotelMarkerIcon}
                >
                  <Popup>
                    <div className="branch-map-popup">
                      <strong>{branch.name}</strong>

                      <p>
                        {branch.address_line}, {branch.city}
                      </p>

                      <Link to={`/hotels/${branch.id}`}>
                        View branch details →
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="branch-locations-message">
              Map coordinates are not available for our branches.
            </div>
          )}
        </div>
      )}

      {/* List view */}
      {!isLoading && !error && view === "list" && (
        <div className="branch-locations-list">
          {branches.map((branch) => (
            <article className="branch-location-card" key={branch.id}>
              <div className="branch-location-icon">
                <span>H</span>
              </div>

              <div className="branch-location-info">
                <h3>{branch.name}</h3>

                <p>
                  {branch.address_line}
                  {branch.suburb ? `, ${branch.suburb}` : ""}, {branch.city}
                  {branch.province ? `, ${branch.province}` : ""}
                </p>
              </div>

              <Link
                className="branch-location-link"
                to={`/hotels/${branch.id}`}
              >
                View branch →
              </Link>
            </article>
          ))}
        </div>
      )}

      {!isLoading && !error && branches.length > 0 && (
        <p className="branch-locations-count">
          Showing {branches.length} LittleSpace branches.
        </p>
      )}
    </div>
  );
}

export default BranchLocations;

type BranchMapProps = {
  branchName: string;
  latitude: number | string | null;
  longitude: number | string | null;
};

function BranchMap({ branchName, latitude, longitude }: BranchMapProps) {
  const numericLatitude = latitude === null ? NaN : Number(latitude);
  const numericLongitude = longitude === null ? NaN : Number(longitude);
  const hasValidCoordinates =
    Number.isFinite(numericLatitude) &&
    Number.isFinite(numericLongitude) &&
    numericLatitude >= -90 &&
    numericLatitude <= 90 &&
    numericLongitude >= -180 &&
    numericLongitude <= 180;

  const mapUrl = hasValidCoordinates
    ? `https://www.openstreetmap.org/?mlat=${numericLatitude}&mlon=${numericLongitude}#map=16/${numericLatitude}/${numericLongitude}`
    : null;

  return (
    <section className="branch-map-section">
      <h2>Find this branch</h2>
      {mapUrl ? (
        <p>
          <a href={mapUrl} target="_blank" rel="noreferrer">
            Explore the location of {branchName} on OpenStreetMap
          </a>
        </p>
      ) : (
        <p>
          Map location is currently unavailable for this branch. Please use the
          branch address above.
        </p>
      )}
    </section>
  );
}

export default BranchMap;

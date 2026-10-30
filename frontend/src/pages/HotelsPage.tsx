import { useMemo, useState } from "react";
import type { HomeSearchCriteria } from "./HomePage";
import capeTownImage from "../assets/search-results/cape-town.png";
import tzaneenImage from "../assets/search-results/tzaneen.png";
import johannesburgImage from "../assets/search-results/johannesburg.png";
import pretoriaImage from "../assets/search-results/pretoria.png";
import durbanImage from "../assets/search-results/durban.png";
import polokwaneImage from "../assets/search-results/polokwane.png";

type HotelsPageProps = {
  initialLocation?: string;
  initialSearchCriteria?: HomeSearchCriteria;
  onViewStay?: (stayId: string) => void;
};

type Stay = {
  id: string;
  location: string;
  price: number;
  rating: number;
  image: string;
  imageAlt: string;
  facilities: string[];
};

const stays: Stay[] = [
  {
    id: "cape-town",
    location: "Cape Town",
    price: 1850,
    rating: 4.8,
    image: capeTownImage,
    imageAlt: "Hotel accommodation in Cape Town",
    facilities: ["Wi-Fi", "Parking", "Breakfast"],
  },
  {
    id: "tzaneen",
    location: "Tzaneen",
    price: 2100,
    rating: 4.8,
    image: tzaneenImage,
    imageAlt: "Hotel accommodation in Tzaneen",
    facilities: ["Wi-Fi", "Swimming pool", "Breakfast"],
  },
  {
    id: "johannesburg",
    location: "Johannesburg",
    price: 1450,
    rating: 4.8,
    image: johannesburgImage,
    imageAlt: "Hotel accommodation in Johannesburg",
    facilities: ["Wi-Fi", "Swimming pool", "Parking"],
  },
  {
    id: "pretoria",
    location: "Pretoria",
    price: 1650,
    rating: 4.8,
    image: pretoriaImage,
    imageAlt: "Hotel accommodation in Pretoria",
    facilities: ["Wi-Fi", "Swimming pool", "Parking", "Breakfast"],
  },
  {
    id: "durban",
    location: "Durban",
    price: 2350,
    rating: 4.8,
    image: durbanImage,
    imageAlt: "Hotel accommodation in Durban",
    facilities: ["Wi-Fi", "Swimming pool", "Breakfast"],
  },
  {
    id: "polokwane",
    location: "Polokwane",
    price: 1250,
    rating: 4.8,
    image: polokwaneImage,
    imageAlt: "Hotel accommodation in Polokwane",
    facilities: ["Wi-Fi", "Parking"],
  },
];

const facilityOptions = ["Wi-Fi", "Swimming pool", "Parking", "Breakfast"];

const destinations = [
  "Cape Town",
  "Tzaneen",
  "Johannesburg",
  "Pretoria",
  "Durban",
  "Polokwane",
];

function HotelsPage({
  initialLocation = "",
  initialSearchCriteria,
  onViewStay,
}: HotelsPageProps) {
  const [searchTerm, setSearchTerm] = useState(
    initialSearchCriteria?.destination || initialLocation,
  );
  const [maximumPrice, setMaximumPrice] = useState(3000);
  const [excellentOnly, setExcellentOnly] = useState(false);
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);

  const filteredStays = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return stays.filter((stay) => {
      const matchesLocation = stay.location
        .toLowerCase()
        .includes(normalizedSearch);

      const withinPrice = stay.price <= maximumPrice;
      const meetsRating = !excellentOnly || stay.rating >= 4;

      const hasFacilities = selectedFacilities.every((facility) =>
        stay.facilities.includes(facility),
      );

      return matchesLocation && withinPrice && meetsRating && hasFacilities;
    });
  }, [searchTerm, maximumPrice, excellentOnly, selectedFacilities]);

  function toggleFacility(facility: string) {
    setSelectedFacilities((current) =>
      current.includes(facility)
        ? current.filter((item) => item !== facility)
        : [...current, facility],
    );
  }

  function clearFilters() {
    setSearchTerm("");
    setMaximumPrice(3000);
    setExcellentOnly(false);
    setSelectedFacilities([]);
  }

  return (
    <main className="search-page">
      <section className="search-heading">
        <p className="eyebrow">YOUR NEXT STAY STARTS HERE</p>
        <h1>Find your perfect stay</h1>
        <p>Explore our stays across South Africa.</p>

        <label className="search-input-label" htmlFor="location-search">
          Search by location
        </label>

        <input
          id="location-search"
          className="location-search"
          type="search"
          placeholder="Search by city, e.g. Polokwane"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />

        <div className="destination-chips" aria-label="Quick city search">
          {destinations.map((location) => (
            <button
              className={`destination-chip ${
                searchTerm === location ? "active" : ""
              }`}
              type="button"
              key={location}
              onClick={() =>
                setSearchTerm((current) =>
                  current === location ? "" : location,
                )
              }
            >
              {location}
            </button>
          ))}
        </div>
      </section>

      {initialSearchCriteria && (
        <section className="search-summary">
          <h2>Your search</h2>
          <p>
            {initialSearchCriteria.destination || "All destinations"}
            {" · "}
            {initialSearchCriteria.adults}{" "}
            {initialSearchCriteria.adults === 1 ? "adult" : "adults"}
            {" · "}
            {initialSearchCriteria.children}{" "}
            {initialSearchCriteria.children === 1 ? "child" : "children"}
            {" · "}
            {initialSearchCriteria.rooms}{" "}
            {initialSearchCriteria.rooms === 1 ? "room" : "rooms"}
          </p>
          <p>
            {initialSearchCriteria.checkIn} to {initialSearchCriteria.checkOut}
          </p>
        </section>
      )}

      <div className="search-layout">
        <aside className="filters-panel">
          <div className="filters-heading">
            <h2>Filters</h2>
            <button
              className="clear-button"
              type="button"
              onClick={clearFilters}
            >
              Clear all
            </button>
          </div>

          <div className="filter-group">
            <label htmlFor="maximum-price">Maximum price per night</label>

            <p className="price-value">
              R{maximumPrice.toLocaleString("en-ZA")}
            </p>

            <input
              id="maximum-price"
              className="price-slider"
              type="range"
              min="1000"
              max="3000"
              step="50"
              value={maximumPrice}
              onChange={(event) => setMaximumPrice(Number(event.target.value))}
            />

            <div className="range-labels">
              <span>R1,000</span>
              <span>R3,000</span>
            </div>
          </div>

          <div className="filter-group">
            <h3>Guest rating</h3>

            <label className="filter-option">
              <input
                type="checkbox"
                checked={excellentOnly}
                onChange={(event) => setExcellentOnly(event.target.checked)}
              />
              <span>4+ Excellent</span>
            </label>
          </div>

          <div className="filter-group">
            <h3>Facilities</h3>

            {facilityOptions.map((facility) => (
              <label className="filter-option" key={facility}>
                <input
                  type="checkbox"
                  checked={selectedFacilities.includes(facility)}
                  onChange={() => toggleFacility(facility)}
                />
                <span>{facility}</span>
              </label>
            ))}
          </div>
        </aside>

        <section className="results-section">
          <div className="results-heading">
            <div>
              <h2>Available stays</h2>
              <p>
                {filteredStays.length}{" "}
                {filteredStays.length === 1 ? "stay" : "stays"} found
              </p>
            </div>
          </div>

          {filteredStays.length > 0 ? (
            <div className="results-grid">
              {filteredStays.map((stay) => (
                <article className="stay-card result-card" key={stay.id}>
                  <div className="result-image-wrap">
                    <img src={stay.image} alt={stay.imageAlt} />
                    <span className="rating-badge">
                      ★ {stay.rating.toFixed(1)}
                    </span>
                  </div>

                  <div className="result-card-content">
                    <p className="stay-location">SOUTH AFRICA</p>
                    <h3>{stay.location}</h3>

                    <p className="facility-summary">
                      {stay.facilities.join(" · ")}
                    </p>

                    <div className="result-card-footer">
                      <p className="stay-price">
                        <strong>R{stay.price.toLocaleString("en-ZA")}</strong>
                        <span> / night</span>
                      </p>

                      <button
                        className="card-book-button"
                        type="button"
                        onClick={() => onViewStay?.(stay.id)}
                      >
                        View stay
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="no-results">
              <h3>No stays match your filters</h3>
              <p>Try another city or clear some filters to see more stays.</p>

              <button
                className="primary-button"
                type="button"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default HotelsPage;

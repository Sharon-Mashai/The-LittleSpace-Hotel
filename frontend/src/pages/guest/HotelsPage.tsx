import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { HomeSearchCriteria } from "./HomePage";
import { getHotelBranches, type HotelBranch } from "../../services/branches";
import {
  getGuestFavourites,
  addGuestFavourite,
  removeGuestFavourite,
} from "../../services/favourites";
import { getAuthToken } from "../../services/auth";
import capeTownImage from "../../assets/search-results/cape-town.png";
import tzaneenImage from "../../assets/search-results/tzaneen.png";
import johannesburgImage from "../../assets/search-results/johannesburg.png";
import pretoriaImage from "../../assets/search-results/pretoria.png";
import durbanImage from "../../assets/search-results/durban.png";
import polokwaneImage from "../../assets/search-results/polokwane.png";

type HotelsPageProps = {
  initialLocation?: string;
  initialSearchCriteria?: HomeSearchCriteria;
  onViewStay?: (stayId: string) => void;
};

type Stay = {
  id: string;
  location: string;
  price: number;
  image: string;
  imageAlt: string;
  facilities: string[];
};

const stays: Stay[] = [
  {
    id: "cape-town",
    location: "Cape Town",
    price: 1850,
    image: capeTownImage,
    imageAlt: "Hotel accommodation in Cape Town",
    facilities: ["Wi-Fi", "Parking", "Breakfast"],
  },
  {
    id: "tzaneen",
    location: "Tzaneen",
    price: 2100,
    image: tzaneenImage,
    imageAlt: "Hotel accommodation in Tzaneen",
    facilities: ["Wi-Fi", "Swimming pool", "Breakfast"],
  },
  {
    id: "johannesburg",
    location: "Johannesburg",
    price: 1450,
    image: johannesburgImage,
    imageAlt: "Hotel accommodation in Johannesburg",
    facilities: ["Wi-Fi", "Swimming pool", "Parking"],
  },
  {
    id: "pretoria",
    location: "Pretoria",
    price: 1650,
    image: pretoriaImage,
    imageAlt: "Hotel accommodation in Pretoria",
    facilities: ["Wi-Fi", "Swimming pool", "Parking", "Breakfast"],
  },
  {
    id: "durban",
    location: "Durban",
    price: 2350,
    image: durbanImage,
    imageAlt: "Hotel accommodation in Durban",
    facilities: ["Wi-Fi", "Swimming pool", "Breakfast"],
  },
  {
    id: "polokwane",
    location: "Polokwane",
    price: 1250,
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
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState(
    initialSearchCriteria?.destination || initialLocation,
  );
  const [maximumPrice, setMaximumPrice] = useState(3000);
  const [excellentOnly, setExcellentOnly] = useState(false);
  const [selectedFacilities, setSelectedFacilities] = useState<string[]>([]);

  const [branches, setBranches] = useState<HotelBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branchesError, setBranchesError] = useState("");

  const [favouriteBranchIds, setFavouriteBranchIds] = useState<number[]>([]);
  const [favouritesLoading, setFavouritesLoading] = useState(false);
  const [favouriteActionId, setFavouriteActionId] = useState<number | null>(
    null,
  );
  const [favouriteError, setFavouriteError] = useState("");

  const getMatchingBranch = useCallback(
    (stay: Stay) =>
      branches.find(
        (branch) =>
          branch.city.trim().toLowerCase() ===
          stay.location.trim().toLowerCase(),
      ),
    [branches],
  );

  useEffect(() => {
    async function loadBranches() {
      try {
        const data = await getHotelBranches();
        setBranches(data);
      } catch (error) {
        setBranchesError(
          error instanceof Error
            ? error.message
            : "Unable to load hotel branches.",
        );
      } finally {
        setBranchesLoading(false);
      }
    }

    loadBranches();
  }, []);

  useEffect(() => {
    async function loadFavourites() {
      if (!getAuthToken()) {
        setFavouriteBranchIds([]);
        return;
      }

      try {
        setFavouritesLoading(true);

        const data = await getGuestFavourites();

        setFavouriteBranchIds(data.map((favourite) => favourite.branch_id));
      } catch (error) {
        setFavouriteError(
          error instanceof Error
            ? error.message
            : "Unable to load your favourites.",
        );
      } finally {
        setFavouritesLoading(false);
      }
    }

    loadFavourites();
  }, []);

  const filteredStays = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return stays.filter((stay) => {
      const matchesLocation = stay.location
        .toLowerCase()
        .includes(normalizedSearch);

      const withinPrice = stay.price <= maximumPrice;
      const branch = getMatchingBranch(stay);
      const meetsRating =
        !excellentOnly ||
        (branch !== undefined &&
          branch.review_count > 0 &&
          Number(branch.average_rating) >= 4);

      const hasFacilities = selectedFacilities.every((facility) =>
        stay.facilities.includes(facility),
      );

      return matchesLocation && withinPrice && meetsRating && hasFacilities;
    });
  }, [
    searchTerm,
    maximumPrice,
    excellentOnly,
    selectedFacilities,
    getMatchingBranch,
  ]);

  async function handleToggleFavourite(branch: HotelBranch) {
    if (!getAuthToken()) {
      navigate("/sign-in");
      return;
    }

    setFavouriteError("");
    setFavouriteActionId(branch.id);

    const isFavourite = favouriteBranchIds.includes(branch.id);

    try {
      if (isFavourite) {
        await removeGuestFavourite(branch.id);

        setFavouriteBranchIds((current) =>
          current.filter((id) => id !== branch.id),
        );
      } else {
        await addGuestFavourite(branch.id);

        setFavouriteBranchIds((current) =>
          current.includes(branch.id) ? current : [...current, branch.id],
        );
      }
    } catch (error) {
      setFavouriteError(
        error instanceof Error
          ? error.message
          : "Unable to update your favourites. Please try again.",
      );
    } finally {
      setFavouriteActionId(null);
    }
  }

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

          {branchesLoading && (
            <p role="status">Loading hotel branch information...</p>
          )}

          {branchesError && (
            <p className="auth-error" role="alert">
              {branchesError}
            </p>
          )}

          {favouriteError && (
            <p className="auth-error" role="alert">
              {favouriteError}
            </p>
          )}

          {favouritesLoading && <p role="status">Loading your favourites...</p>}

          {filteredStays.length > 0 ? (
            <div className="results-grid">
              {filteredStays.map((stay) => {
                const matchingBranch = getMatchingBranch(stay);
                const displayedRating = matchingBranch
                  ? matchingBranch.review_count > 0
                    ? matchingBranch.average_rating
                    : matchingBranch.star_rating
                  : null;
                const isFavourite = matchingBranch
                  ? favouriteBranchIds.includes(matchingBranch.id)
                  : false;

                return (
                  <article className="stay-card result-card" key={stay.id}>
                    <div className="result-image-wrap">
                      <img src={stay.image} alt={stay.imageAlt} />

                      {displayedRating !== null && (
                        <span className="rating-badge">
                          ★ {displayedRating.toFixed(1)}
                          {matchingBranch && matchingBranch.review_count > 0
                            ? ` (${matchingBranch.review_count})`
                            : ""}
                        </span>
                      )}

                      {matchingBranch && (
                        <button
                          className={`favourite-toggle ${
                            isFavourite ? "active" : ""
                          }`}
                          type="button"
                          aria-label={
                            isFavourite
                              ? `Remove ${stay.location} from favourites`
                              : `Add ${stay.location} to favourites`
                          }
                          aria-pressed={isFavourite}
                          disabled={
                            favouriteActionId === matchingBranch.id ||
                            favouritesLoading
                          }
                          onClick={() => handleToggleFavourite(matchingBranch)}
                        >
                          {favouriteActionId === matchingBranch.id
                            ? "..."
                            : isFavourite
                              ? "♡"
                              : "♡"}
                        </button>
                      )}
                    </div>

                    <div className="result-card-content">
                      <p className="stay-location">SOUTH AFRICA</p>
                      <h3>{stay.location}</h3>

                      <p className="facility-summary">
                        {stay.facilities.join(" · ")}
                      </p>

                      {matchingBranch && (
                        <p className="facility-summary">
                          The {matchingBranch.name}
                        </p>
                      )}

                      {matchingBranch &&
                        matchingBranch.latest_review_rating !== null && (
                          <blockquote className="result-review">
                            <p className="result-review-rating">
                              {"★".repeat(matchingBranch.latest_review_rating)}
                              {"☆".repeat(
                                5 - matchingBranch.latest_review_rating,
                              )}
                              <span>
                                {matchingBranch.latest_review_rating}/5
                              </span>
                            </p>
                            {matchingBranch.latest_review_comment && (
                              <p
                                className="result-review-comment"
                                title={matchingBranch.latest_review_comment}
                              >
                                “{matchingBranch.latest_review_comment}”
                              </p>
                            )}
                            {matchingBranch.latest_review_author && (
                              <cite>
                                — {matchingBranch.latest_review_author}
                              </cite>
                            )}
                          </blockquote>
                        )}

                      <div className="result-card-footer">
                        <p className="stay-price">
                          <strong>R{stay.price.toLocaleString("en-ZA")}</strong>
                          <span> / night</span>
                        </p>

                        <button
                          className="card-book-button"
                          type="button"
                          onClick={() =>
                            onViewStay?.(matchingBranch?.slug ?? stay.id)
                          }
                        >
                          View stay
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
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

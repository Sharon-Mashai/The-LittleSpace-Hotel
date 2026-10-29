import { useMemo, useState } from "react";
import heroImage from "./assets/hero.png";
import homeCapeTownImage from "./assets/cape-town.png";
import homeTzaneenImage from "./assets/tzaneen.png";
import homeJohannesburgImage from "./assets/johannesburg.png";
import searchCapeTownImage from "./assets/search-results/cape-town.png";
import searchTzaneenImage from "./assets/search-results/tzaneen.png";
import searchJohannesburgImage from "./assets/search-results/johannesburg.png";
import searchPretoriaImage from "./assets/search-results/pretoria.png";
import searchDurbanImage from "./assets/search-results/durban.png";
import searchPolokwaneImage from "./assets/search-results/polokwane.png";
import "./App.css";

type Page = "home" | "search";

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
    image: searchCapeTownImage,
    imageAlt: "Hotel accommodation in Cape Town",
    facilities: ["Wi-Fi", "Parking", "Breakfast"],
  },
  {
    id: "tzaneen",
    location: "Tzaneen",
    price: 2100,
    rating: 4.8,
    image: searchTzaneenImage,
    imageAlt: "Hotel accommodation in Tzaneen",
    facilities: ["Wi-Fi", "Swimming pool", "Breakfast"],
  },
  {
    id: "johannesburg",
    location: "Johannesburg",
    price: 1450,
    rating: 4.8,
    image: searchJohannesburgImage,
    imageAlt: "Hotel accommodation in Johannesburg",
    facilities: ["Wi-Fi", "Swimming pool", "Parking"],
  },
  {
    id: "pretoria",
    location: "Pretoria",
    price: 1650,
    rating: 4.8,
    image: searchPretoriaImage,
    imageAlt: "Hotel accommodation in Pretoria",
    facilities: ["Wi-Fi", "Swimming pool", "Parking", "Breakfast"],
  },
  {
    id: "durban",
    location: "Durban",
    price: 2350,
    rating: 4.8,
    image: searchDurbanImage,
    imageAlt: "Hotel accommodation in Durban",
    facilities: ["Wi-Fi", "Swimming pool", "Breakfast"],
  },
  {
    id: "polokwane",
    location: "Polokwane",
    price: 1250,
    rating: 4.8,
    image: searchPolokwaneImage,
    imageAlt: "Hotel accommodation in Polokwane",
    facilities: ["Wi-Fi", "Parking"],
  },
];

const facilityOptions = ["Wi-Fi", "Swimming pool", "Parking", "Breakfast"];

const homeStays = [
  {
    location: "Cape Town",
    image: homeCapeTownImage,
    description: "Discover a comfortable stay in the Mother City.",
  },
  {
    location: "Tzaneen",
    image: homeTzaneenImage,
    description: "Enjoy a relaxing escape surrounded by nature.",
  },
  {
    location: "Johannesburg",
    image: homeJohannesburgImage,
    description: "Find your space in the heart of the city.",
  },
];

function App() {
  const [page, setPage] = useState<Page>("home");
  const [searchTerm, setSearchTerm] = useState("");
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

  function openSearch() {
    setPage("search");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="site">
      <header className="site-header">
        <button
          className="brand"
          type="button"
          onClick={() => setPage("home")}
          aria-label="The LittleSpace Hotel home"
        >
          <span className="brand-name">The LittleSpace</span>
          <span className="brand-subtitle">HOTEL</span>
        </button>

        <nav className="main-nav" aria-label="Main navigation">
          <button type="button" onClick={() => setPage("home")}>
            Home
          </button>
          <button type="button" onClick={openSearch}>
            Find a stay
          </button>
        </nav>

        <button className="header-cta" type="button" onClick={openSearch}>
          Explore stays
        </button>
      </header>

      {page === "home" ? (
        <main>
          <section className="hero">
            <img
              className="hero-image"
              src={heroImage}
              alt="A welcoming, comfortable living space"
            />
            <div className="hero-overlay" />
            <div className="hero-content">
              <p className="eyebrow">WELCOME TO LITTLESPACE</p>
              <h1>Stay that feels like home.</h1>
              <p className="hero-description">
                Discover welcoming spaces and comfortable stays across South
                Africa.
              </p>
              <button className="primary-button" onClick={openSearch}>
                Explore our stays
              </button>
            </div>
          </section>

          <section className="stays-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">FIND YOUR SPACE</p>
                <h2>Discover our destinations</h2>
                <p>Wherever you are going, find a place to feel at home.</p>
              </div>
              <button
                className="text-button"
                type="button"
                onClick={openSearch}
              >
                View all destinations →
              </button>
            </div>

            <div className="home-stays-grid">
              {homeStays.map((stay) => (
                <button
                  className="home-stay-card"
                  type="button"
                  key={stay.location}
                  onClick={() => {
                    setSearchTerm(stay.location);
                    setPage("search");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <img src={stay.image} alt={`${stay.location} destination`} />
                  <span className="home-stay-info">
                    <strong>{stay.location}</strong>
                    <span>{stay.description}</span>
                    <span className="card-link">Explore stay →</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </main>
      ) : (
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
              {[
                "Cape Town",
                "Tzaneen",
                "Johannesburg",
                "Pretoria",
                "Durban",
                "Polokwane",
              ].map((location) => (
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
                  onChange={(event) =>
                    setMaximumPrice(Number(event.target.value))
                  }
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
                <button
                  className="text-button"
                  type="button"
                  onClick={() => setPage("home")}
                >
                  Back to home
                </button>
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
                            <strong>
                              R{stay.price.toLocaleString("en-ZA")}
                            </strong>
                            <span> / night</span>
                          </p>
                          <button
                            className="card-book-button"
                            type="button"
                            onClick={() => {
                              window.alert(
                                "Booking integration will be connected in a later step.",
                              );
                            }}
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
                  <p>
                    Try another city or clear some filters to see more stays.
                  </p>
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
      )}

      <footer className="site-footer">
        <div>
          <span className="footer-brand">The LittleSpace Hotel</span>
          <p>Stay that feels like home.</p>
        </div>
        <p>© {new Date().getFullYear()} The LittleSpace Hotel</p>
      </footer>
    </div>
  );
}

export default App;

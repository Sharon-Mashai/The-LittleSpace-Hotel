
import { useState, type FormEvent } from "react";

import heroImage from "../assets/hero.png";
import capeTownImage from "../assets/cape-town.png";
import tzaneenImage from "../assets/tzaneen.png";
import johannesburgImage from "../assets/johannesburg.png";

export type HomeSearchCriteria = {
  destination: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  rooms: number;
};

type HomePageProps = {
  onFindStay: (search?: HomeSearchCriteria | string) => void;
};

const homeStays = [
  {
    location: "Cape Town",
    image: capeTownImage,
    description: "Discover a comfortable stay in the Mother City.",
  },
  {
    location: "Tzaneen",
    image: tzaneenImage,
    description: "Enjoy a relaxing escape surrounded by nature.",
  },
  {
    location: "Johannesburg",
    image: johannesburgImage,
    description: "Find your space in the heart of the city.",
  },
];

function HomePage({ onFindStay }: HomePageProps) {
  const [destination, setDestination] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [rooms, setRooms] = useState(1);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (checkIn && checkOut && checkOut <= checkIn) {
      alert("Check-out must be after check-in.");
      return;
    }

    onFindStay({
      destination: destination.trim(),
      checkIn,
      checkOut,
      adults,
      children,
      rooms,
    });
  }

  return (
    <main>
      <div className="hero-search-wrapper">
        <section className="hero">
          <img
            className="hero-image"
            src={heroImage}
            alt="A welcoming, comfortable living space"
          />
          <div className="hero-overlay" />

          <div className="hero-content">
            <p className="eyebrow">THE LITTLESPACE HOTEL</p>
            <h1>Stay that feels like home.</h1>
            <p className="hero-description">
              Discover welcoming spaces and comfortable stays across South Africa.
            </p>

            <button
              className="primary-button"
              type="button"
              onClick={() => onFindStay()}
            >
              Explore our stays
            </button>
          </div>
        </section>

        <form className="hero-search-banner" onSubmit={handleSearch}>
          <div className="search-banner-heading">
            <p className="eyebrow">PLAN YOUR NEXT STAY</p>
            <h2>Find your perfect stay</h2>
          </div>

          <div className="search-banner-fields">
            <label className="search-field destination-field">
              <span>Destination</span>
              <input
                type="text"
                list="home-destinations"
                placeholder="Where are you going?"
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
              />
              <datalist id="home-destinations">
                <option value="Cape Town" />
                <option value="Tzaneen" />
                <option value="Johannesburg" />
                <option value="Pretoria" />
                <option value="Durban" />
                <option value="Polokwane" />
              </datalist>
            </label>

            <label className="search-field">
              <span>Check-in</span>
              <input
                type="date"
                value={checkIn}
                min={new Date().toLocaleDateString("en-CA")}
                onChange={(event) => setCheckIn(event.target.value)}
                required
              />
            </label>

            <label className="search-field">
              <span>Check-out</span>
              <input
                type="date"
                value={checkOut}
                min={checkIn || new Date().toLocaleDateString("en-CA")}
                onChange={(event) => setCheckOut(event.target.value)}
                required
              />
            </label>

            <label className="search-field">
              <span>Adults</span>
              <input
                type="number"
                min="1"
                max="20"
                value={adults}
                onChange={(event) =>
                  setAdults(Math.max(1, Number(event.target.value)))
                }
                required
              />
            </label>

            <label className="search-field">
              <span>Children</span>
              <input
                type="number"
                min="0"
                max="20"
                value={children}
                onChange={(event) =>
                  setChildren(Math.max(0, Number(event.target.value)))
                }
              />
            </label>

            <label className="search-field">
              <span>Rooms</span>
              <input
                type="number"
                min="1"
                max="10"
                value={rooms}
                onChange={(event) =>
                  setRooms(Math.max(1, Number(event.target.value)))
                }
                required
              />
            </label>

            <button className="primary-button search-banner-button" type="submit">
              Find stays
            </button>
          </div>
        </form>
      </div>

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
            onClick={() => onFindStay()}
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
              onClick={() => onFindStay(stay.location)}
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
  );
}

export default HomePage;

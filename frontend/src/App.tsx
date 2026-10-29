import heroImage from "./assets/hero.png";
import capeTownImage from "./assets/cape-town.png";
import tzaneenImage from "./assets/tzaneen.png";
import johannesburgImage from "./assets/johannesburg.png";
import "./App.css";

const stays = [
  {
    id: "cape-town",
    location: "Cape Town, Western Cape",
    rating: "4.8",
    price: "R1,850",
    image: capeTownImage,
    imageAlt: "Comfortable hotel bedroom overlooking the coast",
  },
  {
    id: "tzaneen",
    location: "Tzaneen, Limpopo",
    rating: "4.8",
    price: "R2,100",
    image: tzaneenImage,
    imageAlt: "Relaxing hotel lounge with a sea view",
  },
  {
    id: "johannesburg",
    location: "Johannesburg, Gauteng",
    rating: "4.8",
    price: "R1,450",
    image: johannesburgImage,
    imageAlt: "Luxury outdoor pool overlooking the ocean",
  },
];

function App() {
  return (
    <div className="site" id="home">
      <header className="site-header">
        <a className="brand" href="#home" aria-label="The LittleSpace home">
          <span className="brand-name">The LittleSpace</span>
          <span className="brand-tagline">STAY THAT FEELS LIKE HOME</span>
        </a>

        <nav className="main-nav" aria-label="Main navigation">
          <a className="nav-link active" href="#home">
            Home
          </a>
          <a className="nav-link" href="#stays">
            Hotels
          </a>
          <button
            className="nav-link nav-button"
            type="button"
            onClick={() =>
              window.alert("My Bookings will be connected in a later step.")
            }
          >
            My Bookings
          </button>
          <button
            className="sign-in-button"
            type="button"
            onClick={() =>
              window.alert("Sign In will be connected in a later step.")
            }
          >
            Sign In
          </button>
        </nav>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-heading">
          <img
            className="hero-image"
            src={heroImage}
            alt="Warm, inviting living room with comfortable seating"
          />

          <div className="hero-content">
            <p className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p>

            <h1 id="hero-heading">
              Find a stay
              <br />
              that feels like you.
            </h1>

            <p className="hero-description">
              Thoughtful places. Beautiful stays. More meaningful journeys.
            </p>

            <a className="primary-button" href="#stays">
              Explore stays
            </a>
          </div>
        </section>

        <section className="stays-section" id="stays">
          <h2>Find your kind of getaway</h2>

          <div className="stays-grid">
            {stays.map((stay) => (
              <article className="stay-card" key={stay.id}>
                <img
                  className="stay-image"
                  src={stay.image}
                  alt={stay.imageAlt}
                />

                <div className="stay-content">
                  <h3>The LittleSpace</h3>
                  <p className="stay-location">{stay.location}</p>

                  <p className="stay-rating">
                    <span aria-hidden="true">★</span> {stay.rating} · Excellent
                    reviews
                  </p>

                  <div className="stay-footer">
                    <p className="stay-price">{stay.price} / night</p>
                    <button
                      className="details-button"
                      type="button"
                      onClick={() =>
                        window.alert(
                          `${stay.location} details will be connected in a later step.`,
                        )
                      }
                    >
                      View details
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;

import heroImage from "../assets/hero.png";
import capeTownImage from "../assets/cape-town.png";
import tzaneenImage from "../assets/tzaneen.png";
import johannesburgImage from "../assets/johannesburg.png";

type HomePageProps = {
  onFindStay: (location?: string) => void;
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
  return (
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

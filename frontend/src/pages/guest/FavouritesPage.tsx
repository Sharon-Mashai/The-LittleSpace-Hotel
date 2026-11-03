import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getGuestFavourites, removeGuestFavourite, type GuestFavourite,} from "../../services/favourites";

function FavouritesPage() {
  const navigate = useNavigate();

  const [favourites, setFavourites] = useState<GuestFavourite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<number | null>(null);

  useEffect(() => {
    async function loadFavourites() {
      try {
        const data = await getGuestFavourites();
        setFavourites(data);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Unable to load your favourites.";

        setError(message);

        if (message.toLowerCase().includes("sign in")) {
          navigate("/sign-in");
        }
      } finally {
        setLoading(false);
      }
    }

    loadFavourites();
  }, [navigate]);

  async function handleRemoveFavourite(branchId: number) {
    setError("");
    setRemovingId(branchId);

    try {
      await removeGuestFavourite(branchId);

      setFavourites((current) =>
        current.filter((favourite) => favourite.branch_id !== branchId),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove this favourite. Please try again.",
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <main className="account-page">
      <section className="account-page-heading">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>My Favourites</h1>
        <p>Keep track of the LittleSpace stays you love.</p>
      </section>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <section className="empty-state">
          <p>Loading your favourites...</p>
        </section>
      ) : favourites.length === 0 ? (
        <section className="empty-state">
          <h2>No favourites yet</h2>
          <p>
            You haven't saved any stays yet. Explore our locations and save your
            favourite accommodation.
          </p>
          <Link className="primary-button" to="/hotels">
            Explore stays
          </Link>
        </section>
      ) : (
        <section className="favourites-list">
          {favourites.map((favourite) => (
            <article className="favourite-card" key={favourite.branch_id}>
              <div>
                <p className="eyebrow">LITTLESPACE HOTEL</p>
                <h2>{favourite.name}</h2>
                <p>
                  {favourite.city}
                  {favourite.province ? `, ${favourite.province}` : ""}
                </p>
                {favourite.address_line && <p>{favourite.address_line}</p>}
                {favourite.star_rating !== null && (
                  <p>Hotel rating: {favourite.star_rating} / 5</p>
                )}
              </div>

              <div className="favourite-card-actions">
                <Link
                  className="primary-button"
                  to={`/hotels/${favourite.slug}`}
                >
                  View stay
                </Link>

                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => handleRemoveFavourite(favourite.branch_id)}
                  disabled={removingId === favourite.branch_id}
                >
                  {removingId === favourite.branch_id
                    ? "Removing..."
                    : "Remove favourite"}
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

export default FavouritesPage;


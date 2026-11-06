import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getGuestFavourites,
  removeGuestFavourite,
  type GuestFavourite,
} from "../../services/favourites";
import ConfirmationModal from "../../components/ConfirmationModal";
import Toast from "../../components/Toast";

function FavouritesPage() {
  const navigate = useNavigate();

  const [favourites, setFavourites] = useState<GuestFavourite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<GuestFavourite | null>(
    null,
  );
  const [successMessage, setSuccessMessage] = useState("");

  const dismissSuccessToast = useCallback(() => setSuccessMessage(""), []);

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

      setPendingRemoval(null);
      setSuccessMessage("Favourite removed.");
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
        <h1>My Favourites</h1>
        <p>Keep track of the LittleSpace stays you love.</p>
      </section>

      {error && !pendingRemoval && (
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
                  <p>
                    Hotel rating: {Number(favourite.star_rating).toFixed(1)} /
                    5.0
                  </p>
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
                  onClick={() => {
                    setError("");
                    setPendingRemoval(favourite);
                  }}
                  disabled={removingId === favourite.branch_id}
                >
                  Remove favourite
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {pendingRemoval && (
        <ConfirmationModal
          title="Remove this favourite?"
          message={`Remove ${pendingRemoval.name} from your favourites?`}
          confirmText="Remove favourite"
          icon="!"
          variant="danger"
          isBusy={removingId === pendingRemoval.branch_id}
          error={error}
          busyText="Removing..."
          onCancel={() => {
            setPendingRemoval(null);
            setError("");
          }}
          onConfirm={() => void handleRemoveFavourite(pendingRemoval.branch_id)}
        />
      )}

      <Toast message={successMessage} onDismiss={dismissSuccessToast} />
    </main>
  );
}

export default FavouritesPage;

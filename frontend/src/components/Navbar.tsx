import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { getLoggedInGuest, logoutGuest } from "../services/auth";

function Navbar() {
 
  useLocation();

  const navigate = useNavigate();
  const guest = getLoggedInGuest();

  const initials = guest?.full_name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function handleSignOut() {
    logoutGuest();
    navigate("/");
  }

  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label="The LittleSpace Hotel home">
        <span className="brand-name">The LittleSpace</span>
        <span className="brand-subtitle">HOTEL</span>
      </Link>

      <nav className="main-nav" aria-label="Main navigation">
        <NavLink to="/" end> Home </NavLink>

        <NavLink to="/hotels">Hotels</NavLink>

        <NavLink to="/my-bookings">My Bookings</NavLink>

        {guest ? (
          <>
            <NavLink to="/profile/favourites">Favourites</NavLink>

            <NavLink to="/profile"className="profile-avatar-link"
              aria-label={`My profile, ${guest.full_name}`}
              title="My Profile"
            >
              <span className="profile-avatar">{initials}</span>
            </NavLink>

            <button type="button" className="nav-logout" onClick={handleSignOut}>
              Sign Out
            </button>
          </>
        ) : (
          <NavLink to="/sign-in">Sign In</NavLink>
        )}
      </nav>
    </header>
  );
}

export default Navbar;

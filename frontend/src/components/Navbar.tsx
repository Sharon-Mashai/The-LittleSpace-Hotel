import { Link, NavLink } from "react-router-dom";

function Navbar() {
  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label="The LittleSpace Hotel home">
        <span className="brand-name">The LittleSpace</span>
        <span className="brand-subtitle">HOTEL</span>
      </Link>

      <nav className="main-nav" aria-label="Main navigation">
        <NavLink to="/" end>
          Home
        </NavLink>

        <NavLink to="/hotels">Hotels</NavLink>

        <NavLink to="/my-bookings">My Bookings</NavLink>

        <NavLink to="/sign-in">Sign In</NavLink>
      </nav>
    </header>
  );
}

export default Navbar;

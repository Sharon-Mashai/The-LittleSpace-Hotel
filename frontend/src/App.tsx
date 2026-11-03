import { useLocation, useNavigate, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import HomePage, { type HomeSearchCriteria } from "./pages/guest/HomePage";
import HotelsPage from "./pages/guest/HotelsPage";
import MyBookingsPage from "./pages/guest/MyBookingsPage";
import SignInPage from "./pages/guest/SignInPage";
import RegisterPage from "./pages/guest/RegisterPage";
import ProfilePage from "./pages/guest/ProfilePage";
import FavouritesPage from "./pages/guest/FavouritesPage";
import SettingsPage from "./pages/guest/SettingsPage";
import ForgotPasswordPage from "./pages/guest/ForgotPasswordPage";
import HotelDetailsPage from "./pages/guest/HotelDetailsPage";
import BookingConfirmationPage from "./pages/guest/BookingConfirmationPage";
import PaymentConfirmationPage from "./pages/guest/PaymentConfirmationPage";
import NotFoundPage from "./pages/NotFoundPage";
import "./App.css";

function HotelsRoute() {
  const location = useLocation();
  const navigate = useNavigate();

  const routeState = location.state as {
    location?: string;
    searchCriteria?: HomeSearchCriteria;
  } | null;

  const initialLocation = routeState?.location ?? "";
  const initialSearchCriteria = routeState?.searchCriteria;

  return (
    <HotelsPage
      initialLocation={initialLocation}
      initialSearchCriteria={initialSearchCriteria}
      onViewStay={(stayId) => navigate(`/hotels/${stayId}`)}
    />
  );
}

function App() {
  const navigate = useNavigate();

  function handleFindStay(search?: HomeSearchCriteria | string) {
    if (typeof search === "string") {
      navigate("/hotels", {
        state: search ? { location: search } : null,
      });
    } else if (search) {
      navigate("/hotels", {
        state: {
          location: search.destination,
          searchCriteria: search,
        },
      });
    } else {
      navigate("/hotels");
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="site">
      <Navbar />

      <Routes>
        <Route path="/" element={<HomePage onFindStay={handleFindStay} />} />
        <Route path="/hotels" element={<HotelsRoute />} />
        <Route path="/hotels/:hotelId" element={<HotelDetailsPage />} />
        <Route path="/my-bookings" element={<MyBookingsPage />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/favourites" element={<FavouritesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/booking-confirmation" element={<BookingConfirmationPage />} />
        <Route path="/payment-confirmation" element={<PaymentConfirmationPage />}/>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      <Footer />
    </div>
  );
}

export default App;

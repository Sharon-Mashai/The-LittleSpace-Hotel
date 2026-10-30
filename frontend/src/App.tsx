import { useLocation, useNavigate, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import HomePage from "./pages/HomePage";
import HotelsPage from "./pages/HotelsPage";
import MyBookingsPage from "./pages/MyBookingsPage";
import SignInPage from "./pages/SignInPage";
import RegisterPage from "./pages/RegisterPage";
import ProfilePage from "./pages/ProfilePage";
import SettingsPage from "./pages/SettingsPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import HotelDetailsPage from "./pages/HotelDetailsPage";
import BookingConfirmationPage from "./pages/BookingConfirmationPage";
import PaymentConfirmationPage from "./pages/PaymentConfirmationPage";
import NotFoundPage from "./pages/NotFoundPage";
import "./App.css";

function HotelsRoute() {
  const location = useLocation();
  const navigate = useNavigate();

  const initialLocation =
    (location.state as { location?: string } | null)?.location ?? "";

  return (
    <HotelsPage
      initialLocation={initialLocation}
      onViewStay={(stayId) => navigate(`/hotels/${stayId}`)}
    />
  );
}

function App() {
  const navigate = useNavigate();

  function handleFindStay(location?: string) {
    navigate("/hotels", {
      state: location ? { location } : null,
    });

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

        <Route path="/settings" element={<SettingsPage />} />

        <Route path="/forgot-password" element={<ForgotPasswordPage />} />

        <Route
          path="/booking-confirmation"
          element={<BookingConfirmationPage />}
        />

        <Route
          path="/payment-confirmation"
          element={<PaymentConfirmationPage />}
        />

        <Route path="*" element={<NotFoundPage />} />
      </Routes>

      <Footer />
    </div>
  );
}

export default App;

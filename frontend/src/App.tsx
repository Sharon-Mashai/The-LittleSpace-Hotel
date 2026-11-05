import { useLocation, useNavigate, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import PermissionRoute from "./components/PermissionRoute";
import AdminLayout from "./components/AdminLayout";
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
import AdminDashboardPage from "./pages/Admin/AdminDashboardPage";
import BookingsPage from "./pages/Admin/BookingsPage";
import AdminGuestsPage from "./pages/Admin/AdminGuestsPage";
import AdminBranchesPage from "./pages/Admin/AdminBranchesPage";
import AdminRoomTypesPage from "./pages/Admin/AdminRoomTypesPage";
import SuperAdminDashboardPage from "./pages/super-admin/SuperAdminDashboardPage";
import AdministratorsPage from "./pages/super-admin/AdministratorsPage";
import NotFoundPage from "./pages/NotFoundPage";
import ResetPasswordPage from "./pages/guest/ResetPasswordPage";
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

type GuestLayoutProps = {
  onFindStay: (search?: HomeSearchCriteria | string) => void;
};

function GuestLayout({ onFindStay }: GuestLayoutProps) {
  const { pathname } = useLocation();
  const isAuthPage = pathname === "/sign-in" || pathname === "/register";

  return (
    <div className={`site${isAuthPage ? " auth-page-layout" : ""}`}>
      <Navbar />

      <Routes>
        <Route path="/" element={<HomePage onFindStay={onFindStay} />} />
        <Route path="/hotels" element={<HotelsRoute />} />
        <Route path="/hotels/:hotelId" element={<HotelDetailsPage />} />
        <Route path="/my-bookings" element={<MyBookingsPage />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/favourites" element={<FavouritesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route
          path="/booking-confirmation"
          element={<BookingConfirmationPage />}
        />
        <Route
          path="/payment-confirmation"
          element={<PaymentConfirmationPage />}
        />
      </Routes>

      <Footer />
    </div>
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
    <Routes>
      {/* Guest website routes */}
      <Route path="/*" element={<GuestLayout onFindStay={handleFindStay} />} />

      {/* Admin routes */}
      <Route
        element={<ProtectedRoute allowedRoles={["admin", "super_admin"]} />}
      >
        <Route element={<AdminLayout />}>
          <Route
            element={<PermissionRoute requiredPermission="dashboard.view" />}
          >
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
          </Route>

          <Route
            element={<PermissionRoute requiredPermission="bookings.view" />}
          >
            <Route path="/admin/bookings" element={<BookingsPage />} />
          </Route>

          <Route element={<PermissionRoute requiredPermission="guests.view" />}>
            <Route path="/admin/guests" element={<AdminGuestsPage />} />
          </Route>

          <Route
            element={<PermissionRoute requiredPermission="branches.view" />}
          >
            <Route path="/admin/branches" element={<AdminBranchesPage />} />
          </Route>

          <Route
            element={<PermissionRoute requiredPermission="room_types.view" />}
          >
            <Route path="/admin/room-types" element={<AdminRoomTypesPage />} />
          </Route>
        </Route>
      </Route>

      {/* Super Admin-only routes */}
      <Route element={<ProtectedRoute allowedRoles={["super_admin"]} />}>
        <Route element={<AdminLayout />}>
          <Route
            path="/super-admin/dashboard"
            element={<SuperAdminDashboardPage />}
          />

          <Route
            path="/super-admin/administrators"
            element={<AdministratorsPage />}
          />
        </Route>
      </Route>

      {/* Unknown routes */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;

import { Link } from "react-router-dom";
import { useAppSelector } from "../../app/hooks";

function AdminDashboardPage() {
  const user = useAppSelector((state) => state.auth.user);

  const dashboardSections = [
    {
      number: "01",
      eyebrow: "RESERVATION MANAGEMENT",
      title: "Bookings",
      description: "View and manage guest bookings.",
      link: "/admin/bookings",
    },
    {
      number: "02",
      eyebrow: "GUEST MANAGEMENT",
      title: "Guests",
      description: "View guest records and information.",
      link: "/admin/guests",
    },
    {
      number: "03",
      eyebrow: "HOTEL LOCATIONS",
      title: "Branches",
      description: "Manage LittleSpace Hotel branches.",
      link: "/admin/branches",
    },
    {
      number: "04",
      eyebrow: "ACCOMMODATION",
      title: "Room Types",
      description: "Manage available room types.",
      link: "/admin/room-types",
    },
  ];

  return (
    <div className="hotel-admin-dashboard">
      <div className="hotel-admin-dashboard-heading">
        <div>
          <span className="admin-page-eyebrow">
            LITTLESPACE HOTEL MANAGEMENT
          </span>

          <h1>Admin Dashboard</h1>

          <p>
            Welcome back, {user?.full_name ?? "Admin"}. Manage LittleSpace Hotel
            operations from here.
          </p>
        </div>

        <span className="hotel-admin-role-label">Admin Portal</span>
      </div>

      <div className="hotel-admin-dashboard-intro">
        <h2>Hotel Operations</h2>
        <p>
          Select an area below to manage the day-to-day operations of
          LittleSpace Hotel.
        </p>
      </div>

      <div className="hotel-admin-dashboard-grid">
        {dashboardSections.map((section) => (
          <Link
            key={section.number}
            to={section.link}
            className="hotel-admin-dashboard-card"
          >
            <div className="hotel-admin-card-top">
              <span className="hotel-admin-card-number">{section.number}</span>

              <span className="hotel-admin-card-arrow" aria-hidden="true">
                →
              </span>
            </div>

            <div className="hotel-admin-card-content">
              <span className="hotel-admin-card-eyebrow">
                {section.eyebrow}
              </span>

              <h2>{section.title}</h2>

              <p>{section.description}</p>
            </div>

            <span className="hotel-admin-card-link">
              Open section <span aria-hidden="true">→</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="hotel-admin-dashboard-note">
        <span className="hotel-admin-note-icon">i</span>
        <p>
          Your access to hotel operations depends on the permissions assigned to
          your administrator account.
        </p>
      </div>
    </div>
  );
}

export default AdminDashboardPage;

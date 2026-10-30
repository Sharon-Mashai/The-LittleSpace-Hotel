import { Link } from "react-router-dom";

function NotFoundPage() {
  return (
    <main className="account-page">
      <section className="empty-state">
        <p className="eyebrow">404 ERROR</p>
        <h1>Oops! Page not found.</h1>
        <p>The page you're looking for doesn't exist or may have been moved.</p>

        <Link className="primary-button" to="/">
          Back to Home
        </Link>
      </section>
    </main>
  );
}

export default NotFoundPage;

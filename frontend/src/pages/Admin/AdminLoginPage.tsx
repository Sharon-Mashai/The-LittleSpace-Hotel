import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { loginAdmin } from "../../services/adminAuth";

function AdminLoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await loginAdmin(email.trim(), password);
      navigate("/admin/dashboard");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="account-page">
      <section className="auth-card">
        <p className="eyebrow">LITTLESPACE MANAGEMENT</p>

        <h1>Administrator Sign In</h1>

        <p>Sign in to manage hotel operations.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="admin-email">Email address</label>

          <input
            id="admin-email"
            type="email"
            placeholder="Enter your administrator email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="admin-password">Password</label>

          <input
            id="admin-password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="auth-guest">
          This area is restricted to authorised LittleSpace administrators.
        </p>
      </section>
    </main>
  );
}

export default AdminLoginPage;

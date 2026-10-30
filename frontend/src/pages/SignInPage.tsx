import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginGuest } from "../services/auth";

function SignInPage() {
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
      await loginGuest(email, password);
      navigate("/profile");
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
        <p className="eyebrow">WELCOME BACK</p>
        <h1>Sign in to LittleSpace</h1>
        <p>Access your account and manage your stays.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="signin-email">Email address</label>
          <input
            id="signin-email"
            type="email"
            placeholder="Enter your email address"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="signin-password">Password</label>
          <input
            id="signin-password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <div className="auth-links">
            <Link to="/forgot-password">Forgot password?</Link>
          </div>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="auth-switch">
          Don't have an account? <Link to="/register">Create an account</Link>
        </p>

        <p className="auth-guest">
          You can also continue as a guest when making a booking.
        </p>
      </section>
    </main>
  );
}

export default SignInPage;

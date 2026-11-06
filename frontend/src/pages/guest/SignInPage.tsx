import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";

import { useAppDispatch } from "../../app/hooks";
import { setAuthenticatedUser } from "../../features/auth/authSlice";
import { loginUser, loginWithGoogle } from "../../services/auth";
import PasswordInput from "../../components/PasswordInput";

function SignInPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const user = await loginUser(email, password);

      // Update the shared Redux authentication state.
      dispatch(setAuthenticatedUser(user));

      switch (user.role) {
        case "guest":
          navigate("/");
          break;

        case "admin":
          navigate("/admin/dashboard");
          break;

        case "super_admin":
          navigate("/super-admin/dashboard");
          break;

        default:
          setError("Your account has an unsupported role.");
          break;
      }
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

  async function handleGoogleSuccess(credentialResponse: CredentialResponse) {
    setError("");

    if (!credentialResponse.credential) {
      setError("Google did not return an ID token. Please try again.");
      return;
    }

    setGoogleLoading(true);

    try {
      // Send the Google ID token to the LittleSpace backend.
      const user = await loginWithGoogle(credentialResponse.credential);

      // Google sign-in is only available for guest accounts.
      if (user.role !== "guest") {
        setError("Google sign-in is only available for guest accounts.");
        return;
      }

      // Save the user in the shared Redux authentication state.
      dispatch(setAuthenticatedUser(user));

      // Redirect the guest to the homepage.
      navigate("/");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to sign in with Google. Please try again.",
      );
    } finally {
      setGoogleLoading(false);
    }
  }

  function handleGoogleError() {
    setError("Google sign-in was unsuccessful. Please try again.");
    setGoogleLoading(false);
  }

  return (
    <main className="account-page auth-screen">
      <section className="auth-card">
        <p className="eyebrow">WELCOME BACK</p>
        <h1>Sign in to The LittleSpace</h1>
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
          <PasswordInput
            id="signin-password"
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

          <button
            className="primary-button"
            type="submit"
            disabled={loading || googleLoading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="auth-google-section">
          <div className="auth-google-divider">
            <span>OR</span>
          </div>

          <div className="auth-google-button">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="outline"
              size="large"
              shape="rectangular"
              text="signin_with"
              width="320"
            />
          </div>

          {googleLoading && (
            <p className="auth-google-status" role="status">
              Signing in with Google...
            </p>
          )}
        </div>

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

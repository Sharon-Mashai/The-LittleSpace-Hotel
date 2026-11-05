import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { resetGuestPassword } from "../../services/auth";
import PasswordInput from "../../components/PasswordInput";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!token) {
      setError("This password reset link is invalid or missing its token.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Your password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    try {
      const response = await resetGuestPassword(token, password);

      setMessage(response.message);
      setPassword("");
      setConfirmPassword("");

      setTimeout(() => {
        navigate("/sign-in");
      }, 2000);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to reset your password. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="account-page">
      <section className="auth-card">
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h1>Reset your password</h1>
        <p>Enter your new password below to regain access to your account.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="new-password">New password</label>

          <PasswordInput
            id="new-password"
            placeholder="Enter your new password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            disabled={loading}
          />

          <label htmlFor="confirm-password">Confirm new password</label>
          <PasswordInput
            id="confirm-password"
            placeholder="Confirm your new password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
            minLength={8}
            disabled={loading}
          />

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          {message && (
            <p className="auth-success" role="status">
              {message}
            </p>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={loading || !token}
          >
            {loading ? "Resetting Password..." : "Reset Password"}
          </button>
        </form>

        <p className="auth-switch">
          Remember your password? <Link to="/sign-in">Back to Sign In</Link>
        </p>
      </section>
    </main>
  );
}

export default ResetPasswordPage;

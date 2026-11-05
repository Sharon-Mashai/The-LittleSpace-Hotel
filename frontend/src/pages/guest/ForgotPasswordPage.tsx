import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../../services/auth";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setError("");
    setLoading(true);

    try {
      const response = await requestPasswordReset(email.trim());

      setMessage(response.message);
      setEmail("");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to process your request. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="account-page">
      <section className="auth-card">
        <p className="eyebrow">ACCOUNT RECOVERY</p>
        <h1>Forgot your password?</h1>
        <p>
          Enter the email address associated with your account. We'll help you
          reset your password.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="reset-email">Email address</label>
          <input
            id="reset-email"
            type="email"
            placeholder="Enter your email address"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={loading}
          />

          {message && (
            <p className="auth-success" role="status">
              {message}
            </p>
          )}

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Sending..." : "Request Password Reset"}
          </button>
        </form>

        <p className="auth-switch">
          Remember your password? <Link to="/sign-in">Back to Sign In</Link>
        </p>
      </section>
    </main>
  );
}

export default ForgotPasswordPage;

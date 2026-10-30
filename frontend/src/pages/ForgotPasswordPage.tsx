import { Link } from "react-router-dom";

function ForgotPasswordPage() {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Password reset will be connected to the backend later.
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
            required
          />

          <button className="primary-button" type="submit">
            Request Password Reset
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

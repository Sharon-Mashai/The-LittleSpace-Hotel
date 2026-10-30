import { Link } from "react-router-dom";

function SignInPage() {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

  
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
            required
          />

          <label htmlFor="signin-password">Password</label>
          <input
            id="signin-password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          <div className="auth-links">
            <Link to="/forgot-password">Forgot password?</Link>
          </div>

          <button className="primary-button" type="submit">
            Sign In
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

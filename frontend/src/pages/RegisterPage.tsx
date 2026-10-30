import { Link } from "react-router-dom";

function RegisterPage() {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

   
  }

  return (
    <main className="account-page">
      <section className="auth-card">
        <p className="eyebrow">JOIN LITTLESPACE</p>
        <h1>Create your account</h1>
        <p>Register to manage your bookings and account details.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="register-name">Full name</label>
          <input
            id="register-name"
            type="text"
            placeholder="Enter your full name"
            autoComplete="name"
            required
          />

          <label htmlFor="register-email">Email address</label>
          <input
            id="register-email"
            type="email"
            placeholder="Enter your email address"
            autoComplete="email"
            required
          />

          <label htmlFor="register-phone">Phone number</label>
          <input
            id="register-phone"
            type="tel"
            placeholder="Enter your phone number"
            autoComplete="tel"
            required
          />

          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            type="password"
            placeholder="Create a password"
            autoComplete="new-password"
            minLength={8}
            required
          />

          <label htmlFor="register-confirm-password">Confirm password</label>
          <input
            id="register-confirm-password"
            type="password"
            placeholder="Confirm your password"
            autoComplete="new-password"
            minLength={8}
            required
          />

          <button className="primary-button" type="submit">
            Create Account
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/sign-in">Sign In</Link>
        </p>

        <p className="auth-guest">
          Prefer not to register? You can still book as a guest.
        </p>
      </section>
    </main>
  );
}

export default RegisterPage;

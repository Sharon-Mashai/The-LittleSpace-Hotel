import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch } from "../../app/hooks";
import { setAuthenticatedUser } from "../../features/auth/authSlice";
import { registerGuest } from "../../services/auth";
import PasswordInput from "../../components/PasswordInput";

function RegisterPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const user = await registerGuest(fullName, email, password, phone);

      // Update the shared Redux authentication state.
      dispatch(setAuthenticatedUser(user));

      navigate("/");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Registration failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="account-page auth-screen">
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
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />

          <label htmlFor="register-email">Email address</label>
          <input
            id="register-email"
            type="email"
            placeholder="Enter your email address"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="register-phone">Phone number</label>
          <input
            id="register-phone"
            type="tel"
            placeholder="Enter your phone number"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />

          <label htmlFor="register-password">Password</label>
          <PasswordInput
            id="register-password"
            placeholder="Create a password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <label htmlFor="register-confirm-password">Confirm password</label>
          <PasswordInput
            id="register-confirm-password"
            placeholder="Confirm your password"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            required
          />

          {error && <p role="alert">{error}</p>}

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create Account"}
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

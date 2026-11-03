import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  getGuestProfile,
  updateGuestProfile,
  type GuestProfile,
} from "../../services/profile";

function ProfilePage() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState<GuestProfile | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await getGuestProfile();

        setProfile(data);
        setFullName(data.full_name);
        setEmail(data.email);
        setPhone(data.phone ?? "");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to load your profile.";

        setError(message);

        if (message.toLowerCase().includes("sign in")) {
          navigate("/sign-in");
        }
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [navigate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const updatedProfile = await updateGuestProfile(fullName, phone);

      setProfile(updatedProfile);
      setFullName(updatedProfile.full_name);
      setEmail(updatedProfile.email);
      setPhone(updatedProfile.phone ?? "");
      setSuccess("Your profile has been updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update your profile. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="account-page">
        <section className="auth-card">
          <p>Loading your profile...</p>
        </section>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="account-page">
        <section className="auth-card">
          <p className="auth-error" role="alert">
            {error || "Your profile could not be loaded."}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="account-page">
      <section className="auth-card">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>My Profile</h1>
        <p>View and manage your personal information.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="profile-name">Full name</label>
          <input
            id="profile-name"
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            minLength={2}
            maxLength={150}
            required
          />

          <label htmlFor="profile-email">Email address</label>
          <input
            id="profile-email"
            type="email"
            value={email}
            autoComplete="email"
            readOnly
          />

          <label htmlFor="profile-phone">Phone number</label>
          <input
            id="profile-phone"
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
          />

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          {success && <p role="status">{success}</p>}

          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? "Saving changes..." : "Save Changes"}
          </button>
        </form>

        <p>
          **Member since:** {new Date(profile.created_at).toLocaleDateString()}
        </p>
      </section>
    </main>
  );
}

export default ProfilePage;


import PasswordInput from "../../components/PasswordInput";

function SettingsPage() {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

  }

  return (
    <main className="account-page">
      <section className="auth-card">
        <p className="eyebrow">YOUR ACCOUNT</p>
        <h1>Settings</h1>
        <p>Manage your account preferences and security.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Notification preferences</h2>

          <label className="filter-option">
            <input type="checkbox" defaultChecked />
            <span>Booking updates</span>
          </label>

          <label className="filter-option">
            <input type="checkbox" defaultChecked />
            <span>Payment updates</span>
          </label>

          <label className="filter-option">
            <input type="checkbox" />
            <span>Promotional offers</span>
          </label>

          <h2>Security</h2>

          <label htmlFor="current-password">Current password</label>
          <PasswordInput
            id="current-password"
            autoComplete="current-password"
            placeholder="Enter current password"
          />

          <label htmlFor="new-password">New password</label>
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            placeholder="Enter new password"
            minLength={8}
          />

          <button className="primary-button" type="submit">
            Save Settings
          </button>
        </form>
      </section>
    </main>
  );
}

export default SettingsPage;

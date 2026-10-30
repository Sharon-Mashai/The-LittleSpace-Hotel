
function ProfilePage() {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

   
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
            placeholder="Enter your full name"
            autoComplete="name"
            required
          />

          <label htmlFor="profile-email">Email address</label>
          <input
            id="profile-email"
            type="email"
            placeholder="Enter your email address"
            autoComplete="email"
            required
          />

          <label htmlFor="profile-phone">Phone number</label>
          <input
            id="profile-phone"
            type="tel"
            placeholder="Enter your phone number"
            autoComplete="tel"
            required
          />

          <button className="primary-button" type="submit">
            Save Changes
          </button>
        </form>
      </section>
    </main>
  );
}

export default ProfilePage;

function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <span className="footer-brand">The LittleSpace Hotel</span>
        <p>Stay that feels like home.</p>
      </div>

      <p>© {new Date().getFullYear()} The LittleSpace Hotel</p>
    </footer>
  );
}

export default Footer;

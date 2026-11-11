// PlaceholderPage: a simple "Page not found" page, used in App.jsx for unknown admin addresses.

import './PlaceholderPage.css';

function PlaceholderPage({ title }) {
  return (
    <div>
      <h1 className="placeholder_page_title">{title}</h1>
      <p className="placeholder_page_text">This page is not built yet.</p>
    </div>
  );
}

export default PlaceholderPage;

// PageStatus: the loading and error message shown instead of a page, used by the admin and POS pages.

import Button from './Button.jsx';
import './PageStatus.css';

// Shown instead of a page's content while it loads, or if loading failed
function PageStatus({ loading, error, onRetry }) {
  if (loading) {
    return (
      <div className="page_status" role="status">
        <span className="loading_spinner" />
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="page_status" role="alert">
      <p className="page_status_error">Something went wrong: {error}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export default PageStatus;

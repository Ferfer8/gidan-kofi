// PageHeader: the page title with an optional subtitle and action buttons, used at the top of most admin pages.

import './PageHeader.css';

function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page_header">
      <div>
        <h1 className="page_title">{title}</h1>
        {subtitle && <p className="page_subtitle">{subtitle}</p>}
      </div>
      {children && <div className="page_actions">{children}</div>}
    </div>
  );
}

export default PageHeader;

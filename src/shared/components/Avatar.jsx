// Avatar: a round avatar with the first letter of a name, used by the admin sidebar, Dashboard and Staff pages.

import './Avatar.css';

function Avatar({ name, variant = 'light' }) {
  return <span className={`avatar avatar_${variant}`}>{name.charAt(0).toUpperCase()}</span>;
}

export default Avatar;

// Toast: a small message that appears on the screen, used across the admin panel and the POS.

import Icon from './Icon.jsx';
import './Toast.css';

// Small message at the bottom of the screen. Render it only while it should show.
// corner puts it in the bottom right corner; type="error" gives it the red error style.
// type="success" is the green "done" card (top right) with a tick, a bold title and the message under it.
function Toast({ message, title, type = 'info', corner = false }) {
  if (type === 'success') {
    return (
      <div className="toast_success" role="status">
        <span className="toast_success_icon">
          <Icon name="check" size={20} />
        </span>
        <div>
          {title && <p className="toast_success_title">{title}</p>}
          <p className="toast_success_message">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`toast ${type === 'error' ? 'toast_error' : ''} ${corner ? 'toast_corner' : ''}`} role={type === 'error' ? 'alert' : 'status'}>
      {message}
    </div>
  );
}

export default Toast;

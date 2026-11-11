// ImageUpload: the image box with the Upload, Change and Remove buttons, used by the menu item window
// (MenuItemModal).

import { useState, useRef } from 'react';
import Button from '../../shared/components/Button.jsx';
import Icon from '../../shared/components/Icon.jsx';
import './ImageUpload.css';

// Image box with "Upload image" / "Change image" and "Remove image" buttons. Files can also be
// dropped onto the box. It only reports the chosen file (onFileSelected); the parent checks
// and prepares it.
function ImageUpload({ imageUrl, onFileSelected, onAdjustCrop, onRemove, busy = false, error = '' }) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !busy) onFileSelected(file);
  }

  function handleInputChange(event) {
    const file = event.target.files[0];
    if (file) onFileSelected(file);
    event.target.value = ''; // lets the same file be picked again
  }

  return (
    <div className="image_upload_wrap">
      <div
        className={`image_upload ${isDragging ? 'active' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="Menu item" className="image_upload_preview" />
        ) : (
          <div className="image_upload_empty">
            <Icon name="image" size={32} />
            <span>{isDragging ? 'Drop to use this image' : 'Drag an image here'}</span>
          </div>
        )}
        {busy && <div className="image_upload_busy">Preparing image…</div>}
      </div>

      <div className="image_upload_buttons">
        {imageUrl && (
          <Button variant="secondary" className="button_small" disabled={busy} onClick={onAdjustCrop}>
            Adjust crop
          </Button>
        )}
        <Button variant="secondary" className="button_small" disabled={busy} onClick={() => inputRef.current.click()}>
          {imageUrl ? 'Change image' : 'Upload image'}
        </Button>
        {imageUrl && (
          <Button variant="ghost" className="button_small delete_text" disabled={busy} onClick={onRemove}>
            Remove image
          </Button>
        )}
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handleInputChange} />
      </div>

      <p className="field_hint">JPG, PNG or WebP. Choosing an image opens the cropper.</p>
      {error && <p className="field_error">{error}</p>}
    </div>
  );
}

export default ImageUpload;

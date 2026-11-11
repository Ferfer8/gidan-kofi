// ImageCropper: a pop-up to drag and zoom a photo into the 16:9 menu card shape, used by the menu item window
// (MenuItemModal).

import { useState } from 'react';
import Cropper from 'react-easy-crop';
import Modal from '../../shared/components/Modal.jsx';
import Button from '../../shared/components/Button.jsx';
import MenuItemCard from '../../shared/components/MenuItemCard.jsx';
import { cropToWebp, getPreviewStyle } from '../../shared/lib/cropImage.js';
import './ImageCropper.css';

const noop = () => {};

// Lets you drag and zoom a photo inside a 16:9 frame (the shape of the menu card image), with
// a live preview of the card. Nothing is uploaded here: onApply gets the cropped image.
//   imageUrl:    the photo to crop (a blob: or normal link)
//   initialCrop: a crop saved earlier { x, y, width, height, zoom } (percentages), or null
//   item:        { name, price, description, sizes, allergens } for the preview card
//   onApply({ blob, crop })   onCancel()
function ImageCropper({ imageUrl, initialCrop, item, onApply, onCancel }) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(initialCrop?.zoom ?? 1);
  const [areaPercent, setAreaPercent] = useState(null);
  const [areaPixels, setAreaPixels] = useState(null);
  const [mediaSize, setMediaSize] = useState(null);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  function handleReset() {
    setPosition({ x: 0, y: 0 });
    setZoom(1);
  }

  async function handleApply() {
    if (!areaPixels) return;
    setApplying(true);
    setError('');
    try {
      const blob = await cropToWebp(imageUrl, areaPixels);
      onApply({ blob, crop: { ...areaPercent, zoom } });
    } catch (applyError) {
      setError(applyError.message);
      setApplying(false);
    }
  }

  const previewItem = { ...item, image: null, onMenu: true };

  return (
    <Modal
      isOpen
      className="modal_crop"
      title="Crop image"
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" disabled={applying} onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={applying || !areaPixels} onClick={handleApply}>
            {applying ? 'Applying…' : 'Apply crop'}
          </Button>
        </>
      }
    >
      <div className="image_cropper">
        <div className="crop_editor">
          <div className="crop_area">
            <Cropper
              image={imageUrl}
              crop={position}
              zoom={zoom}
              aspect={16 / 9}
              minZoom={1}
              maxZoom={3}
              objectFit="cover"
              initialCroppedAreaPercentages={initialCrop ?? undefined}
              onCropChange={setPosition}
              onZoomChange={setZoom}
              onMediaLoaded={setMediaSize}
              onCropAreaChange={(percent, pixels) => {
                setAreaPercent(percent);
                setAreaPixels(pixels);
              }}
              onCropComplete={(percent, pixels) => {
                setAreaPercent(percent);
                setAreaPixels(pixels);
              }}
            />
          </div>

          <div className="crop_controls">
            <label className="crop_zoom" htmlFor="crop_zoom_slider">
              <span>Zoom</span>
              <input
                id="crop_zoom_slider"
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(event) => setZoom(Number(event.target.value))}
              />
              <span className="crop_zoom_value">{zoom.toFixed(1)}×</span>
            </label>
            <button type="button" className="link_button" onClick={handleReset}>
              Reset
            </button>
          </div>
          <p className="field_hint">Drag the photo to move it. Zoom with the slider, scrolling or pinching.</p>
          {error && <p className="field_error">{error}</p>}
        </div>

        <div className="crop_preview_column">
          <p className="form_label">How it will look on the menu</p>
          <div className="crop_preview" aria-hidden="true">
            <MenuItemCard
              item={previewItem}
              onToggle={noop}
              onEdit={noop}
              imageContent={
                <img src={imageUrl} alt="" className="crop_preview_media" style={getPreviewStyle(areaPixels, mediaSize)} />
              }
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default ImageCropper;

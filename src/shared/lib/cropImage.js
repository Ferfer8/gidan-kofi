// cropImage.js: helpers to crop a menu image to the 16:9 card shape and save it as WebP, used by the image
// cropper.

// The size of the saved, cropped image (16:9)
export const CROP_WIDTH = 1200;
export const CROP_HEIGHT = 675;

// Downloads an image and returns a local link to it (blob: URL). Working from a local copy
// means the canvas is never blocked by cross-origin rules or an old cached copy.
export async function fetchImageAsBlobUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not load the image');
  return URL.createObjectURL(await response.blob());
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read the image'));
    image.src = src;
  });
}

// Cuts the chosen area out of the image and returns it as a 1200x675 WebP Blob.
// areaPixels is { x, y, width, height } in the image's own pixels (from react-easy-crop).
export async function cropToWebp(imageSrc, areaPixels, quality = 0.85) {
  const image = await loadImage(imageSrc);

  const canvas = document.createElement('canvas');
  canvas.width = CROP_WIDTH;
  canvas.height = CROP_HEIGHT;

  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    areaPixels.x, areaPixels.y, areaPixels.width, areaPixels.height, // the part of the photo
    0, 0, CROP_WIDTH, CROP_HEIGHT // fills the whole output
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not save the cropped image'))),
      'image/webp',
      quality
    );
  });
}

// CSS for an <img> inside a 16:9 box (overflow: hidden) that shows exactly the cropped area.
// It's the live preview: no canvas needed while dragging.
// mediaSize is { naturalWidth, naturalHeight }, areaPixels as above.
export function getPreviewStyle(areaPixels, mediaSize) {
  if (!areaPixels || !mediaSize) return { display: 'none' };

  return {
    position: 'absolute',
    maxWidth: 'none',
    width: `${(mediaSize.naturalWidth / areaPixels.width) * 100}%`,
    height: `${(mediaSize.naturalHeight / areaPixels.height) * 100}%`,
    left: `${(-areaPixels.x / areaPixels.width) * 100}%`,
    top: `${(-areaPixels.y / areaPixels.height) * 100}%`,
  };
}

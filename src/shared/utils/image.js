// image.js: checks menu image files (type and size), used by the menu item window.

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

// Menu images can be JPG, PNG or WebP
export function isAllowedImage(file) {
  return allowedTypes.includes(file.type);
}

// Shrinks an image in the browser so its longest side is at most maxSide pixels, and
// saves it as WebP. Small files load fast on the POS. Returns a Blob.
export async function resizeToWebp(file, maxSide = 1000, quality = 0.8) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not convert the image'))),
      'image/webp',
      quality
    );
  });
}

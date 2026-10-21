import jsQR from 'jsqr';
const scope = self as unknown as {
  onmessage: ((e: MessageEvent) => void) | null;
  postMessage: (data: unknown) => void;
};
const canvas = new OffscreenCanvas(1, 1),
  context = canvas.getContext('2d', { willReadFrequently: true })!;
scope.onmessage = ({ data }) => {
  const bitmap: ImageBitmap = data.bitmap;
  try {
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    context.drawImage(bitmap, 0, 0);
    const image = context.getImageData(0, 0, canvas.width, canvas.height),
      code = jsQR(image.data, image.width, image.height, {
        inversionAttempts: 'dontInvert',
      });
    scope.postMessage({
      width: bitmap.width,
      data: code?.data || null,
      location: code?.location || null,
    });
  } catch (e) {
    scope.postMessage({ error: String(e) });
  } finally {
    bitmap.close();
  }
};

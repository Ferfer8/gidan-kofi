// CameraScanner: a camera view that reads one QR code or barcode, used by the POS Add discount pop-up.

import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import './CameraScanner.css';

let nextId = 1;

// A camera view that reads one QR code (or barcode) and tells you what it says. It works on iPads and Android
// tablets (html5-qrcode), uses the back camera, and shows a square frame. The camera is stopped as soon as a code is
// read and whenever this component goes away, so it never keeps running.
//   onScan(text)       called once, with what the code holds, and the camera is stopped
//   onUnavailable()    the camera can't be used (permission refused, no camera, not HTTPS or localhost)
//   hint               the line under the camera (default "Hold the QR code inside the frame")
// To scan again, show it again with a new `key`. The camera only works on HTTPS or localhost.
function CameraScanner({ onScan, onUnavailable, hint = 'Hold the QR code inside the frame' }) {
  const elementId = useRef(`camera_scanner_${nextId++}`);
  const handlers = useRef({});
  handlers.current = { onScan, onUnavailable };

  useEffect(() => {
    const scanner = new Html5Qrcode(elementId.current, { verbose: false });
    let stopped = false; // this view is gone, or a code was read
    let running = false;

    const stop = async () => {
      if (!running) return;
      running = false;
      try {
        await scanner.stop();
        scanner.clear();
      } catch {
        // already stopped
      }
    };

    scanner
      .start(
        { facingMode: 'environment' }, // the back camera
        {
          fps: 10,
          aspectRatio: 1,
          // a square frame, most of the width of the camera view
          qrbox: (width, height) => {
            const side = Math.floor(Math.min(width, height) * 0.75);
            return { width: side, height: side };
          },
        },
        (text) => {
          if (stopped) return;
          stopped = true;
          stop().finally(() => handlers.current.onScan(text));
        },
        () => {} // nothing readable in this picture yet: keep looking
      )
      .then(() => {
        running = true;
        if (stopped) stop(); // the view was closed while the camera was starting
      })
      .catch(() => {
        if (!stopped) handlers.current.onUnavailable?.();
      });

    return () => {
      stopped = true;
      stop();
    };
  }, []);

  return (
    <div className="camera_scanner">
      <div className="scan_view">
        <div id={elementId.current} className="scan_video" />
        <div className="scan_frame" aria-hidden="true">
          <span className="scan_corner top_left" />
          <span className="scan_corner top_right" />
          <span className="scan_corner bottom_left" />
          <span className="scan_corner bottom_right" />
        </div>
      </div>
      <p className="scan_hint">{hint}</p>
    </div>
  );
}

export default CameraScanner;

// devices.js: placeholder list of the hardware at a counter, used by the POS Devices settings.

// The hardware at this counter, for the Settings > Devices screen.
// No real hardware is connected yet: these are placeholders. When the real printer, terminal, drawer
// and scanner are connected, replace this list (or fill `status` from the devices) and nothing else
// on the screen has to change.
//   status   'connected' | 'ready'   (the green pill says "Connected" or "Ready")
export const devices = [
  { id: 'printer', name: 'Receipt printer', detail: 'Epson TM-m30III · USB', status: 'connected' },
  { id: 'terminal', name: 'Card terminal', detail: 'Counter terminal · Bluetooth', status: 'connected' },
  { id: 'drawer', name: 'Cash drawer', detail: 'Opens automatically on cash sales', status: 'connected' },
  { id: 'scanner', name: 'Barcode scanner', detail: 'Handheld scanner · USB', status: 'ready' },
];

export const statusLabels = { connected: 'Connected', ready: 'Ready' };

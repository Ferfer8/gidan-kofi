// demoPins.js: the demo staff PINs shown on the PIN screen, used by PinScreen.

// The demo staff and their PINs, for the "Demo PINs" list on the PIN screen (so portfolio visitors can try every
// role of the POS). They match the demo database. Remove this and the link in a real café.
// `note` is a short line under the name; `kitchen: true` marks who can use the kitchen screen (the PIN screen of
// the kitchen lists only those).
export const demoPins = [
  { name: 'Yusuf', role: 'Barista', pin: '1357' },
  { name: 'Amaka', role: 'Barista', pin: '2580' },
  { name: 'Dennis', role: 'Barista', pin: '3691' },
  { name: 'Maryam', role: 'Barista', pin: '4712' },
  { name: 'Hauwa', role: 'Barista', pin: '5823' },
  { name: 'Sadia', role: 'Pastry chef (kitchen)', pin: '6060', kitchen: true },
  { name: 'Demo Manager', role: 'Manager', note: 'for refunds and manager discounts', pin: '7305', kitchen: true },
];

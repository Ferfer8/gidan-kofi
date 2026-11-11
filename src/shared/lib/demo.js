// demo.js: tells whether this is the public demo and whether the signed-in manager is the demo login, used by the
// admin panel, the POS and the demo banner.

// The demo login is the e-mail in VITE_DEMO_EMAIL (the "Try the demo" button). A site without it is not a demo.
const demoEmail = (import.meta.env.VITE_DEMO_EMAIL ?? '').trim().toLowerCase();

// True when this site has a demo login set up
export const isDemoSite = demoEmail !== '';

// True when this is the demo login's e-mail
export const isDemoEmail = (email) => isDemoSite && String(email ?? '').trim().toLowerCase() === demoEmail;

export const DEMO_BLOCKED_MESSAGE = 'This is turned off in the demo, so the demo keeps working for everyone.';
export const PROTECTED_STAFF_TIP = "Existing staff can't be changed in the demo";

// The database says PT410 (existing staff) or PT411 (typed PIN) when the demo login tries something it may not
export const isDemoBlock = (problem) => problem?.code === 'PT410' || problem?.code === 'PT411';

// settings.js: the Settings sections, their choices (currency, time zone...) and the default settings,
// used by the admin Settings pages.

import logoFull from '../../shared/assets/logos/logo-full.png';

// The sections in the left list. path is the end of the URL: /settings/<path>
export const settingsSections = [
  { path: 'details', label: 'Café details' },
  { path: 'opening-hours', label: 'Opening hours' },
  { path: 'tax', label: 'Tax & pricing' },
  { path: 'receipts', label: 'Receipts' },
  { path: 'payments', label: 'Payments' },
  { path: 'counters', label: 'Counters' },
];

export const currencyOptions = [
  { value: 'AED', label: 'AED (UAE dirham)' },
  { value: 'SAR', label: 'SAR (Saudi riyal)' },
  { value: 'USD', label: 'USD (US dollar)' },
];

export const timeZoneOptions = [
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GMT+4)' },
  { value: 'Asia/Riyadh', label: 'Asia/Riyadh (GMT+3)' },
  { value: 'Europe/London', label: 'Europe/London (GMT+0)' },
];

export const cashRoundingOptions = [
  { value: 'none', label: 'No rounding' },
  { value: '0.25', label: 'AED 0.25' },
  { value: '0.5', label: 'AED 0.50' },
  { value: '1', label: 'AED 1.00' },
];

// All settings live in one object so the Settings page can tell when something has changed.
// details.logo is an image URL (the default logo, or a file the user picked).
export const defaultSettings = {
  details: {
    logo: logoFull,
    name: 'Gidan Kofi',
    phone: '+971 7 000 0000',
    address: 'Shop 4, Al Dhait, Ras Al Khaimah, UAE',
    trn: '000 0000 0000 0000',
    currency: 'AED',
    receiptEmail: 'receipts@gidankofi.ae',
    timeZone: 'Asia/Dubai',
    branches: [{ name: 'Ras Al Khaimah', opened: 'January 2025' }],
  },
  hours: {
    days: [
      { day: 'Monday', open: true, from: '07:00', to: '23:00' },
      { day: 'Tuesday', open: true, from: '07:00', to: '23:00' },
      { day: 'Wednesday', open: true, from: '07:00', to: '23:00' },
      { day: 'Thursday', open: true, from: '07:00', to: '23:00' },
      { day: 'Friday', open: true, from: '08:00', to: '23:00' },
      { day: 'Saturday', open: true, from: '07:00', to: '23:00' },
      { day: 'Sunday', open: true, from: '07:00', to: '23:00' },
    ],
    autoCloseAt: '23:00',
    businessDayEnds: '04:00', // late-night orders and closings before this time count as the previous day
    // One-off dates that override the weekly hours. mode: 'Closed' | 'Custom hours'
    specialDays: [
      { id: 1, date: '2026-12-02', mode: 'Custom hours', from: '10:00', to: '18:00', note: 'National Day' },
      { id: 2, date: '2027-03-10', mode: 'Closed', from: '', to: '', note: 'Eid al-Fitr' },
    ],
  },
  tax: {
    vatRate: 5,
    pricesIncludeVat: false,
    cashRounding: '0.25',
    bagPrice: 0.5,
    askAboutBag: true,
  },
  receipts: {
    autoPrint: true,
    largeOrderNumber: true,
    prefix: 'GK',
    emailReceipts: true,
    footer: 'Barka da zuwa · Thank you!',
  },
  payments: {
    cash: true,
    card: true,
    split: true,
    startingFloat: 300,
    pinForDrawer: true,
  },
  counters: [
    { id: 1, name: 'Counter 1', device: 'iPad · Front', printer: 'Epson TM-m30III', lastSynced: '2 min ago', status: 'Online' },
    { id: 2, name: 'Counter 2', device: 'iPad · Back', printer: 'Epson TM-m30III', lastSynced: '2 min ago', status: 'Online' },
  ],
};

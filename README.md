# ☕ Gidan Kofi POS
A café point of sale and admin panel, working together in real time.

Gidan Kofi ("coffee house" in Hausa) is a point of sale (POS) system for a small café, with a separate admin panel for the manager. Baristas take orders and payments at the counter, the kitchen logs what it bakes and the manager runs the menu, stock, staff, discounts and settings, all from one shared database, with changes showing up live on every screen.

▶ [Try the POS and admin panel](https://gidankofi.netlify.app)

## About the Project
I designed the interface for Gidan Kofi in Figma, using an Espresso & Cream colour palette, then built it in React with a Supabase backend.

While building it, I made a few changes to my original design. For example, the import flow now shows a three-step indicator (**1 Upload · 2 Review · 3 Done**), so users always know where they are and what happens next. This follows the usability heuristic **visibility of system status**: keep users informed about what's going on. I also added features that weren't in the original design, such as split payments, a kitchen screen, QR code vouchers and an end-of-day cash count.

For the live demo, I added a separate demo manager, protected the café's existing staff and set up a nightly reset, so every visitor gets a working demo.

Gidan Kofi was developed in a private repository. This repo contains the finished version, published as a clean copy for my portfolio.

## A Note on the Demo Data
The menu, staff, orders and sales are sample data, so the app feels like a real café when you open it. Menu photos are from Pexels.

Feel free to try anything: place orders, apply discounts, refund orders or change the menu. Every night at 3 AM (UAE time), the demo resets to its original state with fresh sales history for the last 90 days. The café's existing staff can't be changed in the demo, but you can add your own staff member to try roles, permissions and PINs.

## Features
**POS (counter)**
- **Two counters, one system:** each counter has its own order numbers, receipts and cash drawer. Staff sign in with their own PIN.
- **Ordering:** a colour-coded menu (hot drinks, cold drinks, pastries, grab & go), with options for size, milk, shots, syrups and hot or iced, plus live "X left" counts.
- **Discounts:** voucher codes typed in or scanned as QR codes, or manager discounts approved with a manager PIN. In a real café, vouchers would be scanned with a barcode scanner at the counter. For this project, the tablet's camera does the scanning, so it can be tried without any extra hardware (a handheld scanner still works too).
- **Payments:** cash (with change), card, or split between the two, then a printable receipt.
- **Sales:** today's orders, reprints and refunds with manager approval.
- **End of day:** count the cash drawer and close the day, which locks the counter until the next day.
- **Kitchen screen:** log batches as they're baked or made and record leftovers at closing.

**Admin panel (manager)**
- **Dashboard:** today's sales, sales by hour, top items, low stock, payments, who's on shift and cash drawer results.
- **Sales & orders:** orders by day, week, month or a custom range, plus an Excel export for analysis.
- **Menu & stock:** menu items with images (with cropping), customisations and stock levels with low stock alerts.
- **Import & export:** update the menu or stock from a spreadsheet, with a review step that catches typos ("Did you mean Cinnamon Roll?") before anything is saved.
- **Staff & permissions:** roles, per-person permissions and PINs.
- **Discounts:** voucher codes with QR codes to download or print, plus limits on manager discounts.
- **Café settings:** café details, opening hours, VAT, receipts, payments and counters.

## How to Use
1. Open the demo and choose **Open the POS** or **Open the admin panel**.
2. **POS:** pick Counter 1 or Counter 2, then sign in with a demo PIN. All the demo PINs are listed on the PIN screen, for example:
   - **Yusuf** (barista): 1357
   - **Sadia** (pastry chef, kitchen): 6060
   - **Demo Manager** (for refunds and manager discounts): 7305

   Take an order, add a discount and complete the payment.
3. **Admin panel:** press **Try the demo** on the login page to sign in as the demo manager.
4. To see it work live, open the admin panel and a counter side by side. Orders, price changes and "counters online" update without refreshing.

Want to run Gidan Kofi locally? Get in touch on GitHub or LinkedIn and I'll share the setup details.

## Built With
- **React** (JavaScript, with Vite) and **React Router** for the front end
- **Plain CSS** with CSS variables for styling (no UI libraries)
- **Supabase** for the database (PostgreSQL), manager login, file storage and live updates (Realtime)
- **ExcelJS** and **SheetJS** for spreadsheet export and import
- **react-easy-crop** for image cropping, plus **qrcode** and **html5-qrcode** for voucher QR codes
- **GitHub Actions** to keep the demo database active, plus a **Supabase scheduled job** (pg_cron) to reset the demo data nightly

## Security
- Row-level security on every table, so only signed-in managers can use the admin panel's data.
- Staff PINs are stored only as hashes. Each shift gets a secret token, and the database checks it on every POS action.
- Refunds, reopening the day and manager discounts need a one-time manager approval, checked in the database.
- PIN and voucher guessing is rate limited in the database, not just on screen.
- Order totals, VAT and discounts are recalculated by the database when an order is saved.
- In the demo, changes that would stop the demo working for others (such as editing existing staff or changing the demo login) are blocked in the database.

## Credits
Menu photos are from Pexels and the logo was made with Canva. Neither needs attribution.

## License
© 2026 Jennifer Nggada. All rights reserved.

This code is shared publicly as part of my portfolio. You're welcome to view it, but please don't copy, modify, or reuse it without my permission. Interested in using it? Contact me on GitHub or LinkedIn.

## Author
Jennifer Nggada

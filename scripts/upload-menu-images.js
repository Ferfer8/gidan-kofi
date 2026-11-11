// One-off script: uploads the photos in src/shared/assets/images/ to Supabase Storage and saves
// each one's public link on its menu item.
//
// Run it with:   npm run upload-menu-images
// Check first:   npm run upload-menu-images -- --dry-run   (shows the matches, uploads nothing)
//
// It signs in as a manager (so the normal security rules apply, no secret key needed) using
// ADMIN_EMAIL and ADMIN_PASSWORD from .env. If those aren't set it uses the demo manager
// (VITE_DEMO_EMAIL and VITE_DEMO_PASSWORD).
//
// Photos are shrunk to at most 1000px on the longest side and saved as WebP (about 80%
// quality), the same as images uploaded in the admin panel. That keeps them under the
// bucket's 2 MB limit and fast to load on the POS.

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BUCKET = 'menu-images';
const IMAGE_FOLDER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'shared', 'assets', 'images');
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// File names that don't match their menu item once case, spaces, dashes and underscores are
// ignored (spelling differences). Rename the file instead if you prefer.
const ALIASES = {
  chickenpestosandwhich: 'Chicken Pesto Sandwich',
  cinammonroll: 'Cinnamon Roll',
  greekyoghurtparfait: 'Greek Yogurt Parfait',
};

// "Flat White" and "flat-white.jpg" both become "flatwhite"
export function normalizeName(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Pairs each image file with the menu item it belongs to.
// Returns { matches: [{ file, item }], unmatchedFiles: [file], itemsWithoutImage: [item] }
export function matchImagesToItems(files, items) {
  const itemsByName = new Map(items.map((item) => [normalizeName(item.name), item]));
  const matches = [];
  const unmatchedFiles = [];

  for (const file of files) {
    const key = normalizeName(path.parse(file).name);
    const item = itemsByName.get(ALIASES[key] ? normalizeName(ALIASES[key]) : key);
    if (item) matches.push({ file, item });
    else unmatchedFiles.push(file);
  }

  const matchedIds = new Set(matches.map((match) => match.item.id));
  const itemsWithoutImage = items.filter((item) => !matchedIds.has(item.id));
  return { matches, unmatchedFiles, itemsWithoutImage };
}

// The file path inside the bucket, from a public link (or null if it isn't one of ours)
function pathFromUrl(url) {
  const marker = `/${BUCKET}/`;
  const start = url?.indexOf(marker) ?? -1;
  return start === -1 ? null : decodeURIComponent(url.slice(start + marker.length));
}

async function shrinkToWebp(filePath) {
  return sharp(await readFile(filePath))
    .rotate() // respect the phone/camera orientation
    .resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const { VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY } = process.env;
  const email = process.env.ADMIN_EMAIL || process.env.VITE_DEMO_EMAIL;
  const password = process.env.ADMIN_PASSWORD || process.env.VITE_DEMO_PASSWORD;

  if (!VITE_SUPABASE_URL || !VITE_SUPABASE_PUBLISHABLE_KEY || !email || !password) {
    console.error('Missing settings in .env. Needed: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY,');
    console.error('and ADMIN_EMAIL + ADMIN_PASSWORD (or VITE_DEMO_EMAIL + VITE_DEMO_PASSWORD).');
    process.exit(1);
  }

  const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false },
  });

  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) {
    console.error(`Could not sign in as ${email}: ${signInError.message}`);
    process.exit(1);
  }
  console.log(`Signed in as ${email}${dryRun ? ' (dry run: nothing will be uploaded)' : ''}\n`);

  const { data: items, error: itemsError } = await supabase.from('menu_items').select('id, name, image_url');
  if (itemsError) throw itemsError;
  if (items.length === 0) {
    console.error('No menu items found. Is this account a manager, and has the menu been set up?');
    process.exit(1);
  }

  const files = (await readdir(IMAGE_FOLDER)).filter((file) =>
    IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase())
  );
  const { matches, unmatchedFiles, itemsWithoutImage } = matchImagesToItems(files, items);

  const failed = [];
  for (const { file, item } of matches) {
    if (dryRun) {
      console.log(`  would upload  ${file}  ->  ${item.name}`);
      continue;
    }

    try {
      const body = await shrinkToWebp(path.join(IMAGE_FOLDER, file));
      const objectPath = `${item.id}-${Date.now()}.webp`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(objectPath, body, { contentType: 'image/webp', cacheControl: '31536000' });
      if (uploadError) throw uploadError;

      const publicUrl = supabase.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
      const { error: saveError } = await supabase.from('menu_items').update({ image_url: publicUrl }).eq('id', item.id);
      if (saveError) throw saveError;

      // running the script again replaces the image, so tidy up the old file
      const oldPath = pathFromUrl(item.image_url);
      if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);

      console.log(`  uploaded      ${file}  ->  ${item.name}  (${Math.round(body.length / 1024)} KB)`);
    } catch (error) {
      failed.push(file);
      console.log(`  FAILED        ${file}  ->  ${item.name}: ${error.message}`);
    }
  }

  console.log('\n---- Summary ----');
  console.log(`Matched ${matches.length} of ${files.length} image files to menu items${failed.length ? `, ${failed.length} failed` : ''}.`);
  console.log(`\nFiles that matched no menu item (${unmatchedFiles.length}):`);
  unmatchedFiles.forEach((file) => console.log(`  ${file}`));
  console.log(`\nMenu items with no image (${itemsWithoutImage.length}):`);
  itemsWithoutImage.forEach((item) => console.log(`  ${item.name}`));
}

// only run when started directly (importing this file for tests does nothing)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

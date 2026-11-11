// menu.js: loads and saves menu items, options and images, and the menu import call, used by the admin Menu &
// Stock page.

import { getSupabase } from './supabase.js';
import { hasSeparator, capitalizeFirst } from '../utils/menu.js';

// REALTIME: menu_items and item_sizes have Supabase Realtime turned on (01_schema.sql).
// The POS will subscribe to changes on those two tables with supabase.channel(...).on(
// 'postgres_changes', ...), so new items, price changes and new images show up there
// straight away, without reloading. Nothing in the admin panel needs to do anything for that.

export const MENU_IMAGE_BUCKET = 'menu-images';

// The Drinks dot is half brown (hot) and half green (cold). The database keeps one colour per
// category, so this one is special-cased.
const DRINKS_DOT = 'linear-gradient(90deg, #8b5a3b 50%, #6b7a3a 50%)';

const itemColumns = `id, code, category_id, name, description, allergens, image_url, image_original_url, image_crop, on_menu, tracking, served, cold_extra, sort_order,
  item_sizes ( id, label, price, sort_order, stock_item_id )`;

function mapCategory(row) {
  return { id: row.id, name: row.name, color: row.name === 'Drinks' ? DRINKS_DOT : row.colour };
}

// THE one way options (sizes or colours) are listed together, everywhere: "S · M · L",
// "Black · White". Joined with a space, the middle dot (U+00B7) and a space, in their sort order.
// Takes option names, or size rows ({ label, sortOrder }). The POS should use this too.
const OPTION_SEPARATOR = ' \u00B7 ';

export function formatOptions(sizes) {
  return [...sizes]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) // names (strings) have no sortOrder and keep their order
    .map((size) => (typeof size === 'string' ? size : size.label))
    .filter(Boolean)
    .map(capitalizeFirst)
    .join(OPTION_SEPARATOR);
}

// A row from the database -> the shape the menu components use.
// `price` is the lowest size price (the "from AED" price). A size called "Regular" means the item
// has just one size, so it isn't shown in the sizes list.
export function mapMenuItem(row) {
  const sizeRows = [...row.item_sizes]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((size) => ({
      id: size.id,
      label: size.label,
      price: Number(size.price),
      sortOrder: size.sort_order,
      stockItemId: size.stock_item_id, // the stock item linked to this option, if any
    }));

  return {
    id: row.id,
    code: row.code, // permanent, e.g. MENU-0001 (never sent when saving: the database makes it)
    name: row.name,
    category: row.category_id,
    description: row.description ?? '',
    allergens: row.allergens,
    image: row.image_url, // the cropped 16:9 image the cards and the POS show
    imageOriginal: row.image_original_url, // the full photo, kept so it can be cropped again
    imageCrop: row.image_crop, // where the last crop was: { x, y, width, height, zoom }
    onMenu: row.on_menu,
    served: row.served, // drinks only: 'hot' | 'cold' | 'both' (null for everything else)
    coldExtra: Number(row.cold_extra ?? 0), // extra AED when a 'both' drink is ordered cold
    tracking: row.tracking, // 'none' | 'stock' (sold from Retail stock) | 'made_daily' (made fresh, maybe baked from frozen)
    sortOrder: row.sort_order,
    sizeRows,
    price: sizeRows.length > 0 ? Math.min(...sizeRows.map((size) => size.price)) : 0,
    sizes: sizeRows.filter((size) => size.label.toLowerCase() !== 'regular'), // rows, for formatOptions()
  };
}

// { categories, items } for the whole menu
export async function getMenu() {
  const supabase = getSupabase();
  const [categories, items] = await Promise.all([
    supabase.from('categories').select('id, name, colour').order('sort_order'),
    supabase.from('menu_items').select(itemColumns).order('sort_order').order('name'),
  ]);

  if (categories.error) throw new Error(categories.error.message);
  if (items.error) throw new Error(items.error.message);

  return { categories: categories.data.map(mapCategory), items: items.data.map(mapMenuItem) };
}

// Shows or hides an item on the POS
export async function setOnMenu(id, onMenu) {
  const { error } = await getSupabase().from('menu_items').update({ on_menu: onMenu }).eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------

// Uploads an image and returns its public link. The cropped image is <item id>-<time>.webp and
// the original is <item id>-<time>-original.webp. Every upload gets a new file name (never
// overwriting), so browsers and the CDN never show an old cached image.
export async function uploadMenuImage(itemId, imageBlob, kind = 'cropped') {
  const supabase = getSupabase();
  const path = `${itemId}-${Date.now()}${kind === 'original' ? '-original' : ''}.webp`;

  const { error } = await supabase.storage
    .from(MENU_IMAGE_BUCKET)
    .upload(path, imageBlob, { contentType: 'image/webp', cacheControl: '31536000' });
  if (error) throw new Error(`Could not upload the image: ${error.message}`);

  return supabase.storage.from(MENU_IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

// The file path inside the bucket, taken from a public link
function pathFromUrl(url) {
  const marker = `/${MENU_IMAGE_BUCKET}/`;
  const start = url ? url.indexOf(marker) : -1;
  return start === -1 ? null : decodeURIComponent(url.slice(start + marker.length));
}

// Deletes an image file. A leftover file does no harm, so a failure here is ignored.
export async function deleteMenuImage(url) {
  const path = pathFromUrl(url);
  if (!path) return;
  try {
    await getSupabase().storage.from(MENU_IMAGE_BUCKET).remove([path]);
  } catch {
    // ignored on purpose
  }
}

// ---------------------------------------------------------------------
// Saving and deleting items
// ---------------------------------------------------------------------

// Saves an item, its options and the stock of its options in ONE go. The database part is a
// single database function (save_menu_item_with_stock), so either everything is saved or nothing
// is. Images are uploaded first, and removed again if the save fails.
//   details: { id (null for a new item), name, categoryId, description, allergens, onMenu, sortOrder,
//              tracking: 'none' | 'stock' | 'made_daily',
//              served: 'hot' | 'cold' | 'both' for drinks, null for other items,   coldExtra: number,
//              sizes: [{ id (null for a new option), label, price,
//                        stockItemId: the Retail item it is sold from ('stock') or the Frozen bakery item
//                                     it is baked from ('made_daily', optional), or null,
//                        newStock: { quantity, lowAt, unit } to create a new Retail item for it ('stock') or null }],
//              deleteStockIds: stock items to delete along with the item (optional) }
//   image:   { croppedBlob (the new 16:9 image) | null, originalBlob (a newly chosen full photo) | null,
//              crop ({ x, y, width, height, zoom }) | null, removeImage: boolean,
//              old: { imageUrl, originalUrl } (what the item has saved now) }
// Returns the item's id.
export async function saveMenuItem(details, image) {
  // each option must be its own row: never save a name that holds several options
  const combined = details.sizes.find((size) => hasSeparator(size.label));
  if (combined) {
    throw new Error(`"${combined.label}" has more than one option in it. Put each size or colour on its own row.`);
  }

  // a new item gets its id here, so its image files can be named after it
  const id = details.id ?? crypto.randomUUID();
  const uploaded = [];

  let imageChange;
  try {
    imageChange = await uploadImages(id, image, uploaded);

    const { error } = await getSupabase().rpc('save_menu_item_with_stock', {
      p_item: {
        id,
        name: details.name,
        category_id: details.categoryId,
        description: details.description,
        allergens: details.allergens,
        on_menu: details.onMenu,
        sort_order: details.sortOrder,
        tracking: details.tracking,
        served: details.served,
        cold_extra: details.coldExtra,
        ...imageChange.fields,
      },
      p_sizes: details.sizes.map((size, index) => ({
        id: size.id,
        label: size.label.trim(),
        price: Number(size.price),
        sort_order: index + 1,
        stock_item_id: size.stockItemId ?? null,
        new_stock: size.newStock
          ? { quantity: size.newStock.quantity, low_at: size.newStock.lowAt, unit: size.newStock.unit }
          : null,
      })),
      p_delete_stock_ids: details.deleteStockIds ?? [],
    });
    if (error) throw new Error(error.message);
  } catch (error) {
    await Promise.all(uploaded.map(deleteMenuImage)); // nothing was saved, so don't keep the new files
    throw error;
  }

  // saved: now the files that were replaced can go
  await Promise.all(imageChange.replaced.map(deleteMenuImage));
  return id;
}

// Uploads a new cropped image (and a new original if a photo was chosen). Returns the image
// fields to save and the old files that will no longer be used.
async function uploadImages(itemId, { croppedBlob, originalBlob, crop, removeImage, old }, uploaded) {
  if (croppedBlob) {
    const imageUrl = await uploadMenuImage(itemId, croppedBlob);
    uploaded.push(imageUrl);

    let originalUrl = old.originalUrl;
    if (originalBlob) {
      originalUrl = await uploadMenuImage(itemId, originalBlob, 'original');
      uploaded.push(originalUrl);
    } else if (!originalUrl) {
      // an older image with no saved original: the current image becomes the original
      originalUrl = old.imageUrl;
    }

    const inUse = [imageUrl, originalUrl];
    return {
      fields: { set_image: true, image_url: imageUrl, image_original_url: originalUrl, image_crop: crop },
      replaced: [old.imageUrl, old.originalUrl].filter((url) => url && !inUse.includes(url)),
    };
  }

  if (removeImage) {
    return {
      fields: { set_image: true, image_url: null, image_original_url: null, image_crop: null },
      replaced: [old.imageUrl, old.originalUrl].filter(Boolean),
    };
  }

  return { fields: { set_image: false }, replaced: [] };
}

// Saves the reviewed items of a menu import in ONE go (the import_menu_items database function), so
// either every item is saved or none is. items come from menuItemsToSave() in lib/menuImport.js: an
// item with an id is updated, one with a null id is added (the database gives it its code).
// Nothing is ever deleted, and images are not touched. Returns { added, updated, created_stock }.
export async function importMenuItems(items) {
  const { data, error } = await getSupabase().rpc('import_menu_items', {
    p_items: items.map((item) => ({
      id: item.id,
      name: item.name,
      category_id: item.categoryId,
      description: item.description || null,
      allergens: item.allergens,
      on_menu: item.onMenu,
      tracking: item.tracking,
      served: item.served ?? null,
      cold_extra: item.coldExtra ?? 0,
      options: item.options.map((option) => ({
        label: option.label,
        price: option.price,
        stock_item_id: option.stockItemId ?? null,
        create_stock: option.createStock === true,
      })),
    })),
  });
  if (error) {
    // the full error, so the real cause can be found in the browser console
    console.error('import_menu_items failed', { message: error.message, details: error.details, hint: error.hint, code: error.code });
    throw new Error(error.message);
  }
  return data;
}

// Deletes an item (its options go with it) and its image files. With deleteStock, the stock items
// linked to its options are deleted too; otherwise they stay in the Stock list.
export async function deleteMenuItem(item, deleteStock = false) {
  const { error } = await getSupabase().rpc('delete_menu_item_with_stock', {
    p_item_id: item.id,
    p_delete_stock: deleteStock,
  });
  if (error) throw new Error(error.message);

  await deleteMenuImage(item.image);
  await deleteMenuImage(item.imageOriginal);
}

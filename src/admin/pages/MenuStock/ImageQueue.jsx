// ImageQueue: after a menu import: steps through the new items so each can get an image, used by the Menu & Stock
// and Import pages.

import { useState } from 'react';
import Modal from '../../../shared/components/Modal.jsx';
import Button from '../../../shared/components/Button.jsx';
import MenuItemModal from './MenuItemModal.jsx';

// After a menu import that added new items (which have no image yet): a pop-up that lists them, and
// then, one item at a time, the normal Edit menu item modal so an image can be added to each.
//   items:        the new items without an image (from the menu: shape from getMenu)
//   categories, menuItems, stockItems: what MenuItemModal needs
//   onItemSaved:  called after each item is saved, so the page can show the new data
//   onClose:      called when the queue is over: ({ finished, message })
//                 finished = every item was gone through (Save or Skip); message = the toast to show then
function ImageQueue({ items, categories, menuItems, stockItems, onItemSaved, onClose }) {
  const [position, setPosition] = useState(null); // null = the pop-up, otherwise the index in items
  const [withImage, setWithImage] = useState(0); // how many were saved with an image

  const categoryName = (id) => categories.find((category) => category.id === id)?.name ?? '';

  // the toast when the last item is done
  function finish(imagesAdded) {
    const stillMissing = items.length - imagesAdded;
    const itemsText = (count) => `${count} ${count === 1 ? 'item' : 'items'}`;
    const message =
      stillMissing === 0
        ? `Images added for ${itemsText(imagesAdded)}`
        : `${itemsText(stillMissing)} still ${stillMissing === 1 ? 'has' : 'have'} no image`;
    onClose({ finished: true, message });
  }

  function next(imagesAdded) {
    if (position === items.length - 1) finish(imagesAdded);
    else setPosition(position + 1);
  }

  // the pop-up
  if (position === null) {
    return (
      <Modal
        isOpen
        title="Add images for your new items"
        onClose={() => onClose({ finished: false })}
        footer={
          <>
            <Button variant="secondary" onClick={() => onClose({ finished: false })}>
              Later
            </Button>
            <Button onClick={() => setPosition(0)}>Add images now</Button>
          </>
        }
      >
        <p>Make sure to add images for the newly added menu items that don't have one yet. Until then, they'll show a placeholder.</p>
        <ul className="image_queue_list">
          {items.map((item) => (
            <li key={item.id}>
              {item.name} · {categoryName(item.category)}
            </li>
          ))}
        </ul>
      </Modal>
    );
  }

  // one item at a time. Closing the modal stops the queue; what was saved stays saved.
  const item = items[position];
  return (
    <MenuItemModal
      key={item.id}
      item={item}
      categories={categories}
      menuItems={menuItems}
      stockItems={stockItems}
      queue={{
        label: `${item.name} · ${position + 1} of ${items.length}`,
        isLast: position === items.length - 1,
        onSkip: () => next(withImage),
      }}
      onSaved={async ({ imageAdded }) => {
        await onItemSaved();
        const added = withImage + (imageAdded ? 1 : 0);
        setWithImage(added);
        next(added);
      }}
      onDeleted={() => {}}
      onClose={() => onClose({ finished: false })}
    />
  );
}

export default ImageQueue;

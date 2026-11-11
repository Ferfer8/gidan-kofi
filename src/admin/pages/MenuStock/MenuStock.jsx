// MenuStock: the Menu & Stock page that holds the Menu, Stock and Customisations views, shown at /admin/menu.

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useSearchParams, useOutletContext, useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader.jsx';
import SegmentedControl from '../../../shared/components/SegmentedControl.jsx';
import Button from '../../../shared/components/Button.jsx';
import DropdownMenu from '../../../shared/components/DropdownMenu.jsx';
import PageStatus from '../../../shared/components/PageStatus.jsx';
import MenuView from './MenuView.jsx';
import StockView from './StockView.jsx';
import MenuItemModal from './MenuItemModal.jsx';
import StockItemModal from './StockItemModal.jsx';
import CustomisationsView from './CustomisationsView.jsx';
import CustomisationModal from './CustomisationModal.jsx';
import ImageQueue from './ImageQueue.jsx';
import { drinksCategoryName } from '../../../shared/data/menu.js';
import Toast from '../../../shared/components/Toast.jsx';
import { getMenu, setOnMenu } from '../../../shared/lib/menu.js';
import { getStockItems, saveStockItem, deleteStockItem, watchStockChanges } from '../../../shared/lib/stock.js';
import { getCustomisations, saveGroup, deleteGroup, reorderGroups, countText as groupsCountText } from '../../../shared/lib/customisations.js';
import { countHidden, filterMenuItems, countWithoutImage, NO_IMAGE_FILTER } from '../../../shared/utils/menu.js';
import { countLowStock, filterStockItems } from '../../../shared/utils/stock.js';
import { exportStock, downloadStockTemplate } from '../../../shared/lib/stockExcel.js';
import { exportMenu, downloadMenuTemplate } from '../../../shared/lib/menuExcel.js';
import { setPendingImportFile } from '../../../shared/lib/importFile.js';
import './MenuStock.css';

const views = ['Menu', 'Stock', 'Customisations'];

// Items 18 -> "18 items"
function countText(count) {
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

function MenuStock() {
  // /menu?view=stock opens the Stock view straight away (the Dashboard's "Go to stock" link)
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const importInputRef = useRef(null);
  const [view, setView] = useState(searchParams.get('view') === 'stock' ? 'Stock' : 'Menu');

  // The menu comes from the database
  const [categories, setCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState('');
  const [toggleError, setToggleError] = useState('');

  // The stock list comes from the database too (including stock linked to menu items)
  const [stockItems, setStockItems] = useState([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockError, setStockError] = useState('');

  // Customisations (milk, shots, syrups...) come from the database too
  const [groups, setGroups] = useState(null);
  const [groupsError, setGroupsError] = useState('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState('all');
  const [menuSearch, setMenuSearch] = useState('');
  const [drinkFilter, setDrinkFilter] = useState('all'); // 'all' | 'hot' | 'cold', for the Drinks category
  const [stockFilter, setStockFilter] = useState('all');
  const [stockSearch, setStockSearch] = useState('');
  const [toast, setToast] = useState(null); // { message, type } or null
  // Which modal is open: null, or { kind: 'menu' | 'stock', item } (item is null when adding)
  const [modal, setModal] = useState(null);
  // ids of items just added by a menu import (they have no image yet), and the queue that asks for their images
  const [newItemIds, setNewItemIds] = useState(location.state?.newItemIds ?? null);
  const [imageQueueItems, setImageQueueItems] = useState(null);

  const isMenu = view === 'Menu';
  const isStock = view === 'Stock';
  const isCustom = view === 'Customisations';

  // The Menu view is exactly one screen tall and only its list scrolls. The Stock view scrolls
  // like a normal page.
  const { setLockHeight } = useOutletContext();
  useLayoutEffect(() => {
    setLockHeight(isMenu);
    return () => setLockHeight(false);
  }, [isMenu, setLockHeight]);
  const subtitle = isMenu
    ? `${countText(menuItems.length)} · ${countHidden(menuItems)} hidden`
    : isStock
      ? `${countText(stockItems.length)} · ${countLowStock(stockItems)} low stock`
      : groupsCountText(groups ?? []);

  async function loadMenu() {
    setMenuError('');
    try {
      const menu = await getMenu();
      setCategories(menu.categories);
      setMenuItems(menu.items);
    } catch (error) {
      setMenuError(error.message);
    }
    setMenuLoading(false);
  }

  async function loadStock() {
    setStockError('');
    try {
      setStockItems(await getStockItems());
    } catch (error) {
      setStockError(error.message);
    }
    setStockLoading(false);
  }

  // the stock quantities update by themselves when something is sold or made (no refresh needed)
  useEffect(() => watchStockChanges(loadStock), []);

  async function loadGroups() {
    setGroupsError('');
    try {
      setGroups(await getCustomisations());
    } catch (error) {
      setGroupsError(error.message);
    }
  }

  // coming back from the Import page: show its "Import completed" message, or the message from adding
  // images (then forget it, so a reload doesn't show it again)
  useEffect(() => {
    const { importToast, imageToast } = location.state ?? {};
    if (!importToast && !imageToast) return;
    setToast(importToast ? { type: 'success', ...importToast } : { message: imageToast });
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, []);

  // after a menu import that added items: once the menu is loaded, offer to add their images
  useEffect(() => {
    if (!newItemIds || menuLoading || stockLoading) return;
    const withoutImage = menuItems.filter((item) => newItemIds.includes(item.id) && !item.image);
    setNewItemIds(null);
    if (withoutImage.length > 0) setImageQueueItems(withoutImage);
  }, [newItemIds, menuLoading, stockLoading, menuItems]);

  // "No image" can only be the filter while some item has no image: when the last one gets its image, back to All
  useEffect(() => {
    if (menuCategoryFilter === NO_IMAGE_FILTER && countWithoutImage(menuItems) === 0) setMenuCategoryFilter('all');
  }, [menuItems, menuCategoryFilter]);

  // the toast goes away by itself after about 3 seconds
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), toast.type === 'success' ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    loadMenu();
    loadStock();
    loadGroups();
  }, []);

  // The screen changes straight away. If saving fails, it goes back and says so.
  async function toggleOnMenu(id) {
    const before = menuItems;
    const item = before.find((menuItem) => menuItem.id === id);

    setToggleError('');
    setMenuItems(before.map((menuItem) => (menuItem.id === id ? { ...menuItem, onMenu: !menuItem.onMenu } : menuItem)));
    try {
      await setOnMenu(id, !item.onMenu);
    } catch {
      setMenuItems(before);
      setToggleError(`Couldn't update ${item.name}. Check your connection and try again.`);
    }
  }

  // After a menu item is saved or deleted: show the fresh menu AND stock list (saving a menu item
  // can create, change or delete stock items), then close the modal
  async function finishMenuChange() {
    await Promise.all([loadMenu(), loadStock(), loadGroups()]);
    closeModal();
  }

  // A group saved or deleted in the Customisations view: the cards are loaded again
  async function saveGroupChanges(group) {
    await saveGroup(group);
    await loadGroups();
    setToast({ message: 'Customisation saved', type: 'success' });
    closeModal();
  }

  async function removeGroup(group) {
    await deleteGroup(group.id);
    await loadGroups();
    setToast({ message: `${group.name} deleted`, type: 'success' });
    closeModal();
  }

  // the up and down arrows: the new order is saved straight away
  async function moveGroup(group, delta) {
    const ids = groups.map((item) => item.id);
    const from = ids.indexOf(group.id);
    const to = from + delta;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    setGroups(ids.map((id) => groups.find((item) => item.id === id))); // the screen changes at once
    try {
      await reorderGroups(ids);
    } catch (error) {
      setToast({ message: "Couldn't change the order. Please try again.", type: 'error' });
      await loadGroups();
    }
  }

  // Stock items from the Stock view: saved to the database, then the list is loaded again so the
  // counts and pills are right. If saving fails, the modal shows the message and stays open.
  async function saveStock(savedItem) {
    await saveStockItem(savedItem);
    await loadStock();
    closeModal();
  }

  async function removeStock(id) {
    await deleteStockItem(id);
    await Promise.all([loadStock(), loadMenu()]); // a menu option may have been linked to it
    closeModal();
  }

  // A file download: "Preparing your file…", then what happened. The message goes away by itself.
  async function runDownload(makeFile, doneText, failText) {
    setToast({ message: 'Preparing your file…' });
    try {
      const fileName = await makeFile();
      setToast({ message: `${doneText}: ${fileName}` });
    } catch {
      setToast({ message: failText, type: 'error' });
    }
  }

  // Exports the stock items that are shown now (the active filter and search), as an Excel file
  const exportStockFile = () =>
    runDownload(
      () => exportStock(filterStockItems(stockItems, stockFilter, stockSearch)),
      'Stock exported',
      "Couldn't export stock. Please try again."
    );

  // Exports the menu items that are shown now (the active category and search): one row per option
  const drinksCategoryId = categories.find((category) => category.name === drinksCategoryName)?.id ?? null;

  const exportMenuFile = () =>
    runDownload(
      () => exportMenu(filterMenuItems(menuItems, menuCategoryFilter, menuSearch, drinkFilter, drinksCategoryId), categories, stockItems),
      'Menu exported',
      "Couldn't export menu. Please try again."
    );

  const downloadMenuTemplateFile = () =>
    runDownload(() => downloadMenuTemplate(categories), 'Template downloaded', "Couldn't download the template. Please try again.");

  // "Import CSV/Excel" in the Menu or Stock view: pick the file right here, then open the Import page
  // at the Review step with it. Closing the picker without a file does nothing.
  function pickImportFile(event) {
    const file = event.target.files[0];
    event.target.value = ''; // lets the same file be picked again
    if (!file) return;
    const kind = isMenu ? 'menu' : 'stock';
    setPendingImportFile(file, kind);
    navigate('/admin/import', { state: { from: kind } });
  }

  const downloadTemplate = () =>
    runDownload(downloadStockTemplate, 'Template downloaded', "Couldn't download the template. Please try again.");

  // the image queue is over (finished, or closed / "Later"): show the newest data, and the message if it finished
  async function closeImageQueue({ finished, message }) {
    setImageQueueItems(null);
    if (finished) setToast({ message });
    await Promise.all([loadMenu(), loadStock()]);
  }

  function closeModal() {
    setModal(null);
  }

  // the "+ Add" button also waits for the menu, since new items need its categories
  const canAddMenuItem = !menuLoading && !menuError;

  return (
    <div className={`menu_page ${isMenu ? 'menu_locked' : ''}`}>
      <div className="menu_header">
        <PageHeader title="Menu & Stock" subtitle={subtitle}>
          <SegmentedControl options={views} value={view} onChange={setView} />
          <Button
            disabled={(isMenu && !canAddMenuItem) || (isCustom && (groups === null || categories.length === 0))}
            onClick={() => setModal(isCustom ? { kind: 'group', group: null } : { kind: isMenu ? 'menu' : 'stock', item: null })}
          >
            {isMenu ? '+ Add menu item' : isStock ? '+ Add stock item' : '+ Add group'}
          </Button>
          {!isCustom && <DropdownMenu
            items={
              isMenu
                ? [
                    { label: 'Import CSV/Excel', icon: 'import', onClick: () => importInputRef.current.click() },
                    { label: 'Export menu (Excel)', icon: 'export', onClick: exportMenuFile },
                    { label: 'Download blank template', icon: 'file', onClick: downloadMenuTemplateFile },
                  ]
                : [
                    { label: 'Import CSV/Excel', icon: 'import', onClick: () => importInputRef.current.click() },
                    { label: 'Export stock (Excel)', icon: 'export', onClick: exportStockFile },
                    { label: 'Download blank template', icon: 'file', onClick: downloadTemplate },
                  ]
            }
          />}
        </PageHeader>

        {isMenu && toggleError && (
          <p className="menu_error" role="alert">
            {toggleError}
          </p>
        )}
      </div>

      {isMenu && (menuLoading || menuError) && (
        <PageStatus
          loading={menuLoading}
          error={menuError}
          onRetry={() => {
            setMenuLoading(true);
            loadMenu();
          }}
        />
      )}

      {isMenu && canAddMenuItem && (
        <MenuView
          categories={categories}
          items={menuItems}
          categoryId={menuCategoryFilter}
          onCategoryChange={(id) => {
            setMenuCategoryFilter(id);
            setDrinkFilter('all'); // the Hot / Cold row starts again from All drinks
          }}
          drinkFilter={drinkFilter}
          onDrinkFilterChange={setDrinkFilter}
          search={menuSearch}
          onSearchChange={setMenuSearch}
          onToggle={toggleOnMenu}
          onEdit={(item) => setModal({ kind: 'menu', item })}
        />
      )}

      {isStock && (stockLoading || stockError) && (
        <PageStatus
          loading={stockLoading}
          error={stockError}
          onRetry={() => {
            setStockLoading(true);
            loadStock();
          }}
        />
      )}

      {isStock && !stockLoading && !stockError && (
        <StockView
          items={stockItems}
          filter={stockFilter}
          onFilterChange={setStockFilter}
          search={stockSearch}
          onSearchChange={setStockSearch}
          onEdit={(item) => setModal({ kind: 'stock', item })}
        />
      )}

      {isCustom && (groups === null || groupsError) && (
        <PageStatus
          loading={!groupsError}
          error={groupsError}
          onRetry={() => {
            loadGroups();
          }}
        />
      )}

      {isCustom && groups !== null && !groupsError && (
        <CustomisationsView groups={groups} categories={categories} menuItems={menuItems} onEdit={(group) => setModal({ kind: 'group', group })} onMove={moveGroup} />
      )}

      {modal?.kind === 'group' && (
        <CustomisationModal
          group={modal.group}
          categories={categories}
          menuItems={menuItems}
          onSave={saveGroupChanges}
          onDelete={removeGroup}
          onClose={closeModal}
        />
      )}

      {modal?.kind === 'menu' && (
        <MenuItemModal
          item={modal.item}
          categories={categories}
          menuItems={menuItems}
          stockItems={stockItems}
          customisations={groups}
          onSaved={finishMenuChange}
          onDeleted={finishMenuChange}
          onClose={closeModal}
        />
      )}
      {modal?.kind === 'stock' && (
        <StockItemModal
          item={modal.item}
          onSave={saveStock}
          onDelete={removeStock}
          onClose={closeModal}
        />
      )}

      {imageQueueItems && (
        <ImageQueue
          items={imageQueueItems}
          categories={categories}
          menuItems={menuItems}
          stockItems={stockItems}
          onItemSaved={() => Promise.all([loadMenu(), loadStock()])}
          onClose={closeImageQueue}
        />
      )}

      <input ref={importInputRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={pickImportFile} />

      {toast && <Toast corner title={toast.title} message={toast.message} type={toast.type} />}
    </div>
  );
}

export default MenuStock;

// Import: the stock and menu import page: upload, review, save, shown at /admin/import.

import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/PageHeader.jsx';
import Toast from '../../../shared/components/Toast.jsx';
import UploadStep from './UploadStep.jsx';
import ImageQueue from '../MenuStock/ImageQueue.jsx';
import ReviewStep from './ReviewStep.jsx';
import { getStockItems, importStockItems } from '../../../shared/lib/stock.js';
import { getMenu, importMenuItems } from '../../../shared/lib/menu.js';
import { readStockFile, analyseRows, resolveRows, rowsToSave } from '../../../shared/lib/stockImport.js';
import { readMenuFile, analyseMenu, resolveMenuRows, menuItemsToSave } from '../../../shared/lib/menuImport.js';
import { takePendingImport, countRows, ImportFileError } from '../../../shared/lib/importFile.js';
import './Import.css';

// The stock and menu imports: Upload -> Review -> saved. It starts either here (choose a file) or from
// the Stock / Menu view ("···" > Import CSV/Excel), which hands over the file it picked.
function Import() {
  const location = useLocation();
  const navigate = useNavigate();
  const startedFrom = location.state?.from ?? null; // 'stock' | 'menu' | null (started on this page)
  const [kind, setKind] = useState(startedFrom ?? 'stock'); // what is being imported

  const [step, setStep] = useState('Upload');
  const [file, setFile] = useState(null);
  const [error, setError] = useState(''); // on the upload step
  const [reading, setReading] = useState(false);

  const [parsed, setParsed] = useState(null);
  const [existingItems, setExistingItems] = useState([]);
  const [stockItems, setStockItems] = useState([]); // for the menu import's stock codes
  const [analysed, setAnalysed] = useState([]);
  const [decisions, setDecisions] = useState({}); // row key -> 'update' | 'new'
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState(null);
  // new items without an image after a menu import started on this page: { items, categories, menuItems, stockItems }
  const [imageOffer, setImageOffer] = useState(null);

  // the rows as they will be imported, with the "Did you mean...?" choices applied
  const rows = useMemo(
    () => (kind === 'menu' ? resolveMenuRows(analysed, decisions, stockItems) : resolveRows(analysed, decisions, existingItems)),
    [kind, analysed, decisions, existingItems, stockItems]
  );
  const counts = countRows(rows);

  // read a file and go to the Review step. If it can't be used, say why on the upload step.
  async function startReview(chosenFile, importKind) {
    setError('');
    setReading(true);
    try {
      if (importKind === 'menu') {
        const result = await readMenuFile(chosenFile);
        const [menu, stock] = await Promise.all([getMenu(), getStockItems()]);
        setParsed(result);
        setExistingItems(menu.items);
        setStockItems(stock);
        setAnalysed(analyseMenu(result, menu.items, menu.categories, stock));
      } else {
        const result = await readStockFile(chosenFile);
        const items = await getStockItems();
        setParsed(result);
        setExistingItems(items);
        setAnalysed(analyseRows(result, items));
      }
      setKind(importKind);
      setDecisions({});
      setStep('Review');
    } catch (problem) {
      setStep('Upload');
      setError(problem instanceof ImportFileError ? problem.message : "Couldn't read the current stock and menu. Check your connection and try again.");
    }
    setReading(false);
  }

  // a file picked in the Stock view
  useEffect(() => {
    const picked = takePendingImport();
    if (picked) {
      setFile(picked.file);
      setKind(picked.kind);
      startReview(picked.file, picked.kind);
    }
  }, []);

  // the toast goes away by itself
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), toast.type === 'success' ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  function backToUpload() {
    setFile(null);
    setParsed(null);
    setAnalysed([]);
    setDecisions({});
    setStep('Upload');
  }

  // Cancel goes back to where the import started
  const viewPath = startedFrom === 'stock' ? '/admin/menu?view=stock' : '/admin/menu';

  function cancel() {
    if (startedFrom) navigate(viewPath);
    else backToUpload();
  }

  async function runImport() {
    setImporting(true);
    try {
      if (kind === 'menu') await importMenuItems(menuItemsToSave(rows));
      else await importStockItems(rowsToSave(rows));
    } catch (problem) {
      console.error('Import failed', problem);
      // while developing, the toast also says why
      const reason = import.meta.env.DEV ? ` (${problem.message})` : '';
      setToast({ type: 'error', message: `Couldn't import. Nothing was changed. Please try again.${reason}` });
      setImporting(false);
      return;
    }

    const done = { title: 'Import completed', message: `${counts.new} added · ${counts.update} updated · ${counts.skipped} skipped` };

    // a menu import that added items: the new items have no image yet, so offer to add them
    let fresh = null;
    if (kind === 'menu' && counts.new > 0) {
      const before = new Set(existingItems.map((item) => item.id));
      try {
        const [menu, stock] = await Promise.all([getMenu(), getStockItems()]);
        const items = menu.items.filter((item) => !before.has(item.id) && !item.image);
        if (items.length > 0) fresh = { items, categories: menu.categories, menuItems: menu.items, stockItems: stock };
      } catch {
        // the import is saved; only the offer to add images is skipped
      }
    }

    setImporting(false);
    if (startedFrom) {
      navigate(viewPath, { state: { importToast: done, newItemIds: fresh ? fresh.items.map((item) => item.id) : null } });
    } else {
      backToUpload();
      setToast({ type: 'success', ...done });
      if (fresh) setImageOffer(fresh);
    }
  }

  return (
    <div className="import_page">
      <div className="import_head">
        <PageHeader title="Import items" subtitle="Add or update menu items and stock from a spreadsheet" />
      </div>

      {step === 'Upload' && (
        <UploadStep
          kind={kind}
          onKindChange={(chosen) => {
            setKind(chosen);
            setError('');
          }}
          file={file}
          error={error}
          reading={reading}
          onFileChange={(chosen) => {
            setError('');
            setFile(chosen);
          }}
          onContinue={() => startReview(file, kind)}
        />
      )}
      {step === 'Review' && (
        <ReviewStep
          kind={kind}
          parsed={parsed}
          rows={rows}
          counts={counts}
          importing={importing}
          onChoose={(key, choice) => setDecisions({ ...decisions, [key]: choice })}
          onUndoChoice={(key) => {
            const { [key]: removed, ...rest } = decisions;
            setDecisions(rest);
          }}
          onCancel={cancel}
          onImport={runImport}
        />
      )}

      {imageOffer && (
        <ImageQueue
          items={imageOffer.items}
          categories={imageOffer.categories}
          menuItems={imageOffer.menuItems}
          stockItems={imageOffer.stockItems}
          onItemSaved={async () => {}}
          onClose={({ finished, message }) => {
            setImageOffer(null);
            if (finished) navigate('/admin/menu', { state: { imageToast: message } });
          }}
        />
      )}

      {toast && <Toast type={toast.type} title={toast.title} message={toast.message} corner />}
    </div>
  );
}

export default Import;

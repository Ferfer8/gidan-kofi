// UploadStep: step 1 of the import: choose stock or menu, download a template or pick a file, used by Import.jsx.

import { useState, useRef } from 'react';
import Icon from '../../../shared/components/Icon.jsx';
import Button from '../../../shared/components/Button.jsx';
import { isSupportedFile } from '../../utils/import.js';
import { downloadStockTemplate } from '../../../shared/lib/stockExcel.js';
import { downloadMenuTemplate } from '../../../shared/lib/menuExcel.js';
import { getMenu } from '../../../shared/lib/menu.js';
import { formatFileSize } from '../../../shared/utils/format.js';

// kind: 'stock' | 'menu' (what is being imported), changed with the switch at the top
function UploadStep({ kind, onKindChange, file, error: readError, reading, onFileChange, onContinue }) {
  const [typeError, setTypeError] = useState('');
  const [templateError, setTemplateError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  // Only accept CSV / Excel files. Anything else shows an error and keeps the old choice.
  function chooseFile(newFile) {
    if (!newFile) return;

    if (isSupportedFile(newFile)) {
      setTypeError('');
      onFileChange(newFile);
    } else {
      setTypeError("That file type isn't supported. Use a CSV or Excel file.");
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    chooseFile(event.dataTransfer.files[0]);
  }

  function handleDragLeave(event) {
    // moving over the zone's own children also fires dragleave, so ignore that
    if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false);
  }

  function handleInputChange(event) {
    chooseFile(event.target.files[0]);
    event.target.value = ''; // lets the same file be picked again
  }

  async function downloadTemplate() {
    setTemplateError('');
    try {
      if (kind === 'menu') {
        // the Category dropdown needs the categories; without them the template still has the usual three
        const categories = await getMenu().then((menu) => menu.categories).catch(() => []);
        await downloadMenuTemplate(categories);
      } else {
        await downloadStockTemplate();
      }
    } catch {
      setTemplateError("Couldn't download the template. Please try again.");
    }
  }

  const error = typeError || readError || templateError;

  return (
    <div className="upload_step">
      {/* what is being imported */}
      <div className="import_kind">
        <p className="import_kind_title">What are you importing?</p>
        <div className="segmented">
          {[
            ['stock', 'Stock'],
            ['menu', 'Menu'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              className={`segmented_option ${kind === value ? 'selected' : ''}`}
              disabled={reading}
              onClick={() => onKindChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        className={`drop_zone ${isDragging ? 'active' : ''}`}
        onClick={() => inputRef.current.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <span className="drop_icon">
          <Icon name="import" size={40} />
        </span>

        {isDragging ? (
          <p className="drop_title">Drop to upload</p>
        ) : (
          <>
            <p className="drop_title">
              <span className="drop_text_desktop">Drop your file here</span>
              <span className="drop_text_phone">Tap to choose a file</span>
            </p>
            <p className="drop_hint">CSV or Excel (.csv, .xlsx, .xls)</p>
          </>
        )}

        {/* clicks bubble up to the drop zone, which opens the file picker */}
        <Button className="drop_button">Choose file</Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          hidden
          onChange={handleInputChange}
        />
      </div>

      {error && (
        <p className="import_error" role="alert">
          {error}
        </p>
      )}

      {file && (
        <div className="file_row">
          <Icon name="file" size={22} />
          <div className="file_info">
            <p className="file_name">{file.name}</p>
            <p className="file_size">{formatFileSize(file.size)}</p>
          </div>
          <button type="button" className="file_remove" aria-label="Remove file" onClick={() => onFileChange(null)}>
            <Icon name="close" size={18} />
          </button>
        </div>
      )}

      {file && (
        <Button className="continue_button" disabled={reading} onClick={onContinue}>
          {reading ? 'Reading file…' : 'Continue to review'}
        </Button>
      )}

      <p className="template_note">
        Not sure about the format?{' '}
        <button type="button" className="template_link" onClick={downloadTemplate}>
          Download the template
        </button>
      </p>
    </div>
  );
}

export default UploadStep;

// ReviewStep: step 2 of the import: the rows with their problems and "Did you mean...?" hints, used by Import.jsx.

import { useState } from 'react';
import Card from '../../../shared/components/Card.jsx';
import Button from '../../../shared/components/Button.jsx';
import Icon from '../../../shared/components/Icon.jsx';

// the count pills at the top: clicking one shows only those rows
const pillLabels = {
  new: (count) => `${count} new`,
  update: (count) => `${count} ${count === 1 ? 'update' : 'updates'}`,
  skipped: (count) => `${count} skipped`,
  check: (count) => `${count} to check`,
};

const resultLabels = { new: 'new', update: 'update', skipped: 'skipped', check: 'check', nochange: 'no changes' };
// the table's columns, for each kind of import
const columnsByKind = {
  stock: ['Name', 'Type', 'In stock', 'Result'],
  menu: ['Name', 'Category', 'Options & prices', 'Result'],
};

// The line under a row's result pill
function ResultNote({ row, kind }) {
  if (row.status === 'new') return <>{kind === 'menu' ? 'Will be added to the menu (no image yet)' : 'Will be added to stock'}</>;
  if (row.status === 'update') return <>{row.changes.join(' · ')}</>;
  if (row.status === 'nochange') return <>Nothing to change</>;
  if (row.status === 'skipped') return <>{row.reason}</>;
  return null;
}

// Step 2: what the file will do. rows come from resolveRows() (lib/stockImport.js) for stock and
// resolveMenuRows() (lib/menuImport.js) for the menu: one row per stock item / menu item.
function ReviewStep({ kind, parsed, rows, counts, importing, onChoose, onUndoChoice, onCancel, onImport }) {
  const columns = columnsByKind[kind];
  const [filter, setFilter] = useState(null); // null = all rows, or 'new' | 'update' | 'skipped' | 'check'

  const importCount = counts.new + counts.update;
  const needsChoice = counts.check > 0;
  const visibleRows = filter ? rows.filter((row) => row.status === filter) : rows;
  const allMatched = parsed.matchedCount === parsed.totalColumns;
  const pills = ['new', 'update', 'skipped', ...(needsChoice ? ['check'] : [])];

  return (
    <div className="review_step">
      <div className="import_summary">
        <div className="summary_file">
          <p className="summary_file_name">{parsed.fileName}</p>
          <p className="summary_matched">
            <Icon name="check" size={16} />
            {allMatched ? `All ${parsed.totalColumns} columns matched` : `${parsed.matchedCount} of ${parsed.totalColumns} columns matched`}
          </p>
          {parsed.ignoredColumns.length > 0 && (
            <p className="summary_ignored">
              Ignored {parsed.ignoredColumns.length === 1 ? 'column' : 'columns'}: {parsed.ignoredColumns.join(', ')}
            </p>
          )}
        </div>

        <div className="summary_pills">
          {pills.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={filter === status}
              className={`result_pill summary_pill ${status} ${filter === status ? 'active' : ''}`}
              onClick={() => setFilter(filter === status ? null : status)}
            >
              {pillLabels[status](counts[status])}
            </button>
          ))}
        </div>
      </div>

      <Card className="review_card">
        <div className="review_scroll">
          <table className="review_table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.key} className={`review_row ${row.status}`}>
                  <td>
                    <p className="review_name">{row.name}</p>
                    {row.code && <p className="review_code">{row.code}</p>}
                  </td>
                  <td>{kind === 'menu' ? row.categoryText : row.typeText}</td>
                  <td>{kind === 'menu' ? row.optionsText : row.quantityText}</td>
                  <td>
                    <span className={`result_pill ${row.status}`}>{resultLabels[row.status]}</span>

                    {row.status === 'check' ? (
                      <div className="review_check">
                        <p className="review_note">Did you mean {row.candidate.name}?</p>
                        <div className="review_choices">
                          <button type="button" className="review_choice" disabled={importing} onClick={() => onChoose(row.key, 'update')}>
                            Update that item
                          </button>
                          <button type="button" className="review_choice" disabled={importing} onClick={() => onChoose(row.key, 'new')}>
                            Add as new
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="review_note">
                        <ResultNote row={row} kind={kind} />
                        {row.chosen && (
                          <>
                            {' '}
                            <button type="button" className="review_undo" disabled={importing} onClick={() => onUndoChoice(row.key)}>
                              Change
                            </button>
                          </>
                        )}
                      </p>
                    )}

                    {(row.status === 'new' || row.status === 'update') && row.notes?.map((note) => (
                      <p key={note} className="review_note">
                        {note}
                      </p>
                    ))}
                    {row.kept?.length > 0 && row.status !== 'skipped' && (
                      <p className="review_kept">{row.kept.join(', ')} not in file, so kept as they are</p>
                    )}
                  </td>
                </tr>
              ))}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="review_empty">
                    No rows to show
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="review_footer">
        <p className="review_footer_note">
          Existing items are updated with the new values. Rows with problems are skipped, so fix them in the file and import again.
        </p>
        <div className="review_buttons">
          {needsChoice && <p className="review_choose_note">Choose an option for the highlighted rows first</p>}
          <Button variant="secondary" disabled={importing} onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={importing || needsChoice || importCount === 0} onClick={onImport}>
            {importing ? 'Importing…' : `Import ${importCount} ${importCount === 1 ? 'item' : 'items'}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ReviewStep;

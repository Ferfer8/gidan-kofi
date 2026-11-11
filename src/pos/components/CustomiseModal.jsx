// CustomiseModal: the item pop-up where size, milk, shots and extras are chosen before adding to the order, used
// by the POS Checkout page.

import { useEffect, useState } from 'react';
import Icon from '../../shared/components/Icon.jsx';
import { formatAmount } from '../../shared/utils/format.js';
import {
  defaultConfig, unitPrice, configKey, configTitle, pricedExtras, makeLine, optionName, isDrink,
  optionLeft, drawnInOrder, stockSiblings, roundHalfUp,
} from '../lib/order.js';
import './CustomiseModal.css';

// "AED 16" for a whole price, "AED 16.50" otherwise
const shortAed = (amount) => `AED ${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;

const LOW_AT = 5; // an option's "X left" turns orange-brown at this number or fewer

// The window for choosing size, milk, shots and so on. Several configurations can be added before
// "Add to Order" puts them all in the order; closing the window without it drops them.
//   mode 'add'   a new item        mode 'edit'  the pencil on an order line (line = that line)
//   lines        the order now (to know how many are left)
function CustomiseModal({ item, mode, line, lines, onAddToOrder, onReplace, onClose }) {
  const isEdit = mode === 'edit';
  const word = isDrink(item) ? 'Drink' : 'Item';

  const [config, setConfig] = useState(isEdit ? line.config : defaultConfig(item));
  // what has been added so far: [{ key, config, qty }]
  const [staged, setStaged] = useState(isEdit ? [{ key: line.key, config: line.config, qty: line.qty }] : []);
  const [pendingQty, setPendingQty] = useState(1); // the quantity a configuration had when it was taken back to change it
  const [message, setMessage] = useState('');

  useEffect(() => {
    const onKey = (event) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const lowestPrice = Math.min(...item.options.map((option) => option.price));
  const price = unitPrice(item, config);
  const showSizes = item.options.length > 1;

  // ---- choices
  function pickOption(optionId) {
    setConfig({ ...config, optionId });
    setMessage('');
  }

  function toggleModifier(group, modifierId) {
    const chosen = config.selections[group.id] ?? [];
    let next;
    if (group.selection === 'single') next = chosen.includes(modifierId) && !group.required ? [] : [modifierId];
    else next = chosen.includes(modifierId) ? chosen.filter((id) => id !== modifierId) : [...chosen, modifierId];
    setConfig({ ...config, selections: { ...config.selections, [group.id]: next } });
  }

  function stepCounter(group, delta) {
    const count = Math.min(group.counterMax ?? 99, Math.max(group.counterMin ?? 0, config.selections[group.id] + delta));
    setConfig({ ...config, selections: { ...config.selections, [group.id]: count } });
  }

  // ---- how many are left
  // how many of an option are already spoken for (the order, and what has been added here)
  function taken(optionId, exceptKey = null) {
    const siblings = stockSiblings(item, optionId); // (an option's own stock, normally just itself)
    const inOrder = drawnInOrder(item, lines, optionId, isEdit ? line.key : null);
    const here = staged.filter((entry) => siblings.includes(entry.config.optionId) && entry.key !== exceptKey).reduce((sum, entry) => sum + entry.qty, 0);
    return inOrder + here;
  }

  function limitFor(optionId, extra, exceptKey = null) {
    const left = optionLeft(item, optionId);
    if (left === null || taken(optionId, exceptKey) + extra <= left) return '';
    return `Only ${left} left`;
  }

  // ---- the summary
  function addCurrent() {
    const key = configKey(item.id, config);

    if (isEdit) {
      // changing the line: it stays one entry, with the same quantity
      const problem = limitFor(config.optionId, staged[0].qty, staged[0].key);
      if (problem) return setMessage(problem);
      setStaged([{ key, config, qty: staged[0].qty }]);
      return setMessage('');
    }

    const existing = staged.find((entry) => entry.key === key);
    const adding = existing ? 1 : pendingQty;
    const problem = limitFor(config.optionId, adding);
    if (problem) return setMessage(problem);

    setMessage('');
    setPendingQty(1);
    setStaged(existing ? staged.map((entry) => (entry.key === key ? { ...entry, qty: entry.qty + 1 } : entry)) : [...staged, { key, config, qty: adding }]);
  }

  function changeQty(entry, delta) {
    if (delta > 0) {
      const problem = limitFor(entry.config.optionId, 1);
      if (problem) return setMessage(problem);
    }
    setMessage('');
    setStaged(staged.map((candidate) => (candidate.key === entry.key ? { ...candidate, qty: candidate.qty + delta } : candidate)).filter((candidate) => candidate.qty > 0));
  }

  // the pencil: bring the configuration back to the left side to change it
  function takeBack(entry) {
    setConfig(entry.config);
    setPendingQty(entry.qty);
    setStaged(staged.filter((candidate) => candidate.key !== entry.key));
    setMessage('');
  }

  const totalQty = staged.reduce((sum, entry) => sum + entry.qty, 0);
  const itemTotal = roundHalfUp(staged.reduce((sum, entry) => sum + unitPrice(item, entry.config) * entry.qty, 0));

  function finish() {
    if (staged.length === 0) return;
    if (isEdit) onReplace(line.key, makeLine(item, staged[0].config, staged[0].qty));
    else onAddToOrder(staged.map((entry) => makeLine(item, entry.config, entry.qty)));
  }

  return (
    <div className="customise_backdrop" onClick={onClose}>
      <div className="customise_modal" role="dialog" aria-modal="true" aria-label={item.name} onClick={(event) => event.stopPropagation()}>
        <section className="customise_main">
          <header className="customise_head">
            <div className="customise_image">{item.image ? <img src={item.image} alt="" /> : item.name.charAt(0)}</div>
            <div className="customise_intro">
              <h2 className="customise_name">{item.name}</h2>
              <p className="customise_description">
                {item.description} <span className="customise_from">from {shortAed(lowestPrice)}</span>
              </p>
            </div>
            <button type="button" className="customise_reset" onClick={() => setConfig(defaultConfig(item))}>
              <Icon name="reset" size={16} />
              Reset
            </button>
          </header>

          <div className="customise_body">
            {item.served === 'both' && (
              <div className="modifier_group">
                <h3 className="modifier_group_title">Served</h3>
                <div className="modifier_pills">
                  {[
                    ['hot', 'Hot', 0],
                    ['iced', 'Iced', item.coldExtra],
                  ].map(([value, label, extra]) => (
                    <button
                      key={value}
                      type="button"
                      className={`modifier_pill ${config.temperature === value ? 'selected' : ''}`}
                      onClick={() => setConfig({ ...config, temperature: value })}
                    >
                      {label}
                      {extra > 0 && ` +${Number.isInteger(extra) ? extra : extra.toFixed(2)}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showSizes && (
              <div className="modifier_group">
                <h3 className="modifier_group_title">{isDrink(item) ? 'Size' : 'Option'}</h3>
                <div className="modifier_pills sizes">
                  {item.options.map((option) => {
                    const standard = ['m', 'medium'].includes(option.label.toLowerCase());
                    // this option's own count, less what is in the order and what has been added here
                    const remaining = option.left === null ? null : Math.max(0, option.left - taken(option.id, isEdit ? staged[0]?.key : null));
                    const soldOut = remaining === 0;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        className={`modifier_pill size ${config.optionId === option.id ? 'selected' : ''} ${soldOut ? 'sold_out' : ''}`}
                        disabled={soldOut}
                        onClick={() => pickOption(option.id)}
                      >
                        <span className="modifier_pill_label">{optionName(option.label)}</span>
                        <span className="modifier_pill_note">{soldOut ? 'Sold out' : `${standard ? 'Standard · ' : ''}${shortAed(option.price)}`}</span>
                        {remaining !== null && !soldOut && <span className={`modifier_pill_left ${remaining <= LOW_AT ? 'low' : ''}`}>{remaining} left</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="modifier_groups">
              {item.groups.map((group) => {
                const compact = group.selection === 'counter' || group.modifiers.length <= 3;
                return (
                  <div key={group.id} className={`modifier_group ${compact ? 'compact' : ''}`}>
                    <h3 className="modifier_group_title">{group.name}</h3>

                    {group.selection === 'counter' ? (
                      <div className="counter_control">
                        <button type="button" className="counter_button" aria-label={`Fewer ${group.name}`} disabled={config.selections[group.id] <= (group.counterMin ?? 0)} onClick={() => stepCounter(group, -1)}>
                          <Icon name="minus" size={16} />
                        </button>
                        <span className="counter_value">{config.selections[group.id]}</span>
                        <button type="button" className="counter_button" aria-label={`More ${group.name}`} disabled={config.selections[group.id] >= (group.counterMax ?? 99)} onClick={() => stepCounter(group, 1)}>
                          <Icon name="plus" size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="modifier_pills">
                        {group.modifiers.map((modifier) => (
                          <button
                            key={modifier.id}
                            type="button"
                            className={`modifier_pill ${(config.selections[group.id] ?? []).includes(modifier.id) ? 'selected' : ''}`}
                            onClick={() => toggleModifier(group, modifier.id)}
                          >
                            {modifier.name}
                            {modifier.extraPrice > 0 && ` +${Number.isInteger(modifier.extraPrice) ? modifier.extraPrice : modifier.extraPrice.toFixed(2)}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <footer className="customise_foot">
            <div>
              <p className="customise_foot_title">{configTitle(item, config)}</p>
              <p className="customise_foot_price">AED {formatAmount(price)}</p>
            </div>
            {message && <p className="customise_message">{message}</p>}
            <button type="button" className="customise_add" onClick={addCurrent}>
              {isEdit ? `Update ${word.toLowerCase()}` : `Add ${word.toLowerCase()}`}
            </button>
          </footer>
        </section>

        <aside className="customise_summary">
          <h3 className="customise_summary_title">Summary</h3>

          <div className="summary_cards">
            {staged.map((entry) => {
              const unit = unitPrice(item, entry.config);
              const option = item.options.find((candidate) => candidate.id === entry.config.optionId);
              return (
                <div key={entry.key} className="summary_card">
                  <div className="summary_card_head">
                    <p className="summary_card_name">
                      {configTitle(item, entry.config)} <span className="summary_card_qty">x {entry.qty}</span>
                    </p>
                    <span className="summary_card_total">{formatAmount(roundHalfUp(unit * entry.qty))}</span>
                  </div>
                  {option.label.toLowerCase() !== 'regular' && (
                    <p className="summary_card_line">
                      <span>{optionName(option.label)} x {entry.qty}</span>
                      <span>{formatAmount(roundHalfUp(option.price * entry.qty))}</span>
                    </p>
                  )}
                  {pricedExtras(item, entry.config).map((extra) => (
                    <p key={extra.name} className="summary_card_line">
                      <span>{extra.name} x {entry.qty}</span>
                      <span>+{formatAmount(roundHalfUp(extra.price * entry.qty))}</span>
                    </p>
                  ))}
                  <div className="summary_card_foot">
                    <div className="line_steps">
                      <button type="button" className="step_button" aria-label="One less" onClick={() => changeQty(entry, -1)}>
                        <Icon name="minus" size={14} />
                      </button>
                      <span className="line_qty">{entry.qty}</span>
                      <button type="button" className="step_button" aria-label="One more" onClick={() => changeQty(entry, 1)}>
                        <Icon name="plus" size={14} />
                      </button>
                    </div>
                    <div className="summary_card_icons">
                      <button type="button" aria-label="Change" onClick={() => takeBack(entry)}>
                        <Icon name="pencil" size={16} />
                      </button>
                      <button type="button" aria-label="Remove" onClick={() => setStaged(staged.filter((candidate) => candidate.key !== entry.key))}>
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="summary_foot">
            <p className="summary_row">
              <span>Quantity</span>
              <span>
                {totalQty} {word}s
              </span>
            </p>
            <p className="summary_row total">
              <span>Item Total</span>
              <strong>AED {formatAmount(itemTotal)}</strong>
            </p>
            <button type="button" className="customise_finish" disabled={staged.length === 0} onClick={finish}>
              {isEdit ? 'Save changes' : 'Add to Order'}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default CustomiseModal;

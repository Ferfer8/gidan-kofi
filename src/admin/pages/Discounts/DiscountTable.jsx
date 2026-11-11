// DiscountTable: the table of voucher codes, used by the Discounts page.

import Button from '../../../shared/components/Button.jsx';
import Toggle from '../../../shared/components/Toggle.jsx';
import { isExpired, formatValue, formatUsed, formatValidUntil } from '../../utils/discounts.js';

const columns = ['Code', 'Type', 'Value', 'Used', 'Valid until', 'Active', ''];

function DiscountTable({ discounts, onToggle, onEdit, onQr }) {
  return (
    <div className="discount_scroll">
      <table className="discount_table">
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={index}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {discounts.map((discount) => {
            const expired = isExpired(discount);

            return (
              <tr
                key={discount.id}
                className="discount_row"
                tabIndex={0}
                onClick={() => onEdit(discount)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && event.target === event.currentTarget) onEdit(discount);
                }}
              >
                <td>
                  <span className={`code_tag ${expired ? 'expired' : ''}`}>{discount.code}</span>
                  {discount.description && <p className="code_description">{discount.description}</p>}
                </td>
                <td>{discount.type}</td>
                <td className="discount_value">{formatValue(discount)}</td>
                <td>{formatUsed(discount.used)}</td>
                <td className={expired ? 'ended' : ''}>{formatValidUntil(discount)}</td>
                <td>
                  {/* the toggle has its own click, so don't let it open the edit modal */}
                  <div onClick={(event) => event.stopPropagation()}>
                    <Toggle
                      checked={discount.active && !expired}
                      onChange={() => onToggle(discount)}
                      label={`${discount.code} active`}
                    />
                  </div>
                </td>
                <td className="discount_action">
                  <div className="discount_buttons">
                    <Button
                      variant="secondary"
                      className="button_small"
                      onClick={(event) => {
                        event.stopPropagation();
                        onQr(discount);
                      }}
                    >
                      QR code
                    </Button>
                    <Button
                      variant="secondary"
                      className="button_small"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(discount);
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DiscountTable;

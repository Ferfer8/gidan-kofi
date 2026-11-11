// StockView: the Stock view: the table of stock items with filters, used by the Menu & Stock page.

import Card from '../../../shared/components/Card.jsx';
import SearchInput from '../../../shared/components/SearchInput.jsx';
import FilterPills from '../../../shared/components/FilterPills.jsx';
import StatusPill from '../../../shared/components/StatusPill.jsx';
import Button from '../../../shared/components/Button.jsx';
import { stockTypes } from '../../../shared/data/stock.js';
import { filterStockItems, getStockStatus, stockStatusLabels, formatUnit, formatPack } from '../../../shared/utils/stock.js';

// Pill ids match the filter values in filterStockItems. The type pills come from the stock types
const stockPills = [
  { id: 'all', label: 'All' },
  { id: 'low', label: 'Low' },
  ...stockTypes.map((type) => ({ id: type, label: type })),
];
const columns = ['Stock item', 'Type', 'In stock', 'Status', ''];

// filter and search live in the parent, so the export can use exactly what is shown
function StockView({ items, filter, onFilterChange, search, onSearchChange, onEdit }) {
  const visibleItems = filterStockItems(items, filter, search);

  return (
    <>
      <div className="toolbar">
        <SearchInput value={search} onChange={onSearchChange} placeholder="Search stock" />
        <FilterPills options={stockPills} value={filter} onChange={onFilterChange} />
      </div>

      <Card className="stock_card">
        <div className="stock_scroll">
          <table className="stock_table">
            <thead>
              <tr>
                {columns.map((column, index) => (
                  <th key={index}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => {
                const status = stockStatusLabels[getStockStatus(item)];

                return (
                  <tr
                    key={item.id}
                    className="stock_row"
                    tabIndex={0}
                    onClick={() => onEdit(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') onEdit(item);
                    }}
                  >
                    <td>
                      <p className="stock_name">{item.name}</p>
                      <p className="stock_pack">{formatPack(item)}</p>
                    </td>
                    <td>
                      <StatusPill type="neutral">{item.type}</StatusPill>
                    </td>
                    <td className="stock_quantity">
                      {item.quantity} {formatUnit(item.unit)}
                    </td>
                    <td>
                      <StatusPill type={status.pill}>{status.text}</StatusPill>
                    </td>
                    <td className="stock_action">
                      <Button
                        variant="ghost"
                        className="button_small"
                        onClick={(event) => {
                          event.stopPropagation();
                          onEdit(item);
                        }}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleItems.length === 0 && <p className="empty_message">No stock items match</p>}
        </div>
      </Card>
    </>
  );
}

export default StockView;

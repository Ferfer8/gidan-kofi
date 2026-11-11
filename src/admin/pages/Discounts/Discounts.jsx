// Discounts: the Discounts page: voucher codes and the manager discount rules, shown at /admin/discounts.

import { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader.jsx';
import Button from '../../../shared/components/Button.jsx';
import Card from '../../../shared/components/Card.jsx';
import DiscountTable from './DiscountTable.jsx';
import RulesCard from './RulesCard.jsx';
import DiscountModal from './DiscountModal.jsx';
import QrCodeModal from './QrCodeModal.jsx';
import PageStatus from '../../../shared/components/PageStatus.jsx';
import { getDiscounts, saveDiscount as saveDiscountRow, setDiscountActive, deleteDiscount as deleteDiscountRow } from '../../../shared/lib/discounts.js';
import { isExpired, countActive, sortDiscounts } from '../../utils/discounts.js';
import './Discounts.css';

function Discounts() {
  // The vouchers come from the discounts table (and every change is saved there), so a QR code always holds a real voucher
  const [discounts, setDiscounts] = useState([]);
  const [categories, setCategories] = useState([]); // the database's categories, to turn names into ids
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // null, or { discount } where discount is null when creating a new code
  const [modal, setModal] = useState(null);
  const [qrFor, setQrFor] = useState(null); // the voucher whose QR code is open
  const [notice, setNotice] = useState('');

  async function load() {
    setError('');
    try {
      const data = await getDiscounts();
      setDiscounts(data.discounts);
      setCategories(data.categories);
    } catch (problem) {
      setError(problem.message);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // The "this code has ended" message goes away by itself
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Every change is saved in the database, then the list is loaded again. If saving fails the message is shown.
  async function run(change) {
    try {
      await change();
      await load();
    } catch (problem) {
      setNotice(problem.message);
    }
  }

  function toggleActive(discount) {
    if (isExpired(discount)) {
      setNotice('This code has ended. Edit it and change the end date to use it again.');
      return;
    }
    run(() => setDiscountActive(discount.id, !discount.active));
  }

  // Edit updates the voucher with the same id; Create adds a new row
  async function saveDiscount(savedDiscount) {
    try {
      await saveDiscountRow(savedDiscount, categories);
      await load();
      setModal(null);
    } catch (problem) {
      setNotice(problem.message);
    }
  }

  function deleteDiscount(id) {
    setModal(null);
    run(() => deleteDiscountRow(id));
  }

  // Used codes can't be deleted (old receipts use them), so they are switched off instead
  function archiveDiscount(id) {
    setModal(null);
    run(() => setDiscountActive(id, false));
  }

  return (
    <div className="discounts_page">
      <PageHeader
        title="Discounts"
        subtitle={`Codes baristas can scan or type on the POS · ${countActive(discounts)} active`}
      >
        <Button onClick={() => setModal({ discount: null })}>+ Create discount</Button>
      </PageHeader>

      <Card className="discount_card">
        {notice && (
          <p className="discount_notice" role="status">
            {notice}
          </p>
        )}
        {(loading || error) && (
          <PageStatus
            loading={loading}
            error={error}
            onRetry={() => {
              setLoading(true);
              load();
            }}
          />
        )}
        {!loading && !error && (
          <DiscountTable discounts={sortDiscounts(discounts)} onToggle={toggleActive} onEdit={(discount) => setModal({ discount })} onQr={setQrFor} />
        )}
      </Card>

      <RulesCard />

      {qrFor && <QrCodeModal discount={discounts.find((item) => item.id === qrFor.id) ?? qrFor} onClose={() => setQrFor(null)} />}

      {modal && (
        <DiscountModal
          discount={modal.discount}
          takenCodes={discounts.filter((item) => item.id !== modal.discount?.id).map((item) => item.code)}
          onSave={saveDiscount}
          onDelete={deleteDiscount}
          onArchive={archiveDiscount}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

export default Discounts;

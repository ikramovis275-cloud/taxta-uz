import { useState, useEffect } from 'react';
import api from '../api/axios';
import '../styles/Sales.css';

export default function Debtors() {
  const [debtors, setDebtors] = useState([]);
  const [usdRate, setUsdRate] = useState(12800);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [salesRes, settingsRes] = await Promise.all([
        api.get('/sales'),
        api.get('/settings'),
      ]);
      const filteredDebtors = salesRes.data.filter(s => s.debt_sum >= 1);
      setDebtors(filteredDebtors);
      setUsdRate(settingsRes.data.usd_rate);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePayment = async (e) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) return alert("Тўғри сумма киритинг!");
    
    try {
      const newPaid = selectedSale.paid_sum + amount;
      if (newPaid > selectedSale.total_sum) {
         if (!confirm("Киритилган сумма жами қарздан кўп. Давом этайми?")) return;
      }
      
      await api.put(`/sales/${selectedSale.id}`, { paid_sum: newPaid });
      alert("Тўлов қабул қилинди!");
      setSelectedSale(null);
      setPaymentAmount('');
      fetchAll();
    } catch (err) {
      alert("Хатолик: " + (err.response?.data?.error || err.message));
    }
  };

  const filtered = debtors.filter(s => {
    const q = search.toLowerCase();
    return s.client_name.toLowerCase().includes(q) || 
           (s.client_phone && s.client_phone.includes(q));
  });

  const totalDebt = debtors.reduce((s, sale) => s + sale.debt_sum, 0);

  if (loading) return <div className="page-loading"><div className="spinner"></div><p>Юкланмоқда...</p></div>;

  return (
    <div className="sales-page">
      <div className="page-header">
        <div>
          <h1>🔴 Қарздорлар Рўйхати</h1>
          <p>Ҳали тўлиқ тўланмаган сотувлар рўйхати</p>
        </div>
      </div>

      <div className="sales-summary-bar" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
        <div className="summary-chip">👤 Қарздорлар: <strong>{debtors.length} та</strong></div>
        <div className="summary-chip">💰 Умумий қарз: <strong style={{ color: '#ef4444' }}>{Math.round(totalDebt).toLocaleString()} сўм</strong></div>
        <div className="summary-chip">💵 Доллар ($): <strong>${(totalDebt / usdRate).toFixed(2)}</strong></div>
      </div>

      <div className="search-wrapper" style={{marginBottom: '1.5rem'}}>
        <span>🔍</span>
        <input
          type="text"
          placeholder="Исм ёки телефон бўйича қидириш..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Телефон</th>
              <th>Сана</th>
              <th>Жами Сумма</th>
              <th>Тўланган</th>
              <th style={{ color: '#f87171' }}>Қолган Қарз</th>
              <th>Тўлов</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="7" className="empty-row">Қарздорлар топилмади</td></tr>
            ) : filtered.map(sale => (
              <tr key={sale.id}>
                <td><strong>{sale.client_name}</strong></td>
                <td>{sale.client_phone || '---'}</td>
                <td>{new Date(sale.sold_at).toLocaleDateString()}</td>
                <td>{Math.round(sale.total_sum).toLocaleString()}</td>
                <td>{Math.round(sale.paid_sum).toLocaleString()}</td>
                <td style={{ color: '#f87171', fontWeight: 'bold' }}>{Math.round(sale.debt_sum).toLocaleString()} сўм</td>
                <td>
                  <button className="btn-edit" title="Тўлов қўшиш" onClick={() => setSelectedSale(sale)}>💰</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedSale && (
        <div className="modal-overlay" onClick={() => setSelectedSale(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💰 Тўловни янгилаш</h2>
              <button className="close-btn" onClick={() => setSelectedSale(null)}>×</button>
            </div>
            <form onSubmit={handleUpdatePayment}>
              <div className="sale-mini-info">
                 <p>👤 Клиент: <strong>{selectedSale.client_name}</strong></p>
                 <p>💵 Жами қарз: <strong style={{color: '#f87171'}}>{Math.round(selectedSale.debt_sum).toLocaleString()} сўм</strong></p>
              </div>
              <div className="form-group" style={{marginBottom: '0'}}>
                <label style={{display: 'block', marginBottom: '0.6rem', color: '#94a3b8', fontSize: '0.85rem'}}>Қанча тўлайди? (сўм)</label>
                <input 
                   type="number" 
                   value={paymentAmount} 
                   onChange={e => setPaymentAmount(e.target.value)} 
                   placeholder="Масалан: 50000" 
                   autoFocus 
                   required 
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setSelectedSale(null)}>Бекор қилиш</button>
                <button type="submit" className="btn-submit">✅ Тўловни сақлаш</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

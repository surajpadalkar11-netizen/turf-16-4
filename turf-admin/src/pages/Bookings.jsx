import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { Filter, Search, ChevronLeft, ChevronRight, IndianRupee, CheckCircle2, AlertCircle } from 'lucide-react';

const STATUS_OPTS = ['', 'confirmed', 'pending', 'completed', 'cancelled'];
const PAY_OPTS = ['', 'paid', 'partially_paid', 'unpaid'];
const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));

function PayBadge({ status }) {
  const map = {
    paid: { cls: 'badge-success', label: '✅ Paid' },
    partially_paid: { cls: 'badge-warning', label: '⚠️ Partial' },
    unpaid: { cls: 'badge-danger', label: '❌ Unpaid' },
  };
  const b = map[status] || { cls: 'badge-muted', label: status };
  return <span className={`badge ${b.cls}`}>{b.label}</span>;
}

function StatusBadge({ status }) {
  const map = {
    confirmed: 'badge-success',
    pending: 'badge-warning',
    completed: 'badge-primary',
    cancelled: 'badge-danger',
  };
  return <span className={`badge ${map[status] || 'badge-muted'}`}>{status}</span>;
}

function CollectModal({ booking, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const remaining = booking.remainingAmount || 0;

  const handleCollect = async () => {
    if (!amount || Number(amount) <= 0) return;
    setLoading(true);
    try {
      await api.put(`/turf-owner/booking/${booking.id}/collect`, { amountCollected: Number(amount) });
      onSaved();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-alt)', border: '1px solid var(--border)', borderRadius: 16,
        padding: 28, width: '100%', maxWidth: 380,
      }}>
        <h3 style={{ marginBottom: 16, fontWeight: 700 }}>💰 Collect Payment</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
          Booking: <strong>TRF-{booking.id?.substring(0, 5).toUpperCase()}</strong>
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
          Customer: <strong>{booking.user?.name}</strong>
        </p>
        <p style={{ fontSize: 13, color: '#f59e0b', marginBottom: 20 }}>
          Remaining: <strong>₹{fmt(remaining)}</strong>
        </p>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            Amount Collected (₹)
          </label>
          <input
            type="number"
            min="1"
            max={remaining}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={`Max ₹${fmt(remaining)}`}
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            onClick={handleCollect}
            disabled={loading || !amount}
          >
            {loading ? 'Saving...' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Bookings() {
  const { selectedTurf } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({ status: '', paymentStatus: '', date: '', month: '', search: '' });
  const [collectModal, setCollectModal] = useState(null);

  const fetchBookings = async () => {
    if (!selectedTurf?.id) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filters.status) params.set('status', filters.status);
      if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
      if (filters.date) params.set('date', filters.date);
      if (filters.month) params.set('month', filters.month);

      const { data } = await api.get(`/turf-owner/bookings/${selectedTurf.id}?${params}`);
      let b = data.bookings || [];
      if (filters.search) {
        const q = filters.search.toLowerCase();
        b = b.filter(bk =>
          bk.user?.name?.toLowerCase().includes(q) ||
          bk.user?.email?.toLowerCase().includes(q) ||
          bk.id?.toLowerCase().includes(q)
        );
      }
      setBookings(b);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(); }, [selectedTurf?.id, page, filters.status, filters.paymentStatus, filters.date, filters.month]);

  const updateStatus = async (id, status) => {
    await api.put(`/turf-owner/booking/${id}/status`, { status });
    fetchBookings();
  };

  const setFilter = (key, val) => {
    setFilters(p => ({ ...p, [key]: val }));
    setPage(1);
  };

  return (
    <div className="animate-fadeIn">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Bookings</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
          {selectedTurf?.name} — {total} total bookings
        </p>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Status</label>
            <select value={filters.status} onChange={e => setFilter('status', e.target.value)}>
              {STATUS_OPTS.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Payment</label>
            <select value={filters.paymentStatus} onChange={e => setFilter('paymentStatus', e.target.value)}>
              {PAY_OPTS.map(s => <option key={s} value={s}>{s ? s.replace('_', ' ') : 'All Payments'}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Date</label>
            <input type="date" value={filters.date} onChange={e => setFilter('date', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Month</label>
            <input type="month" value={filters.month} onChange={e => setFilter('month', e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontWeight: 600 }}>Search</label>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                style={{ paddingLeft: 32 }}
                placeholder="Name, email, ID..."
                value={filters.search}
                onChange={e => setFilter('search', e.target.value)}
              />
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { setFilters({ status: '', paymentStatus: '', date: '', month: '', search: '' }); setPage(1); }}>
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" />
        </div>
      ) : bookings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          No bookings found
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Date & Time</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const code = `TRF-${b.id?.substring(0, 5).toUpperCase()}`;
                  const slots = (b.timeSlots || []).map(s => `${s.start}–${s.end}`).join(', ');
                  const remaining = (b.totalAmount || 0) - (b.amountPaid || 0);
                  return (
                    <tr key={b.id}>
                      <td>
                        <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: 'var(--primary)' }}>{code}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {new Date(b.createdAt).toLocaleDateString('en-IN')}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{b.user?.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.user?.email}</div>
                        {b.user?.phone && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.user?.phone}</div>}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>
                          {new Date(b.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{slots}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>₹{fmt(b.totalAmount)}</div>
                        <div style={{ fontSize: 11, color: '#10b981' }}>Paid: ₹{fmt(b.amountPaid)}</div>
                        {remaining > 0 && <div style={{ fontSize: 11, color: '#f59e0b' }}>Due: ₹{fmt(remaining)}</div>}
                      </td>
                      <td><PayBadge status={b.paymentStatus} /></td>
                      <td><StatusBadge status={b.status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {b.status === 'confirmed' && (
                            <button className="btn btn-ghost btn-sm" onClick={() => updateStatus(b.id, 'completed')}>
                              ✅ Complete
                            </button>
                          )}
                          {b.paymentStatus !== 'paid' && b.status !== 'cancelled' && (
                            <button className="btn btn-success btn-sm" onClick={() => setCollectModal(b)}>
                              <IndianRupee size={11} /> Collect
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16, borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Page {page} of {totalPages}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {collectModal && (
        <CollectModal
          booking={collectModal}
          onClose={() => setCollectModal(null)}
          onSaved={() => { setCollectModal(null); fetchBookings(); }}
        />
      )}
    </div>
  );
}

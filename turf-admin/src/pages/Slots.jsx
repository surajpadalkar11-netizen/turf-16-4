import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { ChevronLeft, ChevronRight, IndianRupee } from 'lucide-react';

const STATUS_COLOR = {
  available: { bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)', text: '#94a3b8', label: 'Available' },
  booked:    { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)',  text: '#10b981', label: 'Booked' },
  pending:   { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',  text: '#f59e0b', label: 'Pending' },
  completed: { bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.3)',  text: '#8b5cf6', label: 'Completed' },
};

function SlotCard({ slot, onComplete, onCollect }) {
  const s = STATUS_COLOR[slot.slotStatus] || STATUS_COLOR.available;
  const bk = slot.booking;
  const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));

  return (
    <div style={{
      background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 12,
      padding: '12px 14px', transition: 'all 0.15s',
    }}>
      {/* Time */}
      <div style={{ fontSize: 14, fontWeight: 700, color: s.text, marginBottom: 6 }}>
        {slot.start} – {slot.end}
      </div>

      {/* Status pill */}
      <div style={{
        display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px',
        textTransform: 'uppercase', color: s.text, marginBottom: bk ? 10 : 0,
      }}>
        {s.label}
        {bk?.paymentStatus === 'partially_paid' && ' · ⚠️ Partial'}
        {bk?.paymentStatus === 'unpaid' && ' · ❌ Unpaid'}
      </div>

      {bk && (
        <>
          <div style={{ borderTop: `1px solid ${s.border}`, paddingTop: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
              {bk.customer?.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{bk.customer?.phone}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <div>
              <div style={{ color: '#10b981' }}>₹{fmt(bk.amountPaid)} paid</div>
              {bk.remainingAmount > 0 && (
                <div style={{ color: '#f59e0b' }}>₹{fmt(bk.remainingAmount)} due</div>
              )}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>₹{fmt(bk.totalAmount)}</div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {slot.slotStatus === 'booked' && (
              <button
                className="btn btn-primary btn-sm"
                style={{ fontSize: 11 }}
                onClick={() => onComplete(bk.bookingId)}
              >
                ✅ Mark Done
              </button>
            )}
            {bk.paymentStatus !== 'paid' && (
              <button
                className="btn btn-success btn-sm"
                style={{ fontSize: 11 }}
                onClick={() => onCollect(bk)}
              >
                <IndianRupee size={10} /> Collect
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CollectModal({ booking, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCollect = async () => {
    if (!amount || Number(amount) <= 0) return;
    setLoading(true);
    try {
      await api.put(`/turf-owner/booking/${booking.bookingId}/collect`, { amountCollected: Number(amount) });
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
        padding: 28, width: '100%', maxWidth: 360,
      }}>
        <h3 style={{ marginBottom: 16, fontWeight: 700 }}>💰 Collect Remaining</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
          Customer: <strong>{booking.customer?.name}</strong>
        </p>
        <p style={{ fontSize: 13, color: '#f59e0b', marginBottom: 20 }}>
          Remaining: <strong>₹{new Intl.NumberFormat('en-IN').format(booking.remainingAmount || 0)}</strong>
        </p>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
            Amount (₹)
          </label>
          <input
            type="number"
            min="1"
            max={booking.remainingAmount}
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder={`Max ₹${booking.remainingAmount}`}
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
            {loading ? 'Saving...' : 'Record'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Slots() {
  const { selectedTurf } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collectData, setCollectData] = useState(null);
  const [bookingsCount, setBookingsCount] = useState(0);

  const fetchSlots = async () => {
    if (!selectedTurf?.id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/turf-owner/slots/${selectedTurf.id}?date=${date}`);
      setSlots(data.slots || []);
      setBookingsCount(data.bookingsCount || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSlots(); }, [selectedTurf?.id, date]);

  const shiftDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  const handleComplete = async (bookingId) => {
    await api.put(`/turf-owner/booking/${bookingId}/status`, { status: 'completed' });
    fetchSlots();
  };

  const available = slots.filter(s => s.slotStatus === 'available').length;
  const booked = slots.filter(s => s.slotStatus === 'booked').length;
  const completed = slots.filter(s => s.slotStatus === 'completed').length;

  return (
    <div className="animate-fadeIn">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Slot Manager</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
          {selectedTurf?.name} — Manage daily slot bookings
        </p>
      </div>

      {/* Date nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => shiftDate(-1)}>
          <ChevronLeft size={14} /> Prev
        </button>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          style={{ width: 'auto', minWidth: 160 }}
        />
        <button className="btn btn-ghost btn-sm" onClick={() => shiftDate(1)}>
          Next <ChevronRight size={14} />
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setDate(new Date().toISOString().split('T')[0])}>
          Today
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Available', count: available, color: '#94a3b8' },
          { label: 'Booked', count: booked, color: '#10b981' },
          { label: 'Completed', count: completed, color: '#8b5cf6' },
          { label: 'Total', count: slots.length, color: '#3b82f6' },
        ].map(({ label, count, color }) => (
          <div key={label} style={{
            background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 10,
            padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>{count}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Slot Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" />
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 12,
        }}>
          {slots.map(slot => (
            <SlotCard
              key={slot.start}
              slot={slot}
              onComplete={handleComplete}
              onCollect={(bk) => setCollectData(bk)}
            />
          ))}
        </div>
      )}

      {collectData && (
        <CollectModal
          booking={collectData}
          onClose={() => setCollectData(null)}
          onSaved={() => { setCollectData(null); fetchSlots(); }}
        />
      )}
    </div>
  );
}

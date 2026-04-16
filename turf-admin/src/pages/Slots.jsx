import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { ChevronLeft, ChevronRight, IndianRupee, Lock, Unlock, Zap, Settings } from 'lucide-react';

const STATUS_COLOR = {
  available: { bg: 'var(--bg-card)', border: 'var(--border)', text: 'var(--text-muted)', label: 'Available' },
  booked:    { bg: 'rgba(16,185,129,0.05)',  border: 'rgba(16,185,129,0.2)',  text: '#10b981', label: 'Booked' },
  pending:   { bg: 'rgba(245,158,11,0.05)',  border: 'rgba(245,158,11,0.2)',  text: '#f59e0b', label: 'Pending' },
  completed: { bg: 'rgba(139,92,246,0.05)',  border: 'rgba(139,92,246,0.2)',  text: '#8b5cf6', label: 'Completed' },
  blocked:   { bg: 'rgba(239,68,68,0.04)',   border: 'rgba(239,68,68,0.25)',  text: '#ef4444', label: 'Admin Blocked' },
};

// Slot duration presets for admin
const DURATION_PRESETS = [
  { label: '30 Min', value: '30' },
  { label: '1 Hour', value: '60' },
  { label: '1.5 Hrs', value: '90' },
  { label: '2 Hours', value: '120' },
];

function SlotCard({ slot, onComplete, onCollect, onToggleBlock }) {
  const s = STATUS_COLOR[slot.slotStatus] || STATUS_COLOR.available;
  const bk = slot.booking;
  const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));

  return (
    <div style={{
      background: slot.slotStatus === 'blocked'
        ? 'repeating-linear-gradient(-45deg,rgba(239,68,68,0.04),rgba(239,68,68,0.04) 4px,rgba(239,68,68,0.01) 4px,rgba(239,68,68,0.01) 8px)'
        : s.bg,
      border: `1.5px solid ${s.border}`, borderRadius: 12,
      padding: '12px 14px', transition: 'all 0.15s',
    }}>
      {/* Time */}
      <div style={{ fontSize: 14, fontWeight: 700, color: s.text, marginBottom: 6 }}>
        {slot.start} – {slot.end}
        <span style={{ fontSize: 10, marginLeft: 6, fontWeight: 500, color: 'var(--text-muted)' }}>
          ({slot.durationMinutes || 60} min)
        </span>
      </div>

      {/* Status pill */}
      <div style={{
        display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.5px',
        textTransform: 'uppercase', color: s.text, marginBottom: bk ? 10 : 0,
      }}>
        {s.label}
        {bk?.paymentStatus === 'partially_paid' && ' · Partial'}
        {bk?.paymentStatus === 'unpaid' && ' · Unpaid'}
      </div>

      {bk && (
        <>
          <div style={{ borderTop: `1px solid ${s.border}`, paddingTop: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
              {bk.customer?.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{bk.customer?.phone}</div>
          </div>
          {slot.slotStatus !== 'blocked' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
              <div>
                <div style={{ color: '#10b981' }}>₹{fmt(bk.amountPaid)} paid</div>
                {bk.remainingAmount > 0 && (
                  <div style={{ color: '#f59e0b' }}>₹{fmt(bk.remainingAmount)} due</div>
                )}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>₹{fmt(bk.totalAmount)}</div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {(slot.slotStatus === 'booked' || slot.slotStatus === 'pending') && (
              <button
                className="btn btn-primary btn-sm"
                style={{ fontSize: 11 }}
                onClick={() => onComplete(bk.bookingId)}
              >
                Mark Done
              </button>
            )}
            {bk?.paymentStatus !== 'paid' && (
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

      {/* Block / Unblock Actions */}
      {(!bk || slot.slotStatus === 'blocked') && (
        <div style={{ display: 'flex', marginTop: bk ? 0 : 10 }}>
          {slot.slotStatus === 'available' && (
            <button
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: 11, fontWeight: 600, color: '#ef4444',
                background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 8, padding: '6px 0', cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)'; }}
              onClick={() => onToggleBlock(slot)}
            >
              <Lock size={12} /> Block Slot
            </button>
          )}
          {slot.slotStatus === 'blocked' && (
            <button
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontSize: 11, fontWeight: 600, color: '#10b981',
                background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: 8, padding: '6px 0', cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.15)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.08)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.2)'; }}
              onClick={() => onToggleBlock(slot)}
            >
              <Unlock size={12} /> Unblock
            </button>
          )}
        </div>
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
        <h3 style={{ marginBottom: 16, fontWeight: 700 }}>Collect Remaining</h3>
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

// ---------------------------------------------------------------------------
// Dynamic Pricing Config Panel (inline in the slots page)
// ---------------------------------------------------------------------------
function PricingPanel({ turf, onSaved }) {
  const [open, setOpen] = useState(false);
  const [basePrice, setBasePrice] = useState(turf?.pricePerHour || '');
  const [peakStart, setPeakStart] = useState(turf?.peakHourStart || '18:00');
  const [peakEnd, setPeakEnd] = useState(turf?.peakHourEnd || '23:00');
  const [peakPrice, setPeakPrice] = useState(turf?.peakPricePerHour || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (turf) {
      setBasePrice(turf.pricePerHour || '');
      setPeakStart(turf.peakHourStart || '18:00');
      setPeakEnd(turf.peakHourEnd || '23:00');
      setPeakPrice(turf.peakPricePerHour || '');
    }
  }, [turf]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/turf-owner/turf/${turf.id}/pricing`, {
        pricePerHour: Number(basePrice),
        peakHourStart: peakStart,
        peakHourEnd: peakEnd,
        peakPricePerHour: peakPrice ? Number(peakPrice) : null,
      });
      onSaved();
      setOpen(false);
      alert('Pricing updated successfully!');
    } catch (e) {
      alert('Failed to update pricing: ' + (e.response?.data?.message || e.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.2)',
      borderRadius: 14, marginBottom: 20,
    }}>
      {/* Header toggle */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={16} color="#f59e0b" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Dynamic Pricing</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Base: ₹{turf?.pricePerHour || '—'}/hr
              {turf?.peakPricePerHour ? ` · Night: ₹${turf.peakPricePerHour}/hr (${turf.peakHourStart}–${turf.peakHourEnd})` : ' · No night pricing'}
            </div>
          </div>
        </div>
        <Settings size={15} color="#f59e0b" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>

      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid rgba(245,158,11,0.1)' }}>
          <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Base Price */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Base Price (₹/hr)
              </label>
              <input
                type="number"
                min="0"
                value={basePrice}
                onChange={e => setBasePrice(e.target.value)}
                placeholder="e.g. 600"
                style={{ width: '100%' }}
              />
            </div>

            {/* Night Hours */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                🌙 Night Hours
              </label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input type="time" value={peakStart} onChange={e => setPeakStart(e.target.value)} style={{ flex: 1 }} />
                <span style={{ color: 'var(--text-muted)', fontWeight: 700 }}>to</span>
                <input type="time" value={peakEnd} onChange={e => setPeakEnd(e.target.value)} style={{ flex: 1 }} />
              </div>
            </div>

            {/* Night Price */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                Night Price (₹/hr) <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none' }}>— leave empty to disable</span>
              </label>
              <input
                type="number"
                min="0"
                value={peakPrice}
                onChange={e => setPeakPrice(e.target.value)}
                placeholder="e.g. 900 (blank = no night pricing)"
                style={{ width: '100%' }}
              />
            </div>

            {peakPrice && (
              <div style={{ marginTop: '16px', padding: '12px', background: '#ecfdf5', color: '#065f46', borderRadius: '6px', fontSize: '13px', border: '1px solid #a7f3d0' }}>
                <strong>👉 “Night charges include lighting cost 💡”</strong><br/>
                Slots from <strong>{peakStart}</strong> to <strong>{peakEnd}</strong> will be charged at{' '}
                <strong>₹{peakPrice}/hr</strong> (vs. base ₹{basePrice}/hr).
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving || !basePrice}
              style={{ marginTop: 4 }}
            >
              {saving ? 'Saving...' : 'Save Pricing'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Slots Page
// ---------------------------------------------------------------------------
export default function Slots() {
  const { selectedTurf } = useAuth();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [interval, setIntervalVal] = useState('60');
  const [customInterval, setCustomInterval] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collectData, setCollectData] = useState(null);
  const [bookingsCount, setBookingsCount] = useState(0);
  const [bookedDates, setBookedDates] = useState([]);
  const [turfData, setTurfData] = useState(null);

  // Fetch turf details for pricing panel
  useEffect(() => {
    if (!selectedTurf?.id) return;
    api.get(`/turfs/${selectedTurf.id}`)
      .then(res => setTurfData(res.data.turf))
      .catch(console.error);
  }, [selectedTurf?.id]);

  // Fetch all recent bookings to extract upcoming booked dates
  useEffect(() => {
    if (!selectedTurf?.id) return;
    api.get(`/turf-owner/bookings/${selectedTurf.id}?limit=200`)
      .then(res => {
        const dts = Array.from(new Set((res.data.bookings || []).map(b => b.date)));
        const todayStr = new Date().toISOString().split('T')[0];
        setBookedDates(dts.filter(d => d >= todayStr).sort());
      })
      .catch(console.error);
  }, [selectedTurf?.id, date]);

  const fetchSlots = async (overrideInterval) => {
    if (!selectedTurf?.id) return;
    setLoading(true);
    try {
      const activeInterval = overrideInterval || interval;
      const { data } = await api.get(`/turf-owner/slots/${selectedTurf.id}?date=${date}&interval=${activeInterval}`);
      setSlots(data.slots || []);
      setBookingsCount(data.bookingsCount || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSlots(); }, [selectedTurf?.id, date, interval]);

  const shiftDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  const handleComplete = async (bookingId) => {
    await api.put(`/turf-owner/booking/${bookingId}/status`, { status: 'completed' });
    fetchSlots();
  };

  const handleToggleBlock = async (slot) => {
    const action = slot.slotStatus === 'blocked' ? 'unblock' : 'block';
    if (!window.confirm(`Are you sure you want to ${action} this slot (${slot.start} – ${slot.end})?`)) return;
    try {
      await api.post(`/turf-owner/slots/${selectedTurf.id}/toggle-block`, {
        date,
        slot: { start: slot.start, end: slot.end }
      });
      fetchSlots();
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.message || 'Error toggling slot block.');
    }
  };

  const handleApplyCustom = () => {
    const mins = parseInt(customInterval, 10);
    if (!mins || mins < 15 || mins > 480) { alert('Enter a duration between 15 and 480 minutes.'); return; }
    setShowCustom(false);
    setIntervalVal(String(mins)); // triggers useEffect → fetchSlots automatically
  };

  const available = slots.filter(s => s.slotStatus === 'available').length;
  const booked = slots.filter(s => s.slotStatus === 'booked').length;
  const pending = slots.filter(s => s.slotStatus === 'pending').length;
  const completed = slots.filter(s => s.slotStatus === 'completed').length;
  const blockedCount = slots.filter(s => s.slotStatus === 'blocked').length;

  return (
    <div className="animate-fadeIn">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Slot Manager</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
          {selectedTurf?.name} — Manage daily slot bookings & pricing
        </p>
      </div>

      {/* Dynamic Pricing Panel */}
      {turfData && (
        <PricingPanel
          turf={{ ...turfData, id: selectedTurf.id }}
          onSaved={() => {
            api.get(`/turfs/${selectedTurf.id}`).then(res => setTurfData(res.data.turf)).catch(console.error);
          }}
        />
      )}

      {/* Quick Jump Dates */}
      {bookedDates.length > 0 && (
        <div className="card" style={{ padding: 16, marginBottom: 20, background: 'rgba(16, 185, 129, 0.04)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
          <div style={{ fontSize: 12, color: 'var(--primary)', marginBottom: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Jump to Booked Dates:
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {bookedDates.map(d => (
              <button
                key={d}
                className={`btn btn-sm ${date === d ? 'btn-primary' : 'btn-ghost'}`}
                style={{ border: date !== d ? '1px solid var(--border)' : 'none', background: date !== d ? 'var(--bg-glass)' : undefined }}
                onClick={() => setDate(d)}
              >
                {new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date nav and Interval Selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
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

        {/* Duration Toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', background: 'var(--bg-glass)', padding: 4, borderRadius: 12, border: '1px solid var(--border)', gap: 2, flexWrap: 'wrap' }}>
            {DURATION_PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => { setIntervalVal(p.value); setShowCustom(false); }}
                style={{
                  padding: '6px 12px', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none',
                  cursor: 'pointer', transition: 'all 0.2s',
                  background: interval === p.value && !showCustom ? 'var(--primary)' : 'transparent',
                  color: interval === p.value && !showCustom ? '#ffffff' : 'var(--text-secondary)',
                }}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setShowCustom(!showCustom)}
              style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 700, borderRadius: 8, border: 'none',
                cursor: 'pointer', transition: 'all 0.2s',
                background: showCustom ? 'var(--primary)' : 'transparent',
                color: showCustom ? '#ffffff' : 'var(--text-secondary)',
              }}
            >
              Custom
            </button>
          </div>
          {showCustom && (
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                min={15}
                max={480}
                step={15}
                value={customInterval}
                onChange={e => setCustomInterval(e.target.value)}
                placeholder="Minutes (e.g. 45)"
                style={{ width: 160, fontSize: 13, padding: '6px 10px' }}
              />
              <button className="btn btn-primary btn-sm" onClick={handleApplyCustom}>Apply</button>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Available', count: available, color: '#94a3b8' },
          { label: 'Blocked', count: blockedCount, color: '#ef4444' },
          { label: 'Fully Paid', count: booked, color: '#10b981' },
          { label: 'Pending Cash', count: pending, color: '#f59e0b' },
          { label: 'Completed', count: completed, color: '#8b5cf6' },
          { label: 'Total Slots', count: slots.length, color: '#3b82f6' },
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

      {/* Block all available slots note */}
      {slots.some(s => s.slotStatus === 'available') && (
        <div style={{
          background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 10,
          padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#b91c1c',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Lock size={13} />
          <span>Click <strong>Block Slot</strong> on any available slot to mark it unavailable for users (e.g. VIP reservation, maintenance).</span>
        </div>
      )}

      {/* Slot Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner" style={{ borderWidth: 3, width: 30, height: 30 }} />
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 200px), 1fr))',
          gap: 12,
        }}>
          {slots.map(slot => (
            <SlotCard
              key={slot.start}
              slot={slot}
              onComplete={handleComplete}
              onCollect={(bk) => setCollectData(bk)}
              onToggleBlock={handleToggleBlock}
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

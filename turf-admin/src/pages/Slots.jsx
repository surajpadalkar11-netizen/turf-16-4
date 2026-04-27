import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { ChevronLeft, ChevronRight, IndianRupee, Lock, Unlock, Zap, Settings, RefreshCw } from 'lucide-react';
import TimeSelect from '../components/TimeSelect';
import styles from './Slots.module.css';

/* ── Helpers ── */
const formatTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  let hours = parseInt(h, 10);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${m} ${ampm}`;
};

const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));

const STATUS_META = {
  available: { label: 'Available', bg: '#f1f5f9', border: '#e2e8f0', text: '#94a3b8', dot: '#94a3b8' },
  booked:    { label: 'Booked',    bg: 'rgba(5,150,105,0.06)',  border: 'rgba(5,150,105,0.25)',  text: '#059669', dot: '#059669' },
  pending:   { label: 'Pending',   bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.25)', text: '#d97706', dot: '#d97706' },
  completed: { label: 'Completed', bg: 'rgba(139,92,246,0.06)', border: 'rgba(139,92,246,0.25)', text: '#7c3aed', dot: '#7c3aed' },
  blocked:   { label: 'Blocked',   bg: 'rgba(239,68,68,0.05)', border: 'rgba(239,68,68,0.3)',   text: '#dc2626', dot: '#ef4444' },
};

const DURATION_PRESETS = [
  { label: '30m',   value: '30'  },
  { label: '1 hr',  value: '60'  },
  { label: '1.5h',  value: '90'  },
  { label: '2 hr',  value: '120' },
];

/* ─────────────────────────────────────────
   Slot Card
───────────────────────────────────────── */
function SlotCard({ slot, onComplete, onCollect, onToggleBlock }) {
  const s = STATUS_META[slot.slotStatus] || STATUS_META.available;
  const bk = slot.booking;

  return (
    <div
      className={styles.slotCard}
      style={{ background: s.bg, borderColor: s.border, borderLeftColor: s.dot }}
    >
      {/* Time header */}
      <div className={styles.slotCardHeader}>
        <div className={styles.slotCardTime} style={{ color: s.text }}>
          {formatTime(slot.start)}
          <span className={styles.slotCardTimeSep}>–</span>
          {formatTime(slot.end)}
        </div>
        <div className={styles.slotCardBadge} style={{ background: `${s.dot}18`, color: s.dot }}>
          {s.label}
          {bk?.paymentStatus === 'partially_paid' && ' · Partial'}
          {bk?.paymentStatus === 'unpaid' && ' · Unpaid'}
        </div>
      </div>

      {/* Booking info */}
      {bk && slot.slotStatus !== 'blocked' && (
        <div className={styles.slotCardBody}>
          <div className={styles.slotCustomerName}>{bk.customer?.name}</div>
          <div className={styles.slotCustomerPhone}>{bk.customer?.phone}</div>
          <div className={styles.slotPayRow}>
            <span className={styles.slotPaid}>₹{fmt(bk.amountPaid)} paid</span>
            {bk.remainingAmount > 0 && (
              <span className={styles.slotDue}>₹{fmt(bk.remainingAmount)} due</span>
            )}
            <span className={styles.slotTotal}>₹{fmt(bk.totalAmount)}</span>
          </div>

          <div className={styles.slotActions}>
            {['booked', 'pending'].includes(slot.slotStatus) && (
              <button className="btn btn-primary btn-sm" onClick={() => onComplete(bk.bookingId)}>
                Mark Done
              </button>
            )}
            {bk.paymentStatus !== 'paid' && (
              <button className="btn btn-success btn-sm" onClick={() => onCollect(bk)}>
                <IndianRupee size={11} /> Collect
              </button>
            )}
          </div>
        </div>
      )}

      {/* Block/Unblock */}
      {(!bk || slot.slotStatus === 'blocked') && (
        <div className={styles.slotBlockRow}>
          {slot.slotStatus === 'available' && (
            <button className={`btn btn-danger btn-sm ${styles.blockBtn}`} onClick={() => onToggleBlock(slot)}>
              <Lock size={12} /> Block Slot
            </button>
          )}
          {slot.slotStatus === 'blocked' && (
            <button className={`btn btn-success btn-sm ${styles.blockBtn}`} onClick={() => onToggleBlock(slot)}>
              <Unlock size={12} /> Unblock
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────
   Collect Modal
───────────────────────────────────────── */
function CollectModal({ booking, onClose, onSaved }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCollect = async () => {
    if (!amount || Number(amount) <= 0) return;
    setLoading(true);
    try {
      await api.put(`turf-owner/booking/${booking.bookingId}/collect`, { amountCollected: Number(amount) });
      onSaved();
    } finally { setLoading(false); }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Collect Remaining Payment</h3>
        <div className={styles.modalInfo}>
          <p>Customer: <strong>{booking.customer?.name}</strong></p>
          <p className={styles.modalDue}>Remaining: <strong>₹{fmt(booking.remainingAmount || 0)}</strong></p>
        </div>
        <div className={styles.modalField}>
          <label className="form-label">Amount Received (₹)</label>
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
        <div className={styles.modalActions}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCollect} disabled={loading || !amount}>
            {loading ? 'Saving...' : 'Record Payment'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   Pricing Panel
───────────────────────────────────────── */
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
      await api.put(`turf-owner/turf/${turf.id}/pricing`, {
        pricePerHour: Number(basePrice),
        peakHourStart: peakStart,
        peakHourEnd: peakEnd,
        peakPricePerHour: peakPrice ? Number(peakPrice) : null,
      });
      onSaved();
      setOpen(false);
    } catch (e) {
      alert('Failed: ' + (e.response?.data?.message || e.message));
    } finally { setSaving(false); }
  };

  return (
    <div className={styles.pricingPanel}>
      <button className={styles.pricingToggleBtn} onClick={() => setOpen(!open)}>
        <div className={styles.pricingLeft}>
          <div className={styles.pricingIcon}><Zap size={16} color="#f59e0b" /></div>
          <div>
            <div className={styles.pricingTitle}>Dynamic Pricing</div>
            <div className={styles.pricingMeta}>
              Base: ₹{turf?.pricePerHour || '—'}/hr
              {turf?.peakPricePerHour
                ? ` · Night: ₹${turf.peakPricePerHour}/hr (${formatTime(turf.peakHourStart)}–${formatTime(turf.peakHourEnd)})`
                : ' · No night pricing'}
            </div>
          </div>
        </div>
        <Settings size={15} color="#f59e0b"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
      </button>

      {open && (
        <div className={styles.pricingBody}>
          <div className={styles.pricingRow}>
            <div className="form-group">
              <label className="form-label">Base Price (₹/hr)</label>
              <input type="number" min="0" value={basePrice} onChange={e => setBasePrice(e.target.value)} onWheel={e => e.target.blur()} placeholder="e.g. 600" />
            </div>
            <div className="form-group">
              <label className="form-label">Night Price (₹/hr) <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>leave blank to disable</span></label>
              <input type="number" min="0" value={peakPrice} onChange={e => setPeakPrice(e.target.value)} onWheel={e => e.target.blur()} placeholder="e.g. 900" />
            </div>
          </div>

          <div className={styles.pricingRow}>
            <div className="form-group">
              <label className="form-label">🌙 Night Start</label>
              <TimeSelect value={peakStart} onChange={val => setPeakStart(val)} />
            </div>
            <div className="form-group">
              <label className="form-label">🌙 Night End</label>
              <TimeSelect value={peakEnd} onChange={val => setPeakEnd(val)} />
            </div>
          </div>

          {peakPrice && (
            <div className={styles.pricingPreview}>
              <strong>Night charges preview:</strong> Slots from <strong>{formatTime(peakStart)}</strong> to <strong>{formatTime(peakEnd)}</strong> = <strong>₹{peakPrice}/hr</strong> (base ₹{basePrice}/hr)
            </div>
          )}

          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !basePrice}>
            {saving ? 'Saving...' : 'Save Pricing'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main Slots Page
═══════════════════════════════════════════════════════════ */
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
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!selectedTurf?.id) return;
    api.get(`turfs/${selectedTurf.id}`)
      .then(res => setTurfData(res.data.turf))
      .catch(console.error);
  }, [selectedTurf?.id]);

  useEffect(() => {
    if (!selectedTurf?.id) return;
    api.get(`turf-owner/bookings/${selectedTurf.id}?limit=200`)
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
      const { data } = await api.get(`turf-owner/slots/${selectedTurf.id}?date=${date}&interval=${activeInterval}`);
      setSlots(data.slots || []);
      setBookingsCount(data.bookingsCount || 0);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchSlots(); }, [selectedTurf?.id, date, interval]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSlots();
    setRefreshing(false);
  };

  const shiftDate = (days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().split('T')[0]);
  };

  const handleComplete = async (bookingId) => {
    await api.put(`turf-owner/booking/${bookingId}/status`, { status: 'completed' });
    fetchSlots();
  };

  const handleToggleBlock = async (slot) => {
    const action = slot.slotStatus === 'blocked' ? 'unblock' : 'block';
    if (!window.confirm(`Are you sure you want to ${action} this slot (${formatTime(slot.start)} – ${formatTime(slot.end)})?`)) return;
    try {
      await api.post(`turf-owner/slots/${selectedTurf.id}/toggle-block`, {
        date,
        slot: { start: slot.start, end: slot.end }
      });
      fetchSlots();
    } catch (e) {
      alert(e.response?.data?.message || 'Error toggling slot block.');
    }
  };

  const handleApplyCustom = () => {
    const mins = parseInt(customInterval, 10);
    if (!mins || mins < 15 || mins > 480) { alert('Enter a duration between 15 and 480 minutes.'); return; }
    setShowCustom(false);
    setIntervalVal(String(mins));
  };

  /* Counts */
  const available  = slots.filter(s => s.slotStatus === 'available').length;
  const booked     = slots.filter(s => s.slotStatus === 'booked').length;
  const pending    = slots.filter(s => s.slotStatus === 'pending').length;
  const completed  = slots.filter(s => s.slotStatus === 'completed').length;
  const blockedCnt = slots.filter(s => s.slotStatus === 'blocked').length;

  return (
    <div className="animate-fadeIn">
      {/* Page Title */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Slot Manager</h1>
          <p className={styles.pageSubtitle}>{selectedTurf?.name} — Manage daily slots &amp; pricing</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* Pricing Panel */}
      {turfData && (
        <PricingPanel
          turf={{ ...turfData, id: selectedTurf.id }}
          onSaved={() => {
            api.get(`turfs/${selectedTurf.id}`).then(res => setTurfData(res.data.turf)).catch(console.error);
          }}
        />
      )}

      {/* Quick Jump Dates */}
      {bookedDates.length > 0 && (
        <div className={styles.jumpDates}>
          <span className={styles.jumpLabel}>Jump to booked dates:</span>
          <div className={styles.jumpChips}>
            {bookedDates.slice(0, 10).map(d => (
              <button
                key={d}
                className={`btn btn-sm ${date === d ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setDate(d)}
              >
                {new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date navigation + interval */}
      <div className={styles.controlBar}>
        <div className={styles.dateNav}>
          <button className="btn btn-ghost btn-sm" onClick={() => shiftDate(-1)}>
            <ChevronLeft size={14} /> Prev
          </button>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            style={{ width: 'auto', minWidth: 150 }}
          />
          <button className="btn btn-ghost btn-sm" onClick={() => shiftDate(1)}>
            Next <ChevronRight size={14} />
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setDate(new Date().toISOString().split('T')[0])}
          >Today</button>
        </div>

        <div className={styles.intervalGroup}>
          <div className={styles.presetBtns}>
            {DURATION_PRESETS.map(p => (
              <button
                key={p.value}
                className={`btn btn-sm ${interval === p.value && !showCustom ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => { setIntervalVal(p.value); setShowCustom(false); }}
              >
                {p.label}
              </button>
            ))}
            <button
              className={`btn btn-sm ${showCustom ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setShowCustom(!showCustom)}
            >Custom</button>
          </div>
          {showCustom && (
            <div className={styles.customRow}>
              <input
                type="number" min={15} max={480} step={15}
                value={customInterval}
                onChange={e => setCustomInterval(e.target.value)}
                placeholder="Minutes"
                style={{ width: 120 }}
              />
              <button className="btn btn-primary btn-sm" onClick={handleApplyCustom}>Apply</button>
            </div>
          )}
        </div>
      </div>

      {/* Summary pills */}
      <div className={styles.summaryBar}>
        {[
          { label: 'Available', count: available, color: '#94a3b8' },
          { label: 'Booked', count: booked, color: '#059669' },
          { label: 'Pending',   count: pending, color: '#f59e0b' },
          { label: 'Completed', count: completed, color: '#8b5cf6' },
          { label: 'Blocked',   count: blockedCnt, color: '#ef4444' },
          { label: 'Total',     count: slots.length, color: '#3b82f6' },
        ].map(({ label, count, color }) => (
          <div key={label} className={styles.summaryPill}>
            <span className="dot" style={{ background: color }} />
            <strong style={{ color }}>{count}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Block hint */}
      {slots.some(s => s.slotStatus === 'available') && (
        <div className={styles.blockHint}>
          <Lock size={13} />
          <span>Click <strong>Block Slot</strong> to mark unavailable for users (maintenance, VIP reservation, etc.).</span>
        </div>
      )}

      {/* Slot grid */}
      {loading ? (
        <div className={styles.loadingWrap}>
          <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        </div>
      ) : slots.length === 0 ? (
        <div className={`card ${styles.emptySlots}`}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <h3>No slots configured</h3>
          <p>Check the turf operating hours or try a different date.</p>
        </div>
      ) : (
        <div className={styles.slotGrid}>
          {slots.map((slot, i) => (
            <SlotCard
              key={`${slot.start}-${i}`}
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

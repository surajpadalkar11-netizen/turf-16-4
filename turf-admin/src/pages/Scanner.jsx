import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import QRCode from 'qrcode.react';
import { Search, CheckCircle, XCircle, AlertTriangle, ScanLine } from 'lucide-react';

const CLIENT_URL = import.meta.env.VITE_CLIENT_URL || 'http://localhost:5173';
const fmt = (n) => new Intl.NumberFormat('en-IN').format(Math.round(n || 0));

function BookingResult({ result }) {
  if (!result) return null;

  const { booking } = result;
  const isToday = booking.isToday;
  const payStatus = booking.paymentStatus;
  const remaining = booking.remainingAmount;

  const getStatusIcon = () => {
    if (booking.status === 'cancelled') return <XCircle size={20} color="#ef4444" />;
    if (payStatus === 'paid') return <CheckCircle size={20} color="#10b981" />;
    return <AlertTriangle size={20} color="#f59e0b" />;
  };

  const statusColor = booking.status === 'cancelled' ? '#ef4444' : payStatus === 'paid' ? '#10b981' : '#f59e0b';

  return (
    <div style={{
      border: `2px solid ${statusColor}30`,
      background: `${statusColor}08`,
      borderRadius: 16,
      padding: 24,
      marginTop: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        {getStatusIcon()}
        <div>
          <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 18, color: statusColor }}>
            {booking.bookingCode}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {isToday ? '📅 Today\'s booking' : '⚠️ Not today\'s date'}
          </div>
        </div>
      </div>

      {/* Details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>CUSTOMER</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{booking.customer?.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{booking.customer?.phone}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>DATE</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {new Date(booking.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {(booking.timeSlots || []).map(s => `${s.start}–${s.end}`).join(', ')}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>BOOKING STATUS</div>
          <span className={`badge ${
            booking.status === 'confirmed' ? 'badge-success' :
            booking.status === 'completed' ? 'badge-primary' :
            booking.status === 'cancelled' ? 'badge-danger' : 'badge-warning'
          }`}>{booking.status}</span>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>PAYMENT</div>
          <span className={`badge ${
            payStatus === 'paid' ? 'badge-success' :
            payStatus === 'partially_paid' ? 'badge-warning' : 'badge-danger'
          }`}>
            {payStatus === 'paid' ? '✅ Fully Paid' : payStatus === 'partially_paid' ? '⚠️ Partial' : '❌ Unpaid'}
          </span>
        </div>
      </div>

      {/* Payment breakdown */}
      <div style={{
        background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Total Amount</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>₹{fmt(booking.totalAmount)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: remaining > 0 ? 6 : 0 }}>
          <span style={{ fontSize: 13, color: '#10b981' }}>✅ Paid Online</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>₹{fmt(booking.amountPaid)}</span>
        </div>
        {remaining > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
            <span style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>⚠️ Collect at Venue</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#f59e0b' }}>₹{fmt(remaining)}</span>
          </div>
        )}
      </div>

      {!isToday && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10,
          padding: '10px 14px', marginTop: 12, fontSize: 13, color: '#ef4444',
        }}>
          ⚠️ This booking is not for today. Please verify the date before allowing entry.
        </div>
      )}
    </div>
  );
}

export default function Scanner() {
  const { selectedTurf } = useAuth();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const turfUrl = `${CLIENT_URL}/turf/${selectedTurf?.id}`;

  const handleVerify = async (e) => {
    e?.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const { data } = await api.post('/turf-owner/verify-booking', {
        bookingCode: code.trim().toUpperCase(),
        turfId: selectedTurf?.id,
      });
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Booking not found');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fadeIn">
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>QR Scanner & Booking Verify</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
          Scan customer QR codes or manually enter booking codes
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {/* Left: Booking Verification */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ScanLine size={18} color="var(--primary)" /> Verify Booking Code
            </h3>
            <form onSubmit={handleVerify}>
              <div style={{ marginBottom: 12 }}>
                <input
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="Enter booking code (e.g. TRF-A1B2C)"
                  style={{ textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 700 }}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={loading || !code.trim()}
              >
                {loading ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <><Search size={14} /> Verify Booking</>}
              </button>
            </form>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444', borderRadius: 10, padding: '12px 16px', marginTop: 12, fontSize: 13,
              }}>
                ⚠️ {error}
              </div>
            )}

            <BookingResult result={result} />
          </div>

          {/* Quick Guide */}
          <div className="card" style={{ background: 'rgba(0,212,170,0.04)', borderColor: 'rgba(0,212,170,0.2)' }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)', marginBottom: 10 }}>📋 How to verify</h4>
            <ol style={{ fontSize: 12, color: 'var(--text-secondary)', paddingLeft: 16, lineHeight: 2 }}>
              <li>Ask customer for their booking code (TRF-XXXXX format)</li>
              <li>Enter it in the field above and click Verify</li>
              <li>Check the payment status — collect any remaining amount</li>
              <li>Allow entry only if booking is for today</li>
            </ol>
          </div>
        </div>

        {/* Right: Turf QR Code */}
        <div>
          <div className="card" style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>📲 Your Turf QR Code</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Display this at your turf. Customers scan it to book directly.
            </p>

            {selectedTurf?.id ? (
              <div>
                <div style={{
                  background: '#ffffff', borderRadius: 16, padding: 20,
                  display: 'inline-block', boxShadow: '0 0 0 4px rgba(0,212,170,0.2)',
                  marginBottom: 16,
                }}>
                  <QRCode
                    value={turfUrl}
                    size={200}
                    fgColor="#0f172a"
                    bgColor="#ffffff"
                    level="H"
                    includeMargin={false}
                    renderAs="svg"
                  />
                </div>

                <div style={{
                  background: 'var(--bg-glass)', border: '1px solid var(--border)', borderRadius: 10,
                  padding: '10px 14px', marginBottom: 16,
                }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Booking URL</div>
                  <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--primary)', wordBreak: 'break-all' }}>
                    {turfUrl}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      const canvas = document.querySelector('canvas') || document.querySelector('svg');
                      if (canvas) {
                        // Print QR
                        const w = window.open('');
                        w.document.write(`<html><body style="text-align:center;padding:40px;"><h2>${selectedTurf.name}</h2><br/>${canvas.outerHTML}<br/><p>Scan to book your slot online</p></body></html>`);
                        w.print();
                      }
                    }}
                  >
                    🖨️ Print QR Code
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => navigator.clipboard.writeText(turfUrl)}
                  >
                    📋 Copy Link
                  </button>
                </div>

                <div style={{
                  background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)',
                  borderRadius: 10, padding: '10px 14px', marginTop: 16, fontSize: 12, color: '#93c5fd',
                }}>
                  ℹ️ This QR links directly to your turf's booking page on the client website.
                  Only accessible when scanned from turf11.
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', padding: 40 }}>
                Select a turf to generate QR code
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

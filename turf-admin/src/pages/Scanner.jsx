import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { QRCodeSVG as QRCode } from 'qrcode.react';

const CLIENT_URL = import.meta.env.VITE_CLIENT_URL || 'http://localhost:5173';

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
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Turf QR Code</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
          Download or print your Turf's unique QR code
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ width: '100%', maxWidth: 500 }}>
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
                    size={240}
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
                      const canvas = document.querySelector('svg');
                      if (canvas) {
                        const w = window.open('');
                        w.document.write(`<html><body style="text-align:center;padding:40px;font-family:sans-serif;"><h2>${selectedTurf.name}</h2><br/>${canvas.outerHTML}<br/><p style="margin-top:20px;color:#555;">Scan to book your slot online</p></body></html>`);
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

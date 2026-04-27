import { useState, useEffect } from 'react';
import api from '../../services/api';
import './Settings.css';

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/admin/settings');
      setRazorpayKeyId(data.settings.razorpay_key_id || '');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    try {
      const payload = { razorpay_key_id: razorpayKeyId };
      if (razorpayKeySecret) payload.razorpay_key_secret = razorpayKeySecret;

      await api.put('/admin/settings', payload);
      setMsg({ type: 'success', text: 'Settings saved successfully!' });
      setRazorpayKeySecret('');
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Platform Settings</h1>
        <p className="page-subtitle">Configure payment gateway and system settings</p>
      </div>

      <div className="settings-container">
        <div className="settings-card">
          <div className="card-header">
            <h2 className="card-title">💳 Razorpay Configuration</h2>
            <p className="card-desc">
              Configure Razorpay keys for wallet top-ups and payouts. These keys are used for all wallet transactions across the platform.
            </p>
          </div>

          <form onSubmit={handleSave} className="settings-form">
            <div className="form-group">
              <label htmlFor="razorpay-key-id" className="form-label">
                Razorpay Key ID
              </label>
              <input
                type="text"
                id="razorpay-key-id"
                value={razorpayKeyId}
                onChange={(e) => setRazorpayKeyId(e.target.value)}
                placeholder="rzp_live_xxxxxxxxxx"
                className="form-input"
              />
              <span className="form-hint">Your Razorpay API Key ID (starts with rzp_)</span>
            </div>

            <div className="form-group">
              <label htmlFor="razorpay-key-secret" className="form-label">
                Razorpay Key Secret
              </label>
              <input
                type="password"
                id="razorpay-key-secret"
                value={razorpayKeySecret}
                onChange={(e) => setRazorpayKeySecret(e.target.value)}
                placeholder="Enter new secret to update"
                className="form-input"
              />
              <span className="form-hint">
                Leave blank to keep existing secret. Only enter if you want to update it.
              </span>
            </div>

            {msg && (
              <div className={`msg ${msg.type === 'success' ? 'msg-success' : 'msg-error'}`}>
                {msg.type === 'success' ? '✅' : '❌'} {msg.text}
              </div>
            )}

            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>

        <div className="info-card">
          <h3 className="info-title">ℹ️ How to Get Razorpay Keys</h3>
          <ol className="info-list">
            <li>Log in to your Razorpay Dashboard</li>
            <li>Go to Settings → API Keys</li>
            <li>Generate keys for Live or Test mode</li>
            <li>Copy the Key ID and Key Secret</li>
            <li>Paste them here and save</li>
          </ol>
          <p className="info-note">
            <strong>Note:</strong> Use Test mode keys for testing and Live mode keys for production.
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import styles from './Settings.module.css';

export default function Settings() {
  const { user } = useAuth();
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
      <div className={styles.page}>
        <div className={styles.loading}>Loading settings...</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Admin Settings</h1>
        <p className={styles.subtitle}>Configure payment gateway and system settings</p>
      </div>

      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>💳 Razorpay Configuration</h2>
            <p className={styles.cardDesc}>
              Configure Razorpay keys for wallet top-ups and payouts. These keys are used for all wallet transactions.
            </p>
          </div>

          <form onSubmit={handleSave} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="razorpay-key-id" className={styles.label}>
                Razorpay Key ID
              </label>
              <input
                type="text"
                id="razorpay-key-id"
                value={razorpayKeyId}
                onChange={(e) => setRazorpayKeyId(e.target.value)}
                placeholder="rzp_live_xxxxxxxxxx"
                className={styles.input}
              />
              <span className={styles.hint}>Your Razorpay API Key ID (starts with rzp_)</span>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="razorpay-key-secret" className={styles.label}>
                Razorpay Key Secret
              </label>
              <input
                type="password"
                id="razorpay-key-secret"
                value={razorpayKeySecret}
                onChange={(e) => setRazorpayKeySecret(e.target.value)}
                placeholder="Enter new secret to update"
                className={styles.input}
              />
              <span className={styles.hint}>
                Leave blank to keep existing secret. Only enter if you want to update it.
              </span>
            </div>

            {msg && (
              <div className={`${styles.msg} ${msg.type === 'success' ? styles.msgSuccess : styles.msgError}`}>
                {msg.type === 'success' ? '✅' : '❌'} {msg.text}
              </div>
            )}

            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>

        <div className={styles.infoCard}>
          <h3 className={styles.infoTitle}>ℹ️ How to Get Razorpay Keys</h3>
          <ol className={styles.infoList}>
            <li>Log in to your Razorpay Dashboard</li>
            <li>Go to Settings → API Keys</li>
            <li>Generate keys for Live or Test mode</li>
            <li>Copy the Key ID and Key Secret</li>
            <li>Paste them here and save</li>
          </ol>
          <p className={styles.infoNote}>
            <strong>Note:</strong> Use Test mode keys for testing and Live mode keys for production.
          </p>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { updateProfile } from '../../services/authService';
import styles from './Profile.module.css';

function Profile() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  if (!user) { navigate('/login'); return null; }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const { data } = await updateProfile(form);
      updateUser(data.user);
      setMessage('Profile updated successfully!');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.card}>
        <div className={styles.avatarSection}>
          <div className={styles.avatar}>{user.name?.charAt(0).toUpperCase()}</div>
          <h2>{user.name}</h2>
          <p className={styles.email}>{user.email}</p>
          <span className={styles.role}>{user.role}</span>
        </div>

        {message && <p className={styles.message}>{message}</p>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className={styles.field}>
            <label>Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="10-digit number" />
          </div>
          <button type="submit" className={styles.saveBtn} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        <button className={styles.logoutBtn} onClick={() => { logout(); navigate('/'); }}>
          Logout
        </button>
      </div>
    </div>
  );
}

export default Profile;

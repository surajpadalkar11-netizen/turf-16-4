import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  UserPlus, Trash2, ToggleLeft, ToggleRight,
  Mail, Lock, User, Eye, EyeOff, RefreshCw, X, ShieldCheck, ShieldOff,
} from 'lucide-react';
import styles from './Supervisors.module.css';

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/* ── Add Supervisor Modal ── */
function AddModal({ turfId, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.password) {
      setError('All fields are required');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await api.post('/turf-owner/supervisors', { ...form, turfId });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create supervisor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}><UserPlus size={18} /> Add Supervisor</h3>
          <button className={styles.modalClose} onClick={onClose}><X size={18} /></button>
        </div>

        <p className={styles.modalHint}>
          This person will be able to log into the owner panel with <strong>read-only</strong> access —
          they can see today's bookings, booking codes, and payment status, but cannot make changes.
        </p>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formField}>
            <label className="form-label">Full Name</label>
            <div className={styles.inputWrap}>
              <User size={15} className={styles.inputIcon} />
              <input
                type="text"
                placeholder="e.g. Ravi Sharma"
                value={form.name}
                onChange={set('name')}
                autoFocus
              />
            </div>
          </div>

          <div className={styles.formField}>
            <label className="form-label">Email Address</label>
            <div className={styles.inputWrap}>
              <Mail size={15} className={styles.inputIcon} />
              <input
                type="email"
                placeholder="supervisor@email.com"
                value={form.email}
                onChange={set('email')}
              />
            </div>
          </div>

          <div className={styles.formField}>
            <label className="form-label">Password</label>
            <div className={styles.inputWrap}>
              <Lock size={15} className={styles.inputIcon} />
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={set('password')}
              />
              <button
                type="button"
                className={styles.eyeBtn}
                onClick={() => setShowPass((p) => !p)}
              >
                {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className={styles.modalActions}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create Supervisor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Supervisors Page (owner only)
═══════════════════════════════════════════ */
export default function Supervisors() {
  const { selectedTurf } = useAuth();
  const [supervisors, setSupervisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fetchSupervisors = useCallback(async () => {
    if (!selectedTurf?.id) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/turf-owner/supervisors/${selectedTurf.id}`);
      setSupervisors(data.supervisors || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedTurf?.id]);

  useEffect(() => { fetchSupervisors(); }, [fetchSupervisors]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSupervisors();
    setRefreshing(false);
  };

  const handleToggle = async (id) => {
    setTogglingId(id);
    try {
      const { data } = await api.put(`/turf-owner/supervisors/${id}/toggle`);
      setSupervisors((p) =>
        p.map((s) => (s.id === id ? { ...s, is_active: data.is_active } : s))
      );
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await api.delete(`/turf-owner/supervisors/${id}`);
      setSupervisors((p) => p.filter((s) => s.id !== id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
      setConfirmDelete(null);
    }
  };

  return (
    <div className={`animate-fadeIn ${styles.wrapper}`}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Supervisors</h1>
          <p className={styles.subtitle}>
            Manage who can view your turf's daily operations — {selectedTurf?.name || ''}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-ghost btn-sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 0.8s linear infinite' : 'none' }} />
            Refresh
          </button>
          {selectedTurf && (
            <button className="btn btn-primary btn-sm" onClick={() => setShowAdd(true)}>
              <UserPlus size={15} /> Add Supervisor
            </button>
          )}
        </div>
      </div>

      {/* ── Info Banner ── */}
      <div className={styles.infoBanner}>
        <ShieldCheck size={16} />
        <span>
          Supervisors log in using the same login page. They get a <strong>read-only</strong> view:
          booking codes, times, cash collected, and cash due — no ability to edit or cancel.
        </span>
      </div>

      {/* ── No turf selected ── */}
      {!selectedTurf ? (
        <div className={`card ${styles.emptyCard}`}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🏟️</div>
          <h3>Select a turf first</h3>
          <p>Choose a turf from the sidebar to manage its supervisors.</p>
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
        </div>
      ) : supervisors.length === 0 ? (
        <div className={`card ${styles.emptyCard}`}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
          <h3>No supervisors yet</h3>
          <p>Click <strong>Add Supervisor</strong> to create one.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className={`card ${styles.tableCard}`}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>SUPERVISOR</th>
                    <th>EMAIL</th>
                    <th>STATUS</th>
                    <th>ADDED</th>
                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {supervisors.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className={styles.supName}>
                          <div className={styles.supAvatar}>{s.name[0]?.toUpperCase()}</div>
                          {s.name}
                        </div>
                      </td>
                      <td>
                        <div className={styles.supEmail}>{s.email}</div>
                      </td>
                      <td>
                        <span className={`badge ${s.is_active ? 'badge-success' : 'badge-muted'}`}>
                          {s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <span className={styles.dateText}>{fmtDate(s.created_at)}</span>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            className={`btn btn-ghost btn-sm ${styles.toggleBtn}`}
                            onClick={() => handleToggle(s.id)}
                            disabled={togglingId === s.id}
                            title={s.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {s.is_active
                              ? <><ToggleRight size={16} className={styles.toggleOn} /> Disable</>
                              : <><ToggleLeft size={16} className={styles.toggleOff} /> Enable</>}
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--danger)' }}
                            onClick={() => setConfirmDelete(s)}
                            disabled={deletingId === s.id}
                            title="Delete supervisor"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className={styles.mobileCards}>
            {supervisors.map((s) => (
              <div key={s.id} className={`card ${styles.mobileCard}`}>
                <div className={styles.mobileCardTop}>
                  <div className={styles.supAvatar}>{s.name[0]?.toUpperCase()}</div>
                  <div className={styles.mobileInfo}>
                    <div className={styles.supName2}>{s.name}</div>
                    <div className={styles.supEmail}>{s.email}</div>
                  </div>
                  <span className={`badge ${s.is_active ? 'badge-success' : 'badge-muted'}`}>
                    {s.is_active ? 'Active' : 'Off'}
                  </span>
                </div>
                <div className={styles.mobileCardActions}>
                  <button
                    className={`btn btn-ghost btn-sm ${styles.toggleBtn}`}
                    onClick={() => handleToggle(s.id)}
                    disabled={togglingId === s.id}
                  >
                    {s.is_active
                      ? <><ShieldOff size={13} /> Disable</>
                      : <><ShieldCheck size={13} /> Enable</>}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--danger)' }}
                    onClick={() => setConfirmDelete(s)}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Add modal ── */}
      {showAdd && selectedTurf && (
        <AddModal
          turfId={selectedTurf.id}
          onClose={() => setShowAdd(false)}
          onSaved={fetchSupervisors}
        />
      )}

      {/* ── Confirm delete ── */}
      {confirmDelete && (
        <div className={styles.overlay} onClick={() => setConfirmDelete(null)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmIcon}><Trash2 size={28} /></div>
            <h3 className={styles.confirmTitle}>Remove Supervisor?</h3>
            <p className={styles.confirmText}>
              <strong>{confirmDelete.name}</strong> ({confirmDelete.email}) will no longer
              be able to log in. This cannot be undone.
            </p>
            <div className={styles.confirmActions}>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button
                className="btn"
                style={{ background: 'var(--danger)', color: '#fff' }}
                onClick={() => handleDelete(confirmDelete.id)}
                disabled={deletingId === confirmDelete.id}
              >
                {deletingId === confirmDelete.id ? 'Removing…' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

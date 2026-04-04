import { useState, useEffect } from 'react';
import * as turfService from '../../services/turfService';
import './Turfs.css';

const SPORT_TYPES = ['cricket', 'football', 'badminton', 'tennis', 'basketball', 'volleyball', 'hockey', 'multi-sport'];
const SURFACE_TYPES = ['natural-grass', 'artificial-turf', 'indoor-court', 'clay', 'synthetic'];
const AMENITIES = ['floodlights', 'parking', 'locker-rooms', 'showers', 'first-aid', 'drinking-water', 'cafeteria', 'wifi', 'equipment-rental', 'coaching', 'scoreboard', 'spectator-seating'];

const emptyForm = {
  name: '', description: '', sportTypes: [], surfaceType: 'artificial-turf',
  address: { street: '', city: '', state: '', pincode: '' },
  location: { type: 'Point', coordinates: [0, 0] },
  images: [''], pricePerHour: '', amenities: [],
  dimensions: { length: '', width: '' },
  operatingHours: { open: '06:00', close: '23:00' },
  ownerPhone: '', ownerEmail: '',
  razorpayKeyId: '', razorpayKeySecret: '',
};

const formatPrice = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);

function Turfs() {
  const [turfs, setTurfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { loadTurfs(); }, []);

  const loadTurfs = async () => {
    setLoading(true);
    try {
      const { data } = await turfService.getTurfs({ limit: 100 });
      setTurfs(data.turfs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openCreate = () => {
    setEditId(null);
    setForm({ ...emptyForm, address: { ...emptyForm.address }, location: { ...emptyForm.location }, dimensions: { ...emptyForm.dimensions }, operatingHours: { ...emptyForm.operatingHours }, images: [''], sportTypes: [], amenities: [] });
    setShowModal(true);
  };

  const openEdit = (turf) => {
    setEditId(turf._id);
    setForm({
      name: turf.name,
      description: turf.description,
      sportTypes: [...turf.sportTypes],
      surfaceType: turf.surfaceType,
      address: { ...turf.address },
      location: { ...turf.location },
      images: turf.images?.length ? [...turf.images] : [''],
      pricePerHour: turf.pricePerHour,
      amenities: [...(turf.amenities || [])],
      dimensions: { length: turf.dimensions?.length || '', width: turf.dimensions?.width || '' },
      operatingHours: { open: turf.operatingHours?.open || '06:00', close: turf.operatingHours?.close || '23:00' },
      ownerPhone: turf.ownerPhone || '',
      ownerEmail: turf.ownerEmail || '',
      razorpayKeyId: turf.razorpayKeyId || '',
      razorpayKeySecret: turf.razorpayKeySecret || '',
    });
    setShowModal(true);
  };

  const geocodeAddress = async (addressStr) => {
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addressStr)}`);
      const data = await resp.json();
      if (data && data.length > 0) {
        return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
      }
    } catch(err) { console.error('Geocoding error:', err); }
    return null;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let finalLocation = form.location;
      
      if (finalLocation.coordinates[0] === 0 && finalLocation.coordinates[1] === 0) {
        const addressStr = `${form.address.street}, ${form.address.city}, ${form.address.state}`;
        let coords = await geocodeAddress(addressStr);
        if (!coords) coords = await geocodeAddress(form.address.city);
        
        if (coords) {
          finalLocation = { ...finalLocation, coordinates: coords };
        } else if (form.address.city.toLowerCase() === 'sangli') {
          // Safe fallback specifically for Sangli if API fails
          finalLocation = { ...finalLocation, coordinates: [74.5815, 16.8524] };
        }
      }

      const payload = {
        ...form,
        location: finalLocation,
        pricePerHour: Number(form.pricePerHour),
        images: form.images.filter((i) => i.trim()),
        dimensions: {
          length: form.dimensions.length ? Number(form.dimensions.length) : undefined,
          width: form.dimensions.width ? Number(form.dimensions.width) : undefined,
        },
      };
      if (editId) {
        await turfService.updateTurf(editId, payload);
        showToast('Turf updated successfully');
      } else {
        await turfService.createTurf(payload);
        showToast('Turf created successfully');
      }
      setShowModal(false);
      loadTurfs();
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this turf? This action cannot be undone.')) return;
    try {
      await turfService.deleteTurf(id);
      showToast('Turf deleted');
      loadTurfs();
    } catch (err) {
      showToast('Delete failed', 'error');
    }
  };

  const toggleArrayItem = (field, item) => {
    setForm((prev) => {
      const arr = prev[field];
      return { ...prev, [field]: arr.includes(item) ? arr.filter((a) => a !== item) : [...arr, item] };
    });
  };

  const updateImage = (idx, value) => {
    setForm((prev) => {
      const imgs = [...prev.images];
      // Defensive check in case value gets passed as an object instead of string
      const strValue = typeof value === 'object' && value !== null ? (value.url || '') : String(value);
      imgs[idx] = strValue;
      return { ...prev, images: imgs };
    });
  };

  const handleImageUpload = async (e, idx) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);
    try {
      showToast('Uploading image...', 'info');
      setSaving(true);
      const { data } = await turfService.uploadImage(formData);
      // Backend might return JSON { success: true, url: '...' } or a plain string
      const imageUrl = typeof data === 'object' && data !== null ? data.url || data.secureUrl : String(data);
      updateImage(idx, imageUrl);
      showToast('Image uploaded successfully', 'success');
    } catch (err) {
      showToast('Failed to upload image', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addImageField = () => setForm((prev) => ({ ...prev, images: [...prev.images, ''] }));
  const removeImageField = (idx) => setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }));

  return (
    <div className="animate-fade">
      <div className="page-header">
        <h1>Turf Management</h1>
        <button className="btn btn-primary" onClick={openCreate}>+ Add Turf</button>
      </div>

      {loading ? (
        <div className="turfs-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="skeleton" style={{ height: 220, borderRadius: 14 }} />)}
        </div>
      ) : turfs.length === 0 ? (
        <div className="empty-state card">
          <div className="icon">🏟️</div>
          <h3>No Turfs Yet</h3>
          <p>Create your first turf to get started</p>
          <button className="btn btn-primary" onClick={openCreate} style={{ marginTop: 16 }}>+ Add Turf</button>
        </div>
      ) : (
        <div className="turfs-grid">
          {turfs.map((turf) => (
            <div key={turf._id} className="turf-card card">
              <div className="turf-card-img">
                {turf.images?.[0] ? (
                  <>
                    <img 
                      src={turf.images[0]} 
                      alt={turf.name} 
                      onError={(e) => {
                        e.target.style.display = 'none';
                        if (e.target.nextElementSibling) {
                          e.target.nextElementSibling.style.display = 'flex';
                        }
                      }} 
                    />
                    <div className="turf-card-placeholder" style={{ display: 'none' }}>🏟️</div>
                  </>
                ) : (
                  <div className="turf-card-placeholder">🏟️</div>
                )}
                <span className={`turf-status ${turf.isActive ? 'active' : 'inactive'}`}>
                  {turf.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="turf-card-body">
                <h3>{turf.name}</h3>
                <p className="turf-card-location">📍 {turf.address?.city}, {turf.address?.state}</p>
                <div className="turf-card-tags">
                  {turf.sportTypes?.map((s) => <span key={s} className="turf-tag">{s}</span>)}
                </div>
                <div className="turf-card-footer">
                  <span className="turf-price">{formatPrice(turf.pricePerHour)}<small>/hr</small></span>
                  <span className="turf-rating">⭐ {turf.rating?.average?.toFixed(1) || '0.0'} ({turf.rating?.count || 0})</span>
                </div>
                <div className="turf-card-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(turf)}>✏️ Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(turf._id)}>🗑 Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal turf-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editId ? 'Edit Turf' : 'Add New Turf'}</h2>
              <button className="btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Turf Name *</label>
                  <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Green Arena Football Turf" />
                </div>

                <div className="form-group">
                  <label>Description *</label>
                  <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required placeholder="Describe the turf..." />
                </div>

                <div className="form-group">
                  <label>Sport Types *</label>
                  <div className="chip-grid">
                    {SPORT_TYPES.map((s) => (
                      <button key={s} type="button" className={`chip ${form.sportTypes.includes(s) ? 'chip-active' : ''}`} onClick={() => toggleArrayItem('sportTypes', s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Surface Type *</label>
                    <select className="input" value={form.surfaceType} onChange={(e) => setForm({ ...form, surfaceType: e.target.value })}>
                      {SURFACE_TYPES.map((s) => <option key={s} value={s}>{s.replace(/-/g, ' ')}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Price Per Hour (₹) *</label>
                    <input type="number" className="input" value={form.pricePerHour} onChange={(e) => setForm({ ...form, pricePerHour: e.target.value })} required min={0} placeholder="1500" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Street *</label>
                    <input className="input" value={form.address.street} onChange={(e) => setForm({ ...form, address: { ...form.address, street: e.target.value } })} required />
                  </div>
                  <div className="form-group">
                    <label>City *</label>
                    <input className="input" value={form.address.city} onChange={(e) => setForm({ ...form, address: { ...form.address, city: e.target.value } })} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>State *</label>
                    <input className="input" value={form.address.state} onChange={(e) => setForm({ ...form, address: { ...form.address, state: e.target.value } })} required />
                  </div>
                  <div className="form-group">
                    <label>Pincode *</label>
                    <input className="input" value={form.address.pincode} onChange={(e) => setForm({ ...form, address: { ...form.address, pincode: e.target.value } })} required />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Operating Hours — Open</label>
                    <input type="time" className="input" value={form.operatingHours.open} onChange={(e) => setForm({ ...form, operatingHours: { ...form.operatingHours, open: e.target.value } })} />
                  </div>
                  <div className="form-group">
                    <label>Operating Hours — Close</label>
                    <input type="time" className="input" value={form.operatingHours.close} onChange={(e) => setForm({ ...form, operatingHours: { ...form.operatingHours, close: e.target.value } })} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Length (m)</label>
                    <input type="number" className="input" value={form.dimensions.length} onChange={(e) => setForm({ ...form, dimensions: { ...form.dimensions, length: e.target.value } })} />
                  </div>
                  <div className="form-group">
                    <label>Width (m)</label>
                    <input type="number" className="input" value={form.dimensions.width} onChange={(e) => setForm({ ...form, dimensions: { ...form.dimensions, width: e.target.value } })} />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Turf Owner Email</label>
                    <input type="email" className="input" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} placeholder="owner@example.com" />
                  </div>
                  <div className="form-group">
                    <label>Turf Owner Phone (for updates)</label>
                    <input type="tel" className="input" value={form.ownerPhone} onChange={(e) => setForm({ ...form, ownerPhone: e.target.value })} placeholder="9876543210" />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Individual Razorpay Key ID (For direct payouts)</label>
                    <input className="input" value={form.razorpayKeyId} onChange={(e) => setForm({ ...form, razorpayKeyId: e.target.value })} placeholder="rzp_live_abc123" />
                  </div>
                  <div className="form-group">
                    <label>Individual Razorpay Key Secret</label>
                    <input type="password" className="input" value={form.razorpayKeySecret} onChange={(e) => setForm({ ...form, razorpayKeySecret: e.target.value })} placeholder="••••••••" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Amenities</label>
                  <div className="chip-grid">
                    {AMENITIES.map((a) => (
                      <button key={a} type="button" className={`chip ${form.amenities.includes(a) ? 'chip-active' : ''}`} onClick={() => toggleArrayItem('amenities', a)}>
                        {a.replace(/-/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Images (Upload or Paste URL)</label>
                  {form.images.map((img, idx) => (
                    <div key={idx} className="image-field" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input className="input" value={img} onChange={(e) => updateImage(idx, e.target.value)} placeholder="https:// images.unsplash.com/... or choose file" style={{ flex: 1 }} />
                        <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                          Upload File
                          <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, idx)} style={{ display: 'none' }} />
                        </label>
                        {form.images.length > 1 && <button type="button" className="btn-icon" onClick={() => removeImageField(idx)}>✕</button>}
                      </div>
                      {img && <img src={img} alt="preview" style={{ height: '80px', width: '120px', objectFit: 'cover', borderRadius: '4px' }} onError={(e) => e.target.style.display = 'none'} onLoad={(e) => e.target.style.display = 'block'} />}
                    </div>
                  ))}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={addImageField}>+ Add Image</button>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : editId ? 'Update Turf' : 'Create Turf'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
        </div>
      )}
    </div>
  );
}

export default Turfs;

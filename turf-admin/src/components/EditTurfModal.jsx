import { useState, useEffect } from 'react';
import { X, Save, Plus } from 'lucide-react';
import api from '../services/api';
import styles from './EditTurfModal.module.css';

const SPORT_OPTIONS = ['Football', 'Cricket', 'Tennis', 'Basketball', 'Badminton'];
const DEFAULT_AMENITIES = ['Washroom', 'Water', 'Parking', 'Change Room', 'Floodlights', 'Seating', 'First Aid', 'Cafe'];

export default function EditTurfModal({ turfId, onClose, onSave }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customAmenity, setCustomAmenity] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sportTypes: [],
    surfaceType: '',
    amenities: [],
    pricePerHour: '',
    peakHourStart: '18:00',
    peakHourEnd: '23:00',
    peakPricePerHour: '',
    operatingHours: { open: '06:00', close: '23:00' },
  });

  useEffect(() => {
    api.get(`/turfs/${turfId}`)
      .then(res => {
        if (res.data.success) {
          const t = res.data.turf;
          setFormData({
            name: t.name || '',
            description: t.description || '',
            sportTypes: t.sportTypes || [],
            surfaceType: t.surfaceType || '',
            amenities: t.amenities || [],
            pricePerHour: t.pricePerHour || '',
            peakHourStart: t.peakHourStart || '18:00',
            peakHourEnd: t.peakHourEnd || '23:00',
            peakPricePerHour: t.peakPricePerHour || '',
            operatingHours: { 
              open: t.operatingHours?.open || '06:00', 
              close: t.operatingHours?.close || '23:00' 
            },
          });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [turfId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleArrayToggle = (field, value) => {
    setFormData(prev => {
      const arr = prev[field] || [];
      if (arr.includes(value)) {
        return { ...prev, [field]: arr.filter(item => item !== value) };
      } else {
        return { ...prev, [field]: [...arr, value] };
      }
    });
  };

  const handleAddCustomAmenity = () => {
    if (customAmenity.trim() && !formData.amenities.includes(customAmenity.trim())) {
      handleArrayToggle('amenities', customAmenity.trim());
      setCustomAmenity('');
    }
  };

  const handleTimeChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      operatingHours: { ...prev.operatingHours, [field]: value }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.put(`/turf-owner/turf/${turfId}`, formData);
      if (data.success) {
        onSave(data.turf);
      } else {
        alert(data.message || 'Failed to update turf');
      }
    } catch (error) {
      console.error(error);
      alert('Error updating turf');
    } finally {
      setSaving(false);
    }
  };

  // Extract custom amenities that are currently selected but not in DEFAULT_AMENITIES
  const allCurrentAmenities = formData.amenities || [];
  const customSelectedAmenities = allCurrentAmenities.filter(
    a => !DEFAULT_AMENITIES.includes(a)
  );

  if (loading) {
    return (
      <div className={styles.overlay}>
        <div className={styles.modal} style={{ maxWidth: 500, textAlign: 'center' }}>
          <div className={styles.spinner} style={{ margin: '0 auto', borderColor: 'var(--border-strong)', borderTopColor: 'var(--primary)', width: 24, height: 24, borderWidth: 3 }}></div>
          <p style={{ marginTop: 20, color: 'var(--text-secondary)' }}>Loading turf details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className={styles.closeBtn}>
          <X size={20} />
        </button>
        
        <div className={styles.header}>
          <h2 className={styles.title}>Edit Turf Details</h2>
        </div>
        
        <form onSubmit={handleSubmit} className={styles.formGroup}>
          <div>
            <label className={styles.label}>Turf Name</label>
            <input 
              required
              type="text" 
              name="name" 
              value={formData.name} 
              onChange={handleChange} 
              className={styles.input}
            />
          </div>

          <div>
            <label className={styles.label}>Description</label>
            <textarea 
              name="description" 
              value={formData.description} 
              onChange={handleChange} 
              rows={3}
              className={styles.input}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className={styles.grid}>
            <div>
              <label className={styles.label}>Base Price / Hour (₹)</label>
              <input 
                required
                type="number" 
                name="pricePerHour" 
                value={formData.pricePerHour} 
                onChange={handleChange} 
                className={styles.input}
              />
            </div>
            <div>
              <label className={styles.label}>Surface Type</label>
              <input 
                type="text" 
                name="surfaceType" 
                value={formData.surfaceType} 
                onChange={handleChange} 
                placeholder="e.g. Artificial Grass"
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.grid}>
            <div>
              <label className={styles.label}>Opening Time</label>
              <input 
                required
                type="time" 
                value={formData.operatingHours.open} 
                onChange={e => handleTimeChange('open', e.target.value)} 
                className={styles.input}
              />
            </div>
            <div>
              <label className={styles.label}>Closing Time</label>
              <input 
                required
                type="time" 
                value={formData.operatingHours.close} 
                onChange={e => handleTimeChange('close', e.target.value)} 
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.grid}>
            <div>
              <label className={styles.label}>Peak Hour Price (₹)</label>
              <input 
                type="number" 
                name="peakPricePerHour" 
                value={formData.peakPricePerHour} 
                onChange={handleChange} 
                placeholder="Same as base price if empty"
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.grid}>
            <div>
              <label className={styles.label}>Peak Hour Start</label>
              <input 
                type="time" 
                name="peakHourStart"
                value={formData.peakHourStart} 
                onChange={handleChange} 
                className={styles.input}
              />
            </div>
            <div>
              <label className={styles.label}>Peak Hour End</label>
              <input 
                type="time" 
                name="peakHourEnd"
                value={formData.peakHourEnd} 
                onChange={handleChange} 
                className={styles.input}
              />
            </div>
          </div>

          <div>
            <label className={styles.label}>Sports Supported</label>
            <div className={styles.tagsWrap}>
              {SPORT_OPTIONS.map(sport => (
                <button
                  key={sport}
                  type="button"
                  onClick={() => handleArrayToggle('sportTypes', sport)}
                  className={`${styles.tag} ${formData.sportTypes?.includes(sport) ? styles.tagActive : ''}`}
                >
                  {sport}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={styles.label}>Amenities & Special Facilities</label>
            <div className={styles.tagsWrap}>
              {[...DEFAULT_AMENITIES, ...customSelectedAmenities].map(amenity => (
                <button
                  key={amenity}
                  type="button"
                  onClick={() => handleArrayToggle('amenities', amenity)}
                  className={`${styles.tag} ${(formData.amenities || []).includes(amenity) ? styles.tagActive : ''}`}
                >
                  {amenity}
                </button>
              ))}
            </div>
            
            <div className={styles.addCustomWrap}>
              <input 
                type="text" 
                placeholder="Custom facility (e.g., CCTV)" 
                value={customAmenity}
                onChange={(e) => setCustomAmenity(e.target.value)}
                className={styles.input}
                style={{ padding: '8px 12px', boxSizing: 'border-box' }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomAmenity();
                  }
                }}
              />
              <button 
                type="button" 
                className={styles.addCustomBtn}
                onClick={handleAddCustomAmenity}
              >
                <Plus size={16} /> Add
              </button>
            </div>
          </div>

          <div className={styles.footer}>
            <button
              type="button"
              onClick={onClose}
              className={styles.btnCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className={styles.btnSave}
            >
              {saving ? <div className={styles.spinner}></div> : <Save size={18} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

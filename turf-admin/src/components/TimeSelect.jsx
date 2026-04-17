import React from 'react';

const TimeSelect = ({ value, onChange }) => {
  // value is expected to be in 24-hour HH:mm format (e.g., "18:00", "06:30")
  const [hh, mm] = (value || '12:00').split(':');
  
  let hour = parseInt(hh, 10);
  const isPM = hour >= 12;
  if (hour > 12) hour -= 12;
  if (hour === 0) hour = 12;
  
  const handleTimeChange = (e, type) => {
    let newHh = parseInt(hh, 10);
    let newMm = mm;
    let newAmPm = isPM ? 'PM' : 'AM';

    if (type === 'hour') {
      let h = parseInt(e.target.value, 10);
      if (newAmPm === 'PM' && h < 12) h += 12;
      if (newAmPm === 'AM' && h === 12) h = 0;
      newHh = h;
    } else if (type === 'minute') {
      newMm = e.target.value;
    } else if (type === 'ampm') {
      if (e.target.value === 'PM' && newHh < 12) newHh += 12;
      if (e.target.value === 'AM' && newHh >= 12) newHh -= 12;
      newAmPm = e.target.value;
    }

    const formattedHh = String(newHh).padStart(2, '0');
    onChange(`${formattedHh}:${newMm}`);
  };

  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <select 
        value={hour} 
        onChange={e => handleTimeChange(e, 'hour')}
        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff', color: '#333' }}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span>:</span>
      <select 
        value={mm} 
        onChange={e => handleTimeChange(e, 'minute')}
        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff', color: '#333' }}
      >
        {['00', '15', '30', '45'].map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select 
        value={isPM ? 'PM' : 'AM'} 
        onChange={e => handleTimeChange(e, 'ampm')}
        style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff', color: '#333' }}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

export default TimeSelect;

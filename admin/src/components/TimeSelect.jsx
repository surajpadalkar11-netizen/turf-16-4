import React from 'react';

const TimeSelect = ({ value, onChange }) => {
  const [hhStr, mmStr] = (value || '12:00').split(':');
  let hh = parseInt(hhStr, 10);
  if (isNaN(hh)) hh = 12;
  const mm = mmStr || '00';
  
  const isPM = hh >= 12;
  let displayHour = hh % 12;
  if (displayHour === 0) displayHour = 12;
  
  const handleTimeChange = (e, type) => {
    let newDisplayHour = displayHour;
    let newMm = mm;
    let newAmPm = isPM ? 'PM' : 'AM';

    if (type === 'hour') {
      newDisplayHour = parseInt(e.target.value, 10);
    } else if (type === 'minute') {
      newMm = e.target.value;
    } else if (type === 'ampm') {
      newAmPm = e.target.value;
    }

    let newHh24 = newDisplayHour;
    if (newAmPm === 'PM' && newHh24 < 12) newHh24 += 12;
    if (newAmPm === 'AM' && newHh24 === 12) newHh24 = 0;

    const formattedHh = String(newHh24).padStart(2, '0');
    // Ensure minutes are padded and default to 00 if missing or invalid
    const formattedMm = String(newMm).padStart(2, '0');
    onChange(`${formattedHh}:${formattedMm}`);
  };

  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <select 
        value={displayHour} 
        onChange={e => handleTimeChange(e, 'hour')}
        className="input"
        style={{ padding: '8px', minWidth: '60px' }}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <span>:</span>
      <select 
        value={mm} 
        onChange={e => handleTimeChange(e, 'minute')}
        className="input"
        style={{ padding: '8px', minWidth: '60px' }}
      >
        {['00', '15', '30', '45'].map(m => (
          <option key={m} value={m}>{m}</option>
        ))}
      </select>
      <select 
        value={isPM ? 'PM' : 'AM'} 
        onChange={e => handleTimeChange(e, 'ampm')}
        className="input"
        style={{ padding: '8px', minWidth: '70px' }}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

export default TimeSelect;

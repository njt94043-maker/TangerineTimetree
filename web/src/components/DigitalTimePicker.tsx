interface DigitalTimePickerProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

export function DigitalTimePicker({ value, onChange, id }: DigitalTimePickerProps) {
  const [h, m] = value ? value.split(':') : ['', ''];

  function update(newH: string, newM: string) {
    if (newH && newM) {
      onChange(`${newH}:${newM}`);
    } else if (newH && !newM) {
      onChange(`${newH}:00`);
    } else if (!newH && newM) {
      onChange(`00:${newM}`);
    }
  }

  return (
    <div className="digital-time-picker" id={id}>
      <select
        className="digital-time-select"
        value={h}
        onChange={e => update(e.target.value, m || '00')}
      >
        <option value="">HH</option>
        {HOURS.map(hr => (
          <option key={hr} value={hr}>{hr}</option>
        ))}
      </select>
      <span className="digital-time-colon">:</span>
      <select
        className="digital-time-select"
        value={m}
        onChange={e => update(h || '00', e.target.value)}
      >
        <option value="">MM</option>
        {MINUTES.map(mn => (
          <option key={mn} value={mn}>{mn}</option>
        ))}
      </select>
    </div>
  );
}

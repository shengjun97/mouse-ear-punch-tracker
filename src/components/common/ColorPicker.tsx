import { GROUP_COLORS } from '../../domain/models';

interface Props {
  label: string;
  value: string;
  onChange: (color: string) => void;
}

/** Preset swatches plus a custom color input. */
export function ColorPicker({ label, value, onChange }: Props) {
  const isPreset = GROUP_COLORS.some((c) => c.value.toLowerCase() === value.toLowerCase());
  return (
    <fieldset className="color-picker">
      <legend>{label}</legend>
      <div className="swatches">
        {GROUP_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            className="swatch"
            style={{ background: c.value }}
            aria-label={c.name}
            aria-pressed={c.value.toLowerCase() === value.toLowerCase()}
            title={c.name}
            onClick={() => onChange(c.value)}
          />
        ))}
        <label className={`swatch custom${isPreset ? '' : ' active'}`} title="Custom color">
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Custom color" />
        </label>
      </div>
    </fieldset>
  );
}

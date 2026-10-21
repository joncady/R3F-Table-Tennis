import { SPONGE_PRESETS, SpongeThickness } from './engine';
import { Equipment, PADDLE_COLORS, PaddleColor } from './equipment';
export default function EquipmentPanel({
  equipment,
  change,
  close,
  locked,
  restart,
}: {
  equipment: Equipment;
  change: (value: Equipment) => void;
  close: () => void;
  locked: boolean;
  restart: () => void;
}) {
  return (
    <aside
      className="equipment-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Paddle setup"
    >
      <button onClick={close}>Close paddle setup</button>
      <h2>Your paddle</h2>
      <p>One matte black face. Choose the other face.</p>
      <fieldset disabled={locked}>
        <legend>Rubber color</legend>
        <div className="color-swatches">
          {Object.entries(PADDLE_COLORS).map(([color, hex]) => (
            <button
              key={color}
              aria-label={`${color} rubber`}
              aria-pressed={equipment.color === color}
              style={{ background: hex }}
              onClick={() =>
                change({ ...equipment, color: color as PaddleColor })
              }
            >
              {color}
            </button>
          ))}
        </div>
        <label>
          Sponge thickness
          <select
            value={equipment.sponge}
            onChange={(e) =>
              change({
                ...equipment,
                sponge: Number(e.target.value) as SpongeThickness,
              })
            }
          >
            {([1.7, 1.9, 2.1] as const).map((value) => (
              <option key={value} value={value}>
                {value.toFixed(1)} mm · {SPONGE_PRESETS[value].label}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <p>
        {locked
          ? 'Finish this match to change equipment.'
          : 'Saved for both game modes. Choose before starting a match.'}
      </p>
      {locked && (
        <button onClick={restart}>New match to change equipment</button>
      )}
      <p>
        1.9 mm keeps the original feel. Thicker sponge adds modest pace and spin
        potential on stronger brushes; thinner favors a quieter response. This
        is an arcade approximation, not a measured rubber simulation.
      </p>
      <small>
        Thickness is sponge only; the topsheet is separate. Real sandwich
        covering plus adhesive must remain under 4.05 mm in the 2026 ITTF laws.
        Digital color presets are inspired by the permitted palette; physical
        rubbers require approval.
      </small>
    </aside>
  );
}

/**
 * Determines whether white or black text has better contrast against a given
 * background hex color. Uses the W3C relative luminance formula.
 */
function contrastText(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

export function LabelBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="badge badge-sm"
      style={{ backgroundColor: color, color: contrastText(color) }}
    >
      {name}
    </span>
  );
}

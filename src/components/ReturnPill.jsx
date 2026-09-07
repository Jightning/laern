export default function ReturnPill({ stack, onBack }) {
  if (!stack.length) return null;
  const top = stack[stack.length - 1];
  return (
    <button class="pill on" onClick={onBack} aria-label="Return to previous location">
      <span class="ar">←</span>
      <span class="lbl">Back to {top.label}</span>
      {stack.length > 1 && <span class="pd">{stack.length}</span>}
    </button>
  );
}

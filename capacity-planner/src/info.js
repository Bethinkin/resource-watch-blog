// Small helper: returns markup for an "i" info icon with a hover tooltip.
// Pass `pos: "below"` or `"right"` to control overflow placement.
window.info = function info(text, pos) {
  const safe = String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const cls = ['info', pos === 'below' ? 'below' : '', pos === 'right' ? 'right' : '']
    .filter(Boolean)
    .join(' ');
  return `<span class="${cls}" tabindex="0" role="img" aria-label="Help: ${safe}" data-info="${safe}">i</span>`;
};

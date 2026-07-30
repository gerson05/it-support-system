/* Auto-tags <td> cells with data-label + a semantic role so the mobile CSS
   (styles.css → RESPONSIVE — MOBILE) can render tables as dense rows:
   a status dot (from the row's badge color), title + badge on one line,
   id as a muted line below, and everything else (chips/long text/actions)
   tucked behind a tap-to-expand toggle (.rt-open on the <tr>).

   Roles:
   rt-hide   — purely decorative cell (no label, no text, no interactive
               element — e.g. a lone status dot that duplicates a badge)
   rt-actions— contains buttons/links — footer row
   rt-badge  — contains a pill/badge (.badge class or the inline
               border-radius:99px convention used across this codebase) —
               becomes the header-right chip and drives the card's stripe color
   rt-id     — first monospace-looking cell (or first cell, as fallback) —
               header-left, bold/monospace
   rt-title  — the longest remaining text — the card's subtitle line
   rt-chip   — short remaining values — wrapped inline chips
   rt-wide   — long remaining values — own full-width line              */

const COMPACT_MAX_CHARS = 26;

function findBadgeEl(td) {
  if (td.classList.contains('badge')) return td;
  return td.querySelector('.badge, [style*="border-radius:99px"], [style*="border-radius: 99px"]');
}

function isMonoCell(td) {
  return td.classList.contains('td-mono') ||
    !!td.querySelector('.td-mono') ||
    /font-family:\s*monospace/i.test(td.outerHTML);
}

function classifyRow(tr, labels) {
  const cells = Array.from(tr.children).map((td, i) => ({
    td, label: (labels[i] || '').trim(), role: null,
  }));

  cells.forEach(c => {
    const hasInteractive = c.td.querySelector('button, a, input, select');
    const text = c.td.textContent.trim();
    if (!c.label && !hasInteractive && !text) c.role = 'hide';
    else if (hasInteractive) c.role = 'actions';
    else if (findBadgeEl(c.td)) c.role = 'badge';
  });

  const remaining = () => cells.filter(c => !c.role);

  let idCell = remaining().find(c => isMonoCell(c.td)) || remaining()[0];
  if (idCell) idCell.role = 'id';

  const titleCell = remaining().reduce((longest, c) => {
    const len = c.td.textContent.trim().length;
    return len > (longest ? longest.len : -1) ? { c, len } : longest;
  }, null);
  if (titleCell) titleCell.c.role = 'title';

  cells.forEach(c => {
    if (c.role) return;
    const long = c.td.textContent.trim().length > COMPACT_MAX_CHARS || c.td.children.length > 1;
    c.role = long ? 'wide' : 'chip';
  });

  return cells;
}

function applyStripe(tr, cells) {
  const badgeCell = cells.find(c => c.role === 'badge');
  const badgeEl = badgeCell && findBadgeEl(badgeCell.td);
  const color = badgeEl ? getComputedStyle(badgeEl).color : '';
  tr.style.setProperty('--stripe', color || 'var(--border-2)');
}

const ROLES = ['hide', 'actions', 'badge', 'id', 'title', 'chip', 'wide'];

function labelizeTable(table) {
  // Permission matrix has its own dedicated mobile layout (styles.css) —
  // the generic classifier treats any cell with an <input> as an "action"
  // and hides it behind tap-to-expand, wrong for a grid of checkboxes
  // meant to stay visible and toggleable at a glance.
  if (table.classList.contains('perm-table')) return;
  const headerCells = table.querySelectorAll('thead th');
  if (!headerCells.length) return;
  const labels = Array.from(headerCells).map(th => th.textContent.trim());
  table.querySelectorAll('tbody tr').forEach(tr => {
    Array.from(tr.children).forEach((td, i) => {
      if (i < labels.length) td.setAttribute('data-label', labels[i]);
    });
    const cells = classifyRow(tr, labels);
    cells.forEach(c => {
      c.td.classList.remove(...ROLES.map(r => `rt-${r}`));
      c.td.classList.add(`rt-${c.role}`);
    });
    applyStripe(tr, cells);
  });
}

export function initResponsiveTables(root) {
  if (!root) return;
  root.querySelectorAll('table').forEach(labelizeTable);
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach(node => {
        if (!(node instanceof HTMLElement)) return;
        if (node.tagName === 'TABLE') labelizeTable(node);
        node.querySelectorAll?.('table').forEach(labelizeTable);
      });
    }
  });
  observer.observe(root, { childList: true, subtree: true });

  // Tap a row to reveal the fields tucked away for mobile (chips/long
  // text/actions). Delegated on `root` so it works for rows added later.
  // No-ops on desktop widths — .rt-open only has a visual effect under the
  // mobile media query in styles.css.
  root.addEventListener('click', (e) => {
    if (e.target.closest('button, a, input, select, label')) return;
    const tr = e.target.closest('tbody tr');
    if (!tr || !tr.closest('table')?.querySelector('thead')) return;
    tr.classList.toggle('rt-open');
  });

  return observer;
}

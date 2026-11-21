// Game controller input (browser Gamepad API, "standard" mapping: PS4 DualShock, Xbox, Steam's virtual pad).
// No dependencies, so the main menu can use it before three.js loads.
//
// - Several pads may be connected (Steam adds a virtual Xbox pad beside the real one, and both report the same
//   presses). The game follows the pad used last: another pad takes over only once the current one is idle, so a
//   mirrored pair never fires a press twice.
// - Edges (pressed / released) are computed per poll; the game polls once per frame through tick().
// - createMenuNav() moves DOM focus between the visible controls of a menu with the d-pad / left stick.

export const BUTTON = {
  cross: 0, circle: 1, square: 2, triangle: 3, l1: 4, r1: 5, l2: 6, r2: 7, share: 8, options: 9,
  l3: 10, r3: 11, up: 12, down: 13, left: 14, right: 15, ps: 16, touchpad: 17,
};
const PRESS = 0.5;        // a button (or trigger) counts as held past this value
const STICK_WAKE = 0.6;   // a stick this far out counts as "this pad is being used"
const TAKEOVER_MS = 150;  // another pad takes over only after the followed one has been idle this long (a mirror lags)
const TAKEOVER_POLLS = 2; // ... and for this many polls, so a slow frame can't let a one-poll-late mirror through

export function createPad({ deadzone = 0.18 } = {}) {
  const prev = new Map();   // pad index -> last poll's held buttons (booleans) and stick magnitude
  let busyAt = -Infinity;   // performance.now() when the followed pad last had a button held or a stick pushed
  let idlePolls = Infinity; // polls in a row the followed pad has been idle
  const pad = {
    index: -1,              // the followed pad (navigator.getGamepads() index), -1 = none
    id: '',
    connected: false,
    now: [], before: [],    // held state of the followed pad this poll / last poll
    axes: [0, 0, 0, 0],     // raw stick axes of the followed pad (LX, LY, RX, RY)
    activity: 0,            // performance.now() of the last press or stick push on any pad
    held(name) { return !!this.now[BUTTON[name]]; },
    pressed(name) { const b = BUTTON[name]; return !!this.now[b] && !this.before[b]; },
    released(name) { const b = BUTTON[name]; return !this.now[b] && !!this.before[b]; },
    value(name) { return this.raw?.buttons[BUTTON[name]]?.value ?? 0; },
    // A stick with a radial deadzone, rescaled so it still reaches 1: { x, y, mag } (y down = +1, as the pad reports)
    stick(side) {
      const i = side === 'right' ? 2 : 0, x = this.axes[i] || 0, y = this.axes[i + 1] || 0, m = Math.hypot(x, y);
      if (m < deadzone) return { x: 0, y: 0, mag: 0 };
      const k = Math.min(1, (m - deadzone) / (1 - deadzone)) / m;
      return { x: x * k, y: y * k, mag: Math.min(1, m * k) };
    },
    raw: null,
    poll,
  };
  function poll() {
    let list = [];
    try { list = [...(navigator.getGamepads?.() || [])]; } catch { list = []; }
    const pads = list.filter(p => p && p.connected !== false);
    // Prefer pads the browser maps to the standard layout; fall back to any pad (only its buttons count then)
    const usable = pads.some(p => p.mapping === 'standard') ? pads.filter(p => p.mapping === 'standard') : pads;
    const state = new Map(), now = performance.now();
    let woke = null;
    for (const p of usable) {
      const held = [...p.buttons].map(b => (typeof b === 'object' ? b.pressed || b.value >= PRESS : b >= PRESS));
      const stick = p.mapping === 'standard' ? Math.max(0, ...[0, 1, 2, 3].map(i => Math.abs(p.axes[i] || 0))) : 0;
      const last = prev.get(p.index) || { held: held.map(() => false), stick: 0 };
      const rose = held.some((h, i) => h && !last.held[i]) || (stick >= STICK_WAKE && last.stick < STICK_WAKE);
      state.set(p.index, { p, held, stick, last, rose, idle: !held.some(Boolean) && stick < deadzone });
      if (rose) { pad.activity = now; if (!woke && p.index !== pad.index) woke = p; }
    }
    // Follow another pad only when it just woke and the followed one has been idle for a moment (or is gone): a
    // mirrored pair, whose copy can lag a poll behind, never fires the same press twice
    let cur = state.get(pad.index) || null, before;
    if (cur && !cur.idle) { busyAt = now; idlePolls = 0; } else idlePolls++;
    if (woke && (!cur || (now - busyAt >= TAKEOVER_MS && idlePolls >= TAKEOVER_POLLS))) {
      cur = state.get(woke.index); before = cur.last.held; busyAt = now; idlePolls = 0;
    }
    else if (cur) before = cur.last.held;
    else if (usable.length) { cur = state.get(usable[0].index); before = cur.held; }   // pad swap: nothing fires
    pad.raw = cur?.p || null;
    pad.index = cur ? cur.p.index : -1;
    pad.id = cur?.p.id || '';
    pad.connected = !!cur;
    pad.now = cur ? cur.held : [];
    pad.before = before || [];
    pad.axes = cur ? [0, 1, 2, 3].map(i => cur.p.axes[i] || 0) : [0, 0, 0, 0];
    prev.clear();
    for (const [index, s] of state) prev.set(index, { held: s.held, stick: s.stick });
    return pad;
  }
  return pad;
}

// Direction repeat for menus: first step at once, then after `delay`, then every `rate` ms while held.
export function createRepeater({ delay = 380, rate = 120 } = {}) {
  let dir = null, next = 0;
  return function step(want, now = performance.now()) {
    if (want !== dir) { dir = want; next = now + delay; return want; }
    if (want && now >= next) { next = now + rate; return want; }
    return null;
  };
}

// Pad direction this poll: d-pad first, else the left stick past 0.5 (dominant axis)
export function padDirection(pad) {
  if (pad.held('up')) return 'up';
  if (pad.held('down')) return 'down';
  if (pad.held('left')) return 'left';
  if (pad.held('right')) return 'right';
  const x = pad.axes[0] || 0, y = pad.axes[1] || 0;
  if (Math.max(Math.abs(x), Math.abs(y)) < 0.5) return null;
  return Math.abs(x) > Math.abs(y) ? (x < 0 ? 'left' : 'right') : (y < 0 ? 'up' : 'down');
}

const FOCUSABLE = 'button, select, input[type="range"], [data-pad-focus]';
function visible(el) {
  if (el.disabled || el.closest('[hidden]')) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const s = getComputedStyle(el);
  return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05;
}
// Nearest visible control from `from` toward `dir`, scored by distance with a penalty for leaving the axis.
// `sameRow` (left / right) only accepts controls that overlap the current one vertically.
function neighbour(list, from, dir, sameRow) {
  const a = from.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
  let best = null, bestScore = Infinity;
  for (const el of list) {
    if (el === from) continue;
    const b = el.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const dx = bx - ax, dy = by - ay;
    const along = dir === 'left' ? -dx : dir === 'right' ? dx : dir === 'up' ? -dy : dy;
    const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (along <= 4) continue;
    if (sameRow && (b.bottom < a.top + 4 || b.top > a.bottom - 4)) continue;
    const score = along + across * 2.2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  return best;
}

// Menu navigation over a root element. Returns { update(pad), focus(el), first() }.
// options.root(): the element whose controls are navigable now (null = menu closed)
// options.primary(root): the control to focus when nothing in the root has focus
// options.back(): Circle
// options.adjust(el, step): optional override for changing a select / range (return true when handled)
export function createMenuNav({ root, primary, back, onMove }) {
  const repeat = createRepeater();
  function controls(r) { return [...r.querySelectorAll(FOCUSABLE)].filter(visible); }
  function focus(el) {
    if (!el) return;
    el.focus({ preventScroll: true });
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
  function adjust(el, step) {
    if (el.tagName === 'SELECT') {
      const n = el.options.length;
      if (n < 2) return false;
      let i = el.selectedIndex;
      for (let t = 0; t < n; t++) { i = (i + step + n) % n; if (!el.options[i].disabled) break; }
      el.selectedIndex = i;
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (el.type === 'range') {
      const before = el.value;
      if (step > 0) el.stepUp(); else el.stepDown();
      if (el.value === before) return false;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    return false;
  }
  function update(pad) {
    const r = root();
    if (!r) return false;
    const list = controls(r);
    if (!list.length) return false;
    let cur = document.activeElement;
    if (!r.contains(cur) || !list.includes(cur)) cur = null;
    const dir = repeat(padDirection(pad));
    if (!cur && (dir || pad.pressed('cross'))) { focus(primary?.(r, list) || list[0]); onMove?.(); return true; }
    if (dir && cur) {
      const horizontal = dir === 'left' || dir === 'right';
      // A slider takes ← → as its value; a select only when nothing sits beside it
      if (horizontal && cur.type === 'range') { if (adjust(cur, dir === 'left' ? -1 : 1)) onMove?.(); return true; }
      const next = neighbour(list, cur, dir, horizontal);
      if (next) { focus(next); onMove?.(); }
      else if (horizontal && adjust(cur, dir === 'left' ? -1 : 1)) onMove?.();
      return true;
    }
    if (cur && pad.pressed('cross')) {
      if (cur.tagName === 'SELECT' || cur.type === 'range') adjust(cur, 1);
      else cur.click();
      return true;
    }
    if (cur && pad.pressed('square') && (cur.tagName === 'SELECT' || cur.type === 'range')) { adjust(cur, -1); return true; }
    if (pad.pressed('circle')) { back?.(); return true; }
    return false;
  }
  return { update, focus, controls, adjust };
}

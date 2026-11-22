// Keyboard + mouse input for Solmar Nights 3D.

export const keys = {};
export const pressed = {};   // edge-triggered: consumed by main loop
export const mouse = { dx: 0, dy: 0, down: false, clicked: false, cx: 0, cy: 0 };

let attached = false;

export function attachInput() {
  if (attached) return;
  attached = true;
  window.addEventListener('keydown', e => {
    if (e.repeat) return;
    keys[e.code] = true;
    pressed[e.code] = true;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  window.addEventListener('mousedown', e => {
    mouse.down = true; mouse.clicked = true;
    mouse.cx = e.clientX; mouse.cy = e.clientY;
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  window.addEventListener('mousemove', e => {
    if (mouse.down) { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; }
  });
  window.addEventListener('contextmenu', e => e.preventDefault());
}

export function endFrameInput() {
  for (const k in pressed) pressed[k] = false;
  mouse.dx = 0; mouse.dy = 0; mouse.clicked = false;
}

export const down = code => !!keys[code];
export const hit = code => !!pressed[code];

export function moveInput() {
  // Returns {f, s} forward/strafe in -1..1 from WASD/arrows.
  let f = 0, s = 0;
  if (down('KeyW') || down('ArrowUp')) f += 1;
  if (down('KeyS') || down('ArrowDown')) f -= 1;
  if (down('KeyA') || down('ArrowLeft')) s -= 1;
  if (down('KeyD') || down('ArrowRight')) s += 1;
  return { f, s };
}

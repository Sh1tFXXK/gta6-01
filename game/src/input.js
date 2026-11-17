// input.js — keyboard + mouse state for the canvas game. One job: input.
export function createInput(canvas) {
  const keys = {};
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  const pressed = {}; // edge-triggered keys, consumed by the game each frame
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    if (!keys[e.key.toLowerCase()]) pressed[e.key.toLowerCase()] = true;
    keys[e.key.toLowerCase()] = true;
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { mouse.down = true; mouse.clicked = true; } });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return {
    keys, mouse, pressed,
    down(...names) { return names.some((n) => keys[n]); },
    consume(name) { const v = !!pressed[name]; pressed[name] = false; return v; },
    endFrame() { for (const k in pressed) pressed[k] = false; mouse.clicked = false; },
  };
}

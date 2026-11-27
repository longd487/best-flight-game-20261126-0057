// Ridge Runner — input: keyboard and mouse. The stick is the arrow keys
// (or WASD); Shift / Ctrl work the throttle; the mouse steers by position
// when it moves and clicks to start. P pauses, M mutes, R restarts.

/** Live input state, read once per fixed step. */
export function createInput() {
  return {
    keys: new Set(),
    mouseX: 0.5,
    mouseY: 0.5,
    mouseActive: false,
    mouseDown: false,
    pressed: new Set(),
  };
}

const KEYMAP = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ShiftLeft: 'throttleUp',
  ShiftRight: 'throttleUp',
  ControlLeft: 'throttleDown',
  ControlRight: 'throttleDown',
  Enter: 'confirm',
  Space: 'confirm',
  KeyP: 'pause',
  KeyM: 'mute',
  KeyR: 'restart',
};

/** Attach listeners to the window; returns the shared input state. */
export function attachInput(canvas) {
  const input = createInput();
  window.addEventListener('keydown', (event) => {
    const name = KEYMAP[event.code];
    if (!name) return;
    event.preventDefault();
    if (!input.keys.has(name)) input.pressed.add(name);
    input.keys.add(name);
  });
  window.addEventListener('keyup', (event) => {
    const name = KEYMAP[event.code];
    if (name) input.keys.delete(name);
  });
  window.addEventListener('blur', () => input.keys.clear());
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = (event.clientX - rect.left) / rect.width;
    input.mouseY = (event.clientY - rect.top) / rect.height;
    input.mouseActive = true;
  });
  canvas.addEventListener('mousedown', (event) => {
    event.preventDefault();
    input.mouseDown = true;
    input.pressed.add('confirm');
  });
  canvas.addEventListener('mouseup', () => {
    input.mouseDown = false;
  });
  return input;
}

/**
 * Read the stick for one step: pitch -1..1 (up is positive), roll -1..1
 * (right is positive), throttle -1..1 (up is positive). The mouse steers
 * when it has moved; the keys always win when they are held.
 */
export function readStick(input) {
  let pitch = 0;
  let roll = 0;
  if (input.keys.has('up')) pitch += 1;
  if (input.keys.has('down')) pitch -= 1;
  if (input.keys.has('left')) roll -= 1;
  if (input.keys.has('right')) roll += 1;
  if (pitch === 0 && roll === 0 && input.mouseActive && !input.mouseDown) {
    roll = (input.mouseX - 0.5) * 2.4;
    pitch = (0.5 - input.mouseY) * 1.6;
  }
  let throttle = 0;
  if (input.keys.has('throttleUp')) throttle += 1;
  if (input.keys.has('throttleDown')) throttle -= 1;
  return {
    pitch: Math.max(-1, Math.min(1, pitch)),
    roll: Math.max(-1, Math.min(1, roll)),
    throttle,
  };
}

/** True once when a named action key was pressed since the last call. */
export function wasPressed(input, name) {
  if (!input.pressed.has(name)) return false;
  input.pressed.delete(name);
  return true;
}

/** Clear one-shot presses (call once per rendered frame). */
export function clearPressed(input) {
  input.pressed.clear();
}

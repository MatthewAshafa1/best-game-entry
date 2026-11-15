// Starlight Salvage — input.
// Tracks keyboard and mouse state in one place. The game reads this each
// frame; nothing here knows about ships or waves.

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false, inside: false };
  const pressed = new Set(); // keys pressed since the last consume

  function keyName(event) {
    // Normalised to lower case, so 'Enter', 'ENTER' and 'enter' are one key
    // everywhere: wasPressed() lower-cases its query too.
    return event.key.toLowerCase();
  }

  function onKeyDown(event) {
    const name = keyName(event);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    if (!event.repeat) pressed.add(name);
    keys.add(name);
  }

  function onKeyUp(event) {
    keys.delete(keyName(event));
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
    mouse.inside = true;
  }

  function onMouseDown(event) {
    if (event.button === 0) mouse.down = true;
  }

  function onMouseUp(event) {
    if (event.button === 0) mouse.down = false;
  }

  function onBlur() {
    keys.clear();
    mouse.down = false;
    pressed.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', () => {
    mouse.inside = false;
  });

  return {
    // Held-down movement keys as a unit vector (x right, y down).
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      if (x !== 0 && y !== 0) {
        const length = Math.hypot(x, y);
        x /= length;
        y /= length;
      }
      return { x, y };
    },
    firing() {
      return mouse.down || keys.has(' ');
    },
    mouse,
    // True once for each fresh key press; consumed after the game reads it.
    wasPressed(name) {
      return pressed.has(name.toLowerCase());
    },
    endFrame() {
      pressed.clear();
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}

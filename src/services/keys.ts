const NAMED_KEYS: Record<string, number> = {
  backspace: 0x08,
  tab: 0x09,
  enter: 0x0d,
  return: 0x0d,
  shift: 0x10,
  ctrl: 0x11,
  control: 0x11,
  alt: 0x12,
  pause: 0x13,
  capslock: 0x14,
  esc: 0x1b,
  escape: 0x1b,
  space: 0x20,
  pageup: 0x21,
  pagedown: 0x22,
  end: 0x23,
  home: 0x24,
  left: 0x25,
  up: 0x26,
  right: 0x27,
  down: 0x28,
  printscreen: 0x2c,
  insert: 0x2d,
  delete: 0x2e,
  del: 0x2e,
  win: 0x5b,
  windows: 0x5b,
  meta: 0x5b,
  cmd: 0x5b,
  menu: 0x5d,
  numlock: 0x90,
  scrolllock: 0x91,
  volumemute: 0xad,
  volumedown: 0xae,
  volumeup: 0xaf,
  nexttrack: 0xb0,
  prevtrack: 0xb1,
  stop: 0xb2,
  playpause: 0xb3,
  plus: 0xbb,
  minus: 0xbd,
};

const SYMBOL_KEYS: Record<string, number> = {
  ";": 0xba,
  "=": 0xbb,
  ",": 0xbc,
  "-": 0xbd,
  ".": 0xbe,
  "/": 0xbf,
  "`": 0xc0,
  "[": 0xdb,
  "\\": 0xdc,
  "]": 0xdd,
  "'": 0xde,
};

export const MEDIA_KEYS = {
  play_pause: 0xb3,
  next: 0xb0,
  previous: 0xb1,
  stop: 0xb2,
  mute: 0xad,
  volume_up: 0xaf,
  volume_down: 0xae,
} as const;

export type MediaKey = keyof typeof MEDIA_KEYS;

export class KeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KeyError";
  }
}

export function keyCode(name: string): number {
  const key = name.trim().toLowerCase();
  const named = NAMED_KEYS[key] ?? SYMBOL_KEYS[key];
  if (named !== undefined) return named;
  if (/^[a-z0-9]$/.test(key)) return key.toUpperCase().charCodeAt(0);

  const functionKey = /^f([1-9]|1\d|2[0-4])$/.exec(key);
  if (functionKey) return 0x6f + Number(functionKey[1]);

  throw new KeyError(
    `Unknown key "${name}". Use letters, digits, f1-f24, or names like enter, esc, tab, ctrl, shift, alt, win, up, down, delete.`,
  );
}

export function parseCombo(combo: string): number[] {
  const parts = combo.split("+").map((part) => part.trim());
  if (parts.length === 0 || parts.some((part) => part.length === 0)) {
    throw new KeyError(`Invalid key combo "${combo}". Write keys joined with +, e.g. ctrl+shift+esc (use "plus" for +).`);
  }
  return parts.map(keyCode);
}

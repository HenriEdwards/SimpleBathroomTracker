export const ICON_PRESETS: string[] = [
  '\u{1F6BD}', // toilet
  '\u{1F4A7}', // droplet
  '\u{1F6B0}', // potable water
  '\u{1F30A}', // water wave
  '\u{1F4A6}', // sweat droplets
  '\u{1F4A9}', // pile of poo
  '\u{1F331}', // seedling
  '\u{1F9FB}', // toilet paper
  '\u{1F6BE}', // water closet
  '\u{1F642}', // slightly smiling face
  '\u{2B50}', // star
  '\u{1F6C1}', // bathtub
  '\u{1F6BF}', // shower
  '\u{1F9FC}', // soap
  '\u{1F9FD}', // sponge
  '\u{1F9F4}', // lotion bottle
  '\u{1FAA3}', // bucket
  '\u{1FAA0}', // plunger
  '\u{1F9FA}', // basket
  '\u{1F33F}', // herb
  '\u{1F338}', // cherry blossom
  '\u{2728}', // sparkles
  '\u{1F319}', // crescent moon
];

export const DEFAULT_PEE_ICON = '\u{1F4A7}';
export const DEFAULT_POOP_ICON = '\u{1F4A9}';

export function isValidIcon(icon: string): boolean {
  return typeof icon === 'string' && ICON_PRESETS.includes(icon);
}

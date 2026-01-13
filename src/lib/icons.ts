export const ICON_PRESETS: string[] = [
  '\u{1F6BD}', // toilet
  '\u{1F4A7}', // droplet
  '\u{1F6B0}', // potable water
  '\u{1F30A}', // water wave
  '\u{1F4A6}', // sweat droplets
  '\u{1F326}', // cloud with rain
  '\u{2614}', // umbrella with rain
  '\u{1F9FC}', // soap
  '\u{1F9FD}', // sponge
  '\u{1F9F4}', // lotion bottle
  '\u{1F4A9}', // pile of poo
  '\u{1F331}', // seedling
  '\u{1F9FB}', // toilet paper
  '\u{1F6BE}', // water closet
  '\u{1F642}', // slightly smiling face
  '\u{2B50}', // star
  '\u{1F6C1}', // bathtub
  '\u{1F6BF}', // shower
  '\u{1FAA3}', // bucket
  '\u{1FAA0}', // plunger
  '\u{1F9FA}', // basket
  '\u{1F33F}', // herb
  '\u{1F338}', // cherry blossom
  '\u{1F31F}', // glowing star
  '\u{2728}', // sparkles
  '\u{1F319}', // crescent moon
  '\u{1F535}', // blue circle
  '\u{1F7E2}', // green circle
  '\u{1F7E1}', // yellow circle
  '\u{1F7E0}', // orange circle
  '\u{1F7E5}', // red circle
  '\u{1F7E3}', // purple circle
  '\u{1F7E4}', // brown circle
  '\u{1F7E6}', // blue square
  '\u{1F7E7}', // orange square
  '\u{1F7E8}', // yellow square
  '\u{1F7E9}', // green square
  '\u{1F7EA}', // purple square
  '\u{1F7EB}', // brown square
  '\u{2B1B}', // black square
  '\u{2B1C}', // white square
  '\u{1F536}', // large orange diamond
  '\u{1F537}', // large blue diamond
  '\u{1F538}', // small orange diamond
  '\u{1F539}', // small blue diamond
  '\u{25CF}', // black circle
  '\u{25CB}', // white circle
  '\u{25A0}', // black square
  '\u{25A1}', // white square
  '\u{25B2}', // black triangle
  '\u{25B3}', // white triangle
  '\u{25C6}', // black diamond
  '\u{25C7}', // white diamond
];

export const DEFAULT_PEE_ICON = '\u{1F4A7}';
export const DEFAULT_POOP_ICON = '\u{1F4A9}';

export function isValidIcon(icon: string): boolean {
  return typeof icon === 'string' && ICON_PRESETS.includes(icon);
}

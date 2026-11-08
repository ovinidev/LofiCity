/* Indexed palette (65 shared entries plus Esperança's facade colors). Every index has a night color and a day color; the grader
   blends them by sun height, tints for golden hour and twilight, greys them under overcast,
   and replaces the sky ramp with time-of-day keyframes. Scenes only ever write indices. */

export const VOID = 0, SKY1 = 1, SKY2 = 2, SKY3 = 3, SKY4 = 4, HAZE = 5, GLOWO = 6, GLOWI = 7,
  BFAR = 8, BMID = 9, BNEAR = 10, WDIM = 11, WWARM = 12, WCOOL = 13, MAG = 14, MAGD = 15,
  CYAN = 16, CYAND = 17, AMB = 18, LIGHT = 19, AMBD = 20, WOOD = 21, STONE = 22, STONEL = 23,
  ASPH = 24, WET = 25, RAIN = 26, RAINB = 27, WHITE = 28, HALO = 29, FOG = 30, STEEL = 31,
  SNOW = 32, SNOWS = 33, PETAL = 34, LEAF1 = 35, LEAF2 = 36, SUN = 37, MOON = 38, CLOUD = 39,
  CLOUDD = 40, SKIN1 = 41, SKIN2 = 42, SKIN3 = 43, SKIN4 = 44, HAIR1 = 45, HAIR2 = 46, HAIR3 = 47,
  CRED = 48, CBLUE = 49, CGREEN = 50, CBEIGE = 51, CNAVY = 52, CYELL = 53, FWG = 54, BOLT = 55,
  LEAFG = 56, LEAFGD = 57, SAKURA = 58, SAKURAD = 59, MOMIJI = 60, BARK = 61, UMB = 62, CORNG = 63,
  /** Distant hazy towers: graded as a mix of the mid-sky color and far buildings. */
  FARB = 64,
  // Esperança: church ochre, pilaster stone, cream trim, terracotta, white LED, casario pastels, Virgin's mantle, gilding
  CHURCH = 65, CHURCHD = 66, CHURCHL = 67, TERRA = 68, LEDW = 69, FPINK = 70, FBLUE = 71, FGREEN = 72, FORNG = 73,
  FLILAC = 74, MANTO = 75, GOLD = 76, TILEW = 77,
  /** A lit red traffic-light lamp (a light source). */
  SIGR = 78;

export const NPAL = 79;

// prettier-ignore
export const NIGHT_HEX = [
  '#07060f','#0d0b1f','#141634','#1e1e4a','#34285e','#4a3366','#3b4f86','#8a5a8c',
  '#18183a','#11112a','#0b0b1d','#3a3a6a','#c98b4a','#5fb3c9','#ff4fa3','#7a2456',
  '#4ff0ff','#1f6f86','#ffb347','#ffcf7a','#b8672e','#3a2230','#2a2a44','#3d3d5c',
  '#12121f','#1a1a2e','#8fa3d9','#c9d6ff','#f2eee6','#ffe2a6','#2b2f55','#262848',
  '#c8d0ea','#7d86ad','#c98aa8','#8a3a2e','#9a6a2a','#fff4d6','#e8e6d8','#2a2644',
  '#1a1832','#8a6f78','#6e5260','#4e3a48','#33263a','#0a0912','#2e1f24','#6e6e88',
  '#6a2438','#24356a','#1e3e38','#4a4048','#141c38','#6e5a2a','#7dff8a','#ece8ff',
  '#14261e','#0e1a16','#7a4a66','#553048','#6a2228','#1a1218','#5a6488','#6a3a24',
  '#1e1e4a',
  '#5c4a2e','#3f3224','#6e6046','#3e2622','#f2f6ff','#3e2c3a','#22304a','#203a30','#46301e',
  '#2e2a48','#1e2c5c','#7a6430','#4a4e5e',
  '#ff3a2c'];

// prettier-ignore
export const DAY_HEX = [
  '#2a2a33','#3f7fc4','#5b97d3','#7aaede','#a6c6e4','#c6dcec','#dfe9f2','#fff8ea',
  '#7f8fa6','#6a6f7e','#4d4f5c','#8d9ab0','#a9bfd4','#9fc4dc','#d9558f','#a8406e',
  '#5cc6d6','#3d7f95','#e6a050','#c9b28a','#c27a3e','#6b4a3a','#9a9890','#b8b5ab',
  '#4a4b52','#5a5c66','#b9c6d8','#e2e8f2','#f4f2ec','#f0e6cc','#c8ccd4','#8a8e9a',
  '#f4f7fb','#c9d3e2','#f7b8cf','#d2502e','#e8a83a','#fff8e0','#dfe6ee','#eef1f5',
  '#bcc4d0','#f1c9a5','#d9a173','#a8714a','#6e4630','#1c1a20','#5a3826','#c9c6c0',
  '#c0393b','#3a5fa8','#4a7a52','#c8b48c','#263254','#e8c34a','#7dff8a','#ffffff',
  '#4f8a3c','#36652c','#f2a7c3','#d985a8','#c8402a','#4a3428','#d6dde8','#d9783a',
  '#8da4c0',
  '#e9c25c','#c79d52','#f4ecd2','#c7783a','#e8eef4','#e8a2ac','#8cb6d8','#92cea6','#eca05a',
  '#b8a4d8','#3f72c4','#e0b545','#eef0ee',
  '#ff4436'];

const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const NIGHT_RGB = NIGHT_HEX.map(rgb);
export const DAY_RGB = DAY_HEX.map(rgb);

function flags(list: number[]) {
  const a = new Uint8Array(NPAL);
  for (const i of list) a[i] = 1;
  return a;
}
/** Light sources: reflect in wet streets and keep their night color when lit. */
export const BRIGHT = flags([WWARM, WCOOL, MAG, CYAN, AMB, LIGHT, AMBD, WHITE, HALO, RAINB, FWG, BOLT, SUN, MOON, LEDW, SIGR]);
export const EMISSIVE = flags([WWARM, WCOOL, MAG, CYAN, AMB, LIGHT, HALO, FWG, BOLT, SUN, MOON, GLOWI, LEDW, SIGR]);
export const SKYIDX = flags([SKY1, SKY2, SKY3, SKY4, HAZE, GLOWO, GLOWI]);
export const FOGOK = flags([SKY1, SKY2, SKY3, SKY4, FARB, BFAR, BMID, BNEAR, WDIM, STONE, ASPH, WET, STEEL, CLOUD, CLOUDD, CHURCH, CHURCHD, FPINK, FBLUE, FGREEN, FORNG, FLILAC, TILEW]);
export const HALOOK = flags([SKY1, SKY2, SKY3, SKY4, HAZE, FARB, BFAR, BMID, BNEAR, WDIM, STONE, STONEL, ASPH, WET, STEEL, FOG, SNOW, SNOWS, CLOUD, CLOUDD,
  CHURCH, CHURCHD, FPINK, FBLUE, FGREEN, FORNG, FLILAC, TILEW, LEAFG, LEAFGD]);
/** Ground pixels that snow can cover. */
export const GROUND = flags([STONE, STONEL, ASPH, WET, HALO]);

/** What a wet road mirrors for each source index. */
export const REFL = new Uint8Array(NPAL).fill(WET);
for (const [a, b] of [[WWARM, AMBD], [WCOOL, CYAND], [MAG, MAGD], [MAGD, WOOD], [CYAN, CYAND], [CYAND, FOG], [AMB, AMBD],
  [LIGHT, WWARM], [AMBD, WOOD], [LEDW, RAIN], [CHURCH, AMBD], [CHURCHL, AMBD], [WHITE, RAIN], [HALO, WWARM], [RAINB, RAIN], [RAIN, FOG], [VOID, ASPH], [BNEAR, ASPH],
  [SKY3, FOG], [SKY4, FOG], [HAZE, FOG], [CLOUD, FOG], [SNOW, RAIN], [FWG, CGREEN], [BOLT, RAINB], [SUN, LIGHT], [MOON, RAIN], [SIGR, CRED]])
  REFL[a] = b;

export const PAL32 = new Uint32Array(NPAL);

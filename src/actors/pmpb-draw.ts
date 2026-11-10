/* PMPB livery pieces shared by the depth views (Praça da Matriz and the perspective streets); the
   side-on car is drawn in br-traffic.ts with the same colours. After the Regulamento de Gestão da
   Frota da PMPB (Arts. 11-12: light silver body, a reflective black-and-red band edged by white
   dashes, the prefix on the black, "POLÍCIA MILITAR" on the red) and a 2024 Fiat Cronos, viatura 8637
   (photo RBretz, fotosdeviaturas.net.br): near-white body (TILEW), black rear third, red front, dark
   windows, a red-and-blue roof bar that only blinks, softly, at night. No siren, no sound at all. */
import { CBLUE, CNAVY, CRED, CYAN, MAGD, SIGR, VOID } from '../engine/palette';
import { S } from '../sky/state';

/** Which half of the roof bar is lit at night (0 = red, 1 = blue); a slow, soft alternation. */
export const barPhase = () => (Math.floor(S.ms / 520) & 1) as 0 | 1;
/** Roof-bar colours [red, blue]: plain paint by day, one lamp lit at a time at night. */
export function barColors(night: boolean): [number, number] {
  if (!night) return [CRED, CBLUE];
  return barPhase() === 0 ? [SIGR, CNAVY] : [MAGD, CYAN];
}

/** A rect in a depth view's unit coords: u across (0 = centre), h1 > h0 heights above the road. */
export type UnitRect = (u0: number, u1: number, h1: number, h0: number, col: number) => void;

/** The livery over an already drawn white car seen from behind (going away) or the front: the band
    across the boot (black, red at the corners where the side band wraps) or red on the front wings,
    and the roof bar on top of the cabin (roof at height H). `belt` is where the lower body meets the
    windows; the band sits just under it, above the lights. */
export function pmpbDepth(R: UnitRect, hw: number, H: number, belt: number, front: boolean, night: boolean) {
  const t = belt - 0.2, b = belt - 1.4;
  if (front) { R(-hw, -hw + 1.6, t, b, CRED); R(hw - 1.6, hw, t, b, CRED); }
  else { R(-hw, hw, t, b, VOID); R(-hw, -hw + 1.4, t, b, CRED); R(hw - 1.4, hw, t, b, CRED); }
  const [rc, bc] = barColors(night);
  R(-3.2, 0, H + 1.6, H, rc); R(0, 3.2, H + 1.6, H, bc);
}

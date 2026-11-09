/* CINEMA · PARTAGE (Campina Grande, PB): the cinema inside Partage Shopping, reached from its front on
   the mall's upper floor (partage-interior.ts). The same room as the Remígio cinema (cinema-remigio.ts:
   the screen, the seats, the code-drawn generic action film, the room lit by the picture) and the same
   art-direction session schedule (cinema-rules.ts, 14:00-23:00), with its own seeded film order; the
   SAÍDA leads back into the mall. No reference photo of this cinema was used. */
import { cinemaRoom } from './cinema-remigio';
import type { Scene } from './types';

export const cinemaPartage: Scene = {
  id: 'cinema-partage',
  name: 'Cinema · Partage',
  ...cinemaRoom({ exitTo: 'partage-interior', hint: 'Toque na SAÍDA pra voltar ao shopping', salt: 0x9a47 }),
};

/* Esperança's church bells: the matriz of Nossa Senhora do Bom Conselho strikes the hours,
   05:00 through 00:00 (12-hour count; silent 01:00–04:00), on the city's real clock.

   Placement: the bells ring in EVERY Esperança scene, not only Praça da Matriz. Esperança is a
   small town and the matriz bell carries across it, so on the other scenes it sounds farther
   away (quieter and duller); in Praça da Matriz it rings near and bright.

   Pinned time (#at=): no automatic ringing at all. A pinned moment is for previews and
   screenshots, and its clock is not the real one. Tapping the church still rings one strike.

   One timer at most, armed only while it could ring (ambient sound on, city Esperança, real
   clock). sync() clears before re-arming, so it can be called freely; missed hours (tab in the
   background, machine asleep, reload, sound switched on late) are never replayed: a timer that
   fires late stays silent and just arms the next hour. Rules live in bells-schedule.ts, the timer
   in bells-scheduler.ts; this file only wires them to the real clock and Web Audio. */
import { audio } from './audio';
import { createBellScheduler } from './bells-scheduler.ts';

const s = createBellScheduler({
  now: () => Date.now(),
  setTimer: (fn, ms) => window.setTimeout(fn, ms),
  clearTimer: (id) => clearTimeout(id),
  soundOn: () => audio.isOn(),
  audioReady: () => audio.ready(),
  ring: (n, near) => audio.ringHour(n, near),
  cancelPeal: () => audio.cancelPeal(),
});

export const bells = {
  sync: s.sync,
  dispose: s.dispose,
  status: () => {
    const t = s.armedFor();
    return t ? `next ${new Date(t).toISOString().slice(11, 16)}Z` : 'off';
  },
};

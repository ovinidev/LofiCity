// Run with `pnpm test` (node --test; Node >= 22.18 strips the TypeScript types natively).
// The cinema's street front (src/scenes/cinema-facade-remigio.ts): its showtimes board, door and the
// crowd at the door all come from the room's schedule in src/scenes/cinema-rules.ts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLOSE_H, EXIT_MAX, FILM_ENDS, FILM_STARTS, OPEN_H, PRESHOW_MIN, QUEUE_MAX, SESSION_STARTS, boardAt, doorTap, exitsAt, hourLabel,
  queueAt, screenNotice, sessionAt,
} from '../src/scenes/cinema-rules.ts';

const MINUTES = Array.from({ length: 24 * 60 }, (_, m) => m);
const fmt = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;

test('session and film start times are derived from the schedule constants', () => {
  assert.deepEqual(SESSION_STARTS, [14, 16.5, 19, 21.5]);
  assert.deepEqual(FILM_STARTS, SESSION_STARTS.map((h) => h + PRESHOW_MIN / 60));
  assert.deepEqual(FILM_ENDS, [16.5, 19, 21.5, CLOSE_H]);
  assert.deepEqual(SESSION_STARTS.map(hourLabel), ['14H', '16H30', '19H', '21H30']);
  for (const [i, h] of FILM_STARTS.entries()) {
    assert.equal(sessionAt(h - 1 / 120).phase, 'preshow');
    assert.equal(sessionAt(h).phase, 'film');
    assert.equal(sessionAt(h).block, i);
  }
});

test('the street board and the screen inside agree at every minute of the day', () => {
  for (const m of MINUTES) {
    const h = m / 60, s = sessionAt(h), b = boardAt(h), notice = screenNotice(h), at = fmt(m);
    assert.equal(b.phase, s.phase, at);
    assert.equal(b.rows.length, SESSION_STARTS.length);
    const now = b.rows.filter((r) => r.state === 'now');
    if (s.phase === 'closed') {
      assert.equal(b.status, 'FECHADO', at);
      assert.equal(now.length, 0, at);
      // the room says "PRÓXIMA SESSÃO 14H"; the board highlights that same session as next
      assert.deepEqual(notice, ['SALA VAZIA', `PRÓXIMA SESSÃO ${b.rows.find((r) => r.state === 'next')!.label}`], at);
    } else {
      assert.equal(now.length, 1, at);
      assert.equal(now[0].start, SESSION_STARTS[s.block], at);
      assert.ok(b.rows.slice(0, s.block).every((r) => r.state === 'done'), at);
      if (s.phase === 'preshow') {
        assert.equal(b.status, 'VAI COMEÇAR', at);
        assert.deepEqual(notice, [`SESSÃO ${now[0].label}`], at); // the slide inside names the session the board lights
      } else {
        assert.equal(b.status, 'EM EXIBIÇÃO', at);
        assert.equal(notice, null, at); // the film is on screen
        const next = b.rows.find((r) => r.state === 'next');
        assert.equal(next?.start ?? null, s.next === OPEN_H ? null : s.next, at);
      }
    }
  }
});

test('the door lets people in only while the room is open; otherwise a short note', () => {
  for (const m of MINUTES) {
    const h = m / 60, d = doorTap(h);
    assert.equal(d.enter, sessionAt(h).phase !== 'closed', fmt(m));
    if (!d.enter) assert.equal(d.say, 'Fechado, volta às 14h');
  }
  assert.deepEqual(doorTap(13.99), { enter: false, say: 'Fechado, volta às 14h' });
  assert.deepEqual(doorTap(14), { enter: true });
  assert.deepEqual(doorTap(22.99), { enter: true });
  assert.equal(doorTap(23).enter, false);
});

test('the crowd at the door is bounded, follows the sessions and is never there while closed', () => {
  for (let s = 0; s < 24 * 3600; s += 15) {
    const h = s / 3600, q = queueAt(h), out = exitsAt(h), closed = sessionAt(h).phase === 'closed';
    assert.ok(q >= 0 && q <= QUEUE_MAX, `queue ${q} at ${h}`);
    assert.ok(out.length <= EXIT_MAX, `exits ${out.length} at ${h}`);
    assert.ok(out.every((x) => x >= 0));
    if (closed) { assert.equal(q, 0, `queue while closed at ${h}`); assert.equal(out.length, 0, `exits while closed at ${h}`); }
  }
  // a queue before each later session and through every pre-show, gone once the film starts
  for (const [i, st] of SESSION_STARTS.entries()) {
    if (i > 0) assert.ok(queueAt(st - 5 / 60) > 0, `queue before ${st}`);
    assert.equal(queueAt(st), QUEUE_MAX);
    const mid = queueAt(st + PRESHOW_MIN / 120);
    assert.ok(mid > 0 && mid < QUEUE_MAX, 'people go in during the pre-show');
    assert.equal(queueAt(FILM_STARTS[i]), 0, 'everyone is inside when the film starts');
  }
  assert.equal(queueAt(13.9), 0, 'no queue at the closed door before opening');
  assert.equal(queueAt(15), 0, 'no queue in the middle of a film');
  // people come out when a film ends; the last audience leaves before closing time
  for (const e of FILM_ENDS.slice(0, -1)) {
    assert.equal(exitsAt(e - 1 / 60).length, 0);
    assert.equal(exitsAt(e + 1 / 60).length, 2); // one every 35 s
    assert.equal(exitsAt(e + 3 / 60).length, EXIT_MAX);
  }
  assert.ok(exitsAt(CLOSE_H - 2 / 60).length > 0);
  assert.equal(exitsAt(CLOSE_H).length, 0);
});

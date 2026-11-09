/* "Sobre este lugar": the story of the current scene's real place, in a native modal <dialog>.
   The "i" button next to the eye exists only for scenes with an entry (Esperança, src/data/place-info.ts);
   elsewhere it is `hidden` (not rendered). Close button, Esc, backdrop click; Tab is kept inside the
   dialog and focus goes back to whatever opened it. All text is set with textContent (no HTML). */
import type { PlaceInfo } from '../data/place-info.ts';

export interface PlaceInfoUi { open(): void; close(): void; isOpen(): boolean; refresh(): void }

export function mountPlaceInfo(opts: { trigger: HTMLButtonElement; current: () => PlaceInfo | null }): PlaceInfoUi {
  const dlg = document.createElement('dialog');
  dlg.id = 'place-info'; dlg.className = 'place-info'; dlg.setAttribute('aria-labelledby', 'pi-title');
  dlg.innerHTML = `
    <div class="pi-box">
      <div class="pi-head"><h2 id="pi-title"></h2><button type="button" class="pi-close" aria-label="Fechar" title="Fechar (Esc)">×</button></div>
      <div class="pi-body"></div>
      <section class="pi-cur" aria-labelledby="pi-cur-t"><h3 id="pi-cur-t">Curiosidades</h3><ul></ul></section>
      <section class="pi-src" aria-labelledby="pi-src-t"><h3 id="pi-src-t">Fontes</h3><ul></ul></section>
    </div>`;
  document.body.append(dlg);
  const q = <T extends Element>(s: string) => dlg.querySelector(s) as T;
  const title = q<HTMLHeadingElement>('#pi-title'), body = q<HTMLDivElement>('.pi-body');
  const curSec = q<HTMLElement>('.pi-cur'), curList = q<HTMLUListElement>('.pi-cur ul'), srcList = q<HTMLUListElement>('.pi-src ul');
  const closeBtn = q<HTMLButtonElement>('.pi-close');
  let returnTo: HTMLElement | null = null;

  function render(p: PlaceInfo) {
    title.textContent = p.title;
    body.replaceChildren(...p.paragraphs.map((t) => Object.assign(document.createElement('p'), { textContent: t })));
    curSec.hidden = !p.curiosities.length;
    curList.replaceChildren(...p.curiosities.map((t) => Object.assign(document.createElement('li'), { textContent: t })));
    srcList.replaceChildren(...p.sources.map((s) => {
      const li = document.createElement('li'), a = document.createElement('a');
      a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = s.label;
      li.append(a);
      return li;
    }));
  }

  function close() {
    if (!dlg.open) return;
    dlg.close();
    const back = returnTo && returnTo.isConnected && !returnTo.hidden ? returnTo : null;
    returnTo = null;
    (back ?? (opts.trigger.hidden ? null : opts.trigger))?.focus();
  }

  function open() {
    const p = opts.current();
    if (!p || dlg.open) return;
    returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    render(p);
    dlg.showModal();
    q<HTMLDivElement>('.pi-box').scrollTop = 0; dlg.scrollTop = 0;
    closeBtn.focus();
  }

  /** The scene changed: show or hide the button; if the dialog is open, switch its story (or close it). */
  function refresh() {
    const p = opts.current();
    opts.trigger.hidden = !p;
    if (!dlg.open) return;
    if (p) render(p); else close();
  }

  closeBtn.addEventListener('click', close);
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); }); // Esc
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); }); // backdrop (the box fills the dialog)
  dlg.addEventListener('keydown', (e) => { // focus trap: Tab cycles between the close button and the links
    if (e.key !== 'Tab') return;
    const f = [...dlg.querySelectorAll<HTMLElement>('button, a[href]')].filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  opts.trigger.addEventListener('click', open);
  refresh();
  return { open, close, isOpen: () => dlg.open, refresh };
}

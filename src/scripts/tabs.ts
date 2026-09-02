/** Minimal accessible tabs: click or arrow keys switch the panel. */
export function mountTabs(root: HTMLElement | null): void {
  if (!root) return;
  const tabs = Array.from(root.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const panels = Array.from(root.querySelectorAll<HTMLElement>('[role="tabpanel"]'));
  if (!tabs.length) return;

  const select = (index: number, focus = false) => {
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      const panel = panels[i];
      if (!panel) return;
      if (on) {
        panel.hidden = false;
        // Restart the entrance animation.
        panel.style.animation = 'none';
        void panel.offsetWidth;
        panel.style.animation = '';
        panel.dispatchEvent(new CustomEvent('panel:show', { bubbles: true }));
      } else if (!panel.hidden) {
        panel.dispatchEvent(new CustomEvent('panel:hide', { bubbles: true }));
        panel.hidden = true;
      }
    });
    if (focus) tabs[index]?.focus();
  };

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(i));
    tab.addEventListener('keydown', (e) => {
      const n = tabs.length;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); select((i + 1) % n, true); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); select((i - 1 + n) % n, true); }
      if (e.key === 'Home') { e.preventDefault(); select(0, true); }
      if (e.key === 'End') { e.preventDefault(); select(n - 1, true); }
    });
  });
}

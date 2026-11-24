const MIN_KEYBOARD_HEIGHT = 60;
const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'tel', 'url', 'password', 'number']);

function editingField(root: HTMLElement): HTMLInputElement | HTMLTextAreaElement | null {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement && !TEXT_INPUT_TYPES.has(active.type)) return null;
  if (!(active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) return null;
  return root.contains(active) && !active.readOnly && !active.disabled ? active : null;
}

/** Keeps focused lobby and quest fields in the part of the screen above the software keyboard. */
export function keepMobileFieldsVisible(root: HTMLElement): void {
  if (!navigator.maxTouchPoints) return;

  const viewport = window.visualViewport;
  let restingWidth = root.clientWidth;
  let restingHeight = root.clientHeight;
  let panel: HTMLElement | null = null;
  let frame = 0;
  let releaseTimer = 0;

  const restoreLayout = (): void => {
    if (!panel) return;
    root.classList.remove('app--keyboard');
    root.style.removeProperty('--keyboard-viewport-height');
    root.style.removeProperty('--keyboard-viewport-top');
    panel.scrollTop = 0;
    panel = null;
  };

  const update = (): void => {
    frame = 0;
    const layoutHeight = root.clientHeight;
    const height = Math.floor(viewport?.height ?? window.innerHeight);
    if (height <= 0) return;
    if (root.clientWidth !== restingWidth) {
      restingWidth = root.clientWidth;
      restingHeight = layoutHeight;
    }

    const keyboardVisible = Math.max(layoutHeight, restingHeight) - height >= MIN_KEYBOARD_HEIGHT
      && (viewport?.scale ?? 1) <= 1.01;
    const field = editingField(root);
    if (!field || !keyboardVisible) {
      // Keep submit buttons in place between pointerdown and click while focus and keyboard close.
      if (!field && keyboardVisible && panel?.isConnected && !panel.closest('[hidden]')) return;
      restingHeight = field ? Math.max(restingHeight, layoutHeight) : layoutHeight;
      restoreLayout();
      return;
    }

    const nextPanel = field.closest<HTMLElement>('.lobby, .legend-modal');
    if (!nextPanel || nextPanel.closest('[hidden]')) {
      restoreLayout();
      return;
    }

    panel = nextPanel;
    root.style.setProperty('--keyboard-viewport-height', height + 'px');
    root.style.setProperty('--keyboard-viewport-top', Math.max(0, Math.round(viewport?.offsetTop ?? 0)) + 'px');
    root.classList.add('app--keyboard');

    const anchor = height < 150 ? field : field.closest('label') ?? field;
    panel.scrollTop += anchor.getBoundingClientRect().top - panel.getBoundingClientRect().top - 8;
  };

  const schedule = (): void => {
    if (!frame) frame = requestAnimationFrame(update);
  };

  root.addEventListener('focusin', schedule);
  root.addEventListener('focusout', () => {
    schedule();
    window.clearTimeout(releaseTimer);
    releaseTimer = window.setTimeout(() => {
      if (!editingField(root)) restoreLayout();
    }, 500);
  });
  window.addEventListener('resize', schedule);
  window.addEventListener('pageshow', schedule);
  document.addEventListener('fullscreenchange', schedule);
  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
}

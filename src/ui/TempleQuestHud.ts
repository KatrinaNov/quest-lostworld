import type { TempleQuestState } from '../game/quest/templeQuestTypes';
import { TEMPLE_MAP_LOCATION_HINT } from '../game/config/templeConfig';

/** Тонкий DOM-слой для прогресса и окон финала храма. Физика остаётся в Phaser-сцене. */
export class TempleQuestHud {
  private readonly progress: HTMLElement;
  private readonly backdrop: HTMLElement;
  private readonly dialog: HTMLElement;
  private onClose: (() => void) | null = null;

  constructor(parent: HTMLElement) {
    this.progress = document.createElement('section');
    this.progress.className = 'temple-progress';
    this.progress.hidden = true;
    parent.appendChild(this.progress);
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'legend-backdrop temple-backdrop';
    this.backdrop.hidden = true;
    this.dialog = document.createElement('section');
    this.dialog.className = 'legend-modal temple-modal';
    this.dialog.setAttribute('role', 'dialog');
    this.dialog.setAttribute('aria-modal', 'true');
    this.backdrop.appendChild(this.dialog);
    parent.appendChild(this.backdrop);
  }

  setProgress(state: TempleQuestState): void {
    this.progress.hidden = state.team.length === 0;
    this.progress.innerHTML = state.team.map((member) => {
      const found = state.stars[member.id]?.length ?? 0;
      const icons = Array.from({ length: 3 }, (_, index) => `<span class="temple-star-icon ${index < found ? 'temple-star-icon--on' : ''}">★</span>`).join('');
      return `<div class="temple-progress-row"><i style="background:#${member.color.toString(16).padStart(6, '0')}"></i><span>${escapeHtml(member.name)}</span><b>${icons}</b><em>${found}/3</em></div>`;
    }).join('');
  }

  showHint(onClose: () => void): void {
    this.open(
      'ИСПЫТАНИЕ ПРОЙДЕНО!',
      `<p>Для дальнейшего прохождения вам понадобится карта.</p><p>Её вы сможете найти <strong>${escapeHtml(TEMPLE_MAP_LOCATION_HINT)}</strong>.</p><p>Как только будете готовы, заходите в дверь.</p>`,
      'Понятно',
      onClose,
    );
  }

  showDoorConfirm(onLater: () => void, onReady: () => void): void {
    this.dialog.innerHTML = '<h2 class="legend-title">ВЫ ГОТОВЫ?</h2><div class="legend-body"><p>Карта при вас?</p></div><div class="temple-dialog-actions"><button type="button" class="legend-start temple-later">Ещё нет</button><button type="button" class="legend-start temple-ready">Да, готовы</button></div>';
    (this.dialog.querySelector('.temple-later') as HTMLButtonElement).addEventListener('click', () => { this.close(); onLater(); });
    (this.dialog.querySelector('.temple-ready') as HTMLButtonElement).addEventListener('click', () => { this.close(); onReady(); });
    this.show();
  }

  isOpen(): boolean { return !this.backdrop.hidden; }
  close(): void {
    this.backdrop.hidden = true;
    document.body.classList.remove('modal-open');
    const callback = this.onClose;
    this.onClose = null;
    callback?.();
  }
  hide(): void { this.progress.hidden = true; this.close(); }
  destroy(): void { this.hide(); this.progress.remove(); this.backdrop.remove(); }

  private open(title: string, body: string, button: string, onClose: () => void): void {
    this.dialog.innerHTML = '<h2 class="legend-title"></h2><div class="legend-body"></div><button type="button" class="legend-start"></button>';
    this.dialog.querySelector('.legend-title')!.textContent = title;
    this.dialog.querySelector('.legend-body')!.innerHTML = body;
    const action = this.dialog.querySelector('.legend-start') as HTMLButtonElement;
    action.textContent = button;
    action.addEventListener('click', () => this.close());
    this.onClose = onClose;
    this.show();
  }
  private show(): void { this.backdrop.hidden = false; document.body.classList.add('modal-open'); }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
}

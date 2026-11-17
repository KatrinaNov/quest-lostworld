/** Экран перехода во вторую локацию (синхронно для всей команды). */
export class LocationOverlay {
  private readonly el: HTMLElement;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'location-overlay';
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="location-card">
        <h2>Новый мир</h2>
        <p class="location-lead">Портал открыт. Впереди вас ждёт новый мир.</p>
        <p class="location-note">Локация 2 появится в следующем обновлении. Команда готова к переходу.</p>
      </div>
    `;
    parent.appendChild(this.el);
  }

  show(): void {
    this.el.hidden = false;
  }

  hide(): void {
    this.el.hidden = true;
  }

  destroy(): void {
    this.el.remove();
  }
}
/** Параметры тестового просмотра локаций (только dev + ?demo=1). */
export type DevPreviewOptions = {
  locationId: 1 | 2 | 3;
};

/** Читает `?demo=1&loc=1|2|3|island|minecraft|temple`. */
export function parseDevPreview(): DevPreviewOptions | null {
  if (!import.meta.env.DEV) return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('demo') !== '1') return null;

  const raw = (params.get('loc') ?? params.get('location') ?? '1').toLowerCase();
  const locationId: 1 | 2 | 3 = raw === '3' || raw === 'temple' ? 3 : raw === '2' || raw === 'minecraft' || raw === 'mc' ? 2 : 1;

  if (locationId === 3) {
    sessionStorage.setItem('temple-room', 'DEMO42');
  }

  return { locationId };
}

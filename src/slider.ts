(() => {
  document.querySelectorAll<HTMLElement>('[data-comparison]').forEach(comparison => {
  const range = document.getElementById(`${comparison.id}-range`) as HTMLInputElement | null;
  if (!range) return;
  function update(value: number): void {
    const position = Math.round(Math.max(0, Math.min(100, value)));
    comparison!.style.setProperty('--pos', `${position}%`);
    range!.value = String(position);
    range!.setAttribute('aria-valuetext', `${position} % avant, ${100 - position} % après`);
  }
  // The visible native range supplies keyboard, touch and assistive-technology support.
  range.addEventListener('input', () => update(Number(range.value)));
  let pointer: number | undefined;
  const fromPointer = (event: PointerEvent): void => {
    const rect = comparison.getBoundingClientRect();
    update(((event.clientX - rect.left) / rect.width) * 100);
  };
  comparison.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    pointer = event.pointerId;
    comparison.setPointerCapture(pointer);
    range.focus({ preventScroll: true });
    fromPointer(event);
  });
  comparison.addEventListener('pointermove', event => { if (event.pointerId === pointer) fromPointer(event); });
  const stop = (): void => { pointer = undefined; };
  comparison.addEventListener('pointerup', stop);
  comparison.addEventListener('pointercancel', stop);
  comparison.addEventListener('lostpointercapture', stop);
  comparison.querySelectorAll('img').forEach(img => { img.draggable = false; });
  update(50);
  });
})();

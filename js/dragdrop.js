// Glisser-déposer pour réordonner une liste verticale (les rubriques de l'accueil).
// Marche à la souris ET au doigt grâce à la Pointer Events API, qui unifie les deux.
//
// Principe : on ne bouge que l'élément qu'on tient (avec la souris/le doigt).
// Les autres se décalent d'un cran pour "faire de la place", comme sur un
// écran d'accueil de smartphone. Au relâchement, on calcule l'ordre final
// une seule fois et on prévient l'appelant via onReorder(idsDansLeNouvelOrdre).
//
// container doit contenir des éléments avec la classe .rub-item (et un
// attribut data-id), chacun ayant à l'intérieur une poignée .drag-handle.

export function enableReorder(container, onReorder) {
  let dragEl = null;
  let items = [];
  let startY = 0;
  let itemHeight = 0;
  let startIndex = 0;
  let currentIndex = 0;

  function onPointerDown(e) {
    const handle = e.target.closest('.drag-handle');
    if (!handle) return;
    const item = handle.closest('.rub-item');
    if (!item) return;

    e.preventDefault();
    dragEl = item;
    items = Array.from(container.querySelectorAll('.rub-item'));
    startIndex = items.indexOf(dragEl);
    currentIndex = startIndex;
    startY = e.clientY;
    itemHeight = measureItemHeight();

    dragEl.setPointerCapture(e.pointerId);
    dragEl.classList.add('dragging');

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
  }

  function measureItemHeight() {
    if (items.length > 1) {
      const a = items[0].getBoundingClientRect();
      const b = items[1].getBoundingClientRect();
      return Math.abs(b.top - a.top) || a.height;
    }
    return dragEl.getBoundingClientRect().height;
  }

  function onPointerMove(e) {
    if (!dragEl || !itemHeight) return;
    const dy = e.clientY - startY;
    dragEl.style.transform = `translateY(${dy}px)`;

    const shift = Math.round(dy / itemHeight);
    const newIndex = Math.min(items.length - 1, Math.max(0, startIndex + shift));
    if (newIndex === currentIndex) return;
    currentIndex = newIndex;

    items.forEach((item, i) => {
      if (item === dragEl) return;
      let offset = 0;
      if (startIndex < currentIndex && i > startIndex && i <= currentIndex) offset = -1;
      else if (startIndex > currentIndex && i < startIndex && i >= currentIndex) offset = 1;
      item.style.transform = offset ? `translateY(${offset * itemHeight}px)` : '';
    });
  }

  function onPointerUp() {
    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);
    if (!dragEl) return;

    dragEl.classList.remove('dragging');
    dragEl.style.transform = '';
    items.forEach(item => { item.style.transform = ''; });

    if (currentIndex !== startIndex) {
      const reordered = items.slice();
      const [moved] = reordered.splice(startIndex, 1);
      reordered.splice(currentIndex, 0, moved);
      onReorder(reordered.map(el => el.dataset.id));
    }
    dragEl = null;
    items = [];
  }

  container.addEventListener('pointerdown', onPointerDown);

  // Permet de nettoyer les écouteurs si jamais on retire ce conteneur du DOM.
  return function destroy() {
    container.removeEventListener('pointerdown', onPointerDown);
  };
}

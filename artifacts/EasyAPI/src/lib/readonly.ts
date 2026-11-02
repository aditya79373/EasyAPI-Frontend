let timer: ReturnType<typeof setTimeout> | undefined;

export function showReadOnly(msg = 'Viewers have read-only access') {
  let el = document.getElementById('sp-readonly-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'sp-readonly-toast';
    el.className = 'toast-message';
    el.style.zIndex = '2000';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (el) el.style.display = 'none';
  }, 2800);
}
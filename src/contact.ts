(() => {
  document.querySelectorAll<HTMLFormElement>('[data-contact-form]').forEach(form => {
    const status = form.querySelector<HTMLElement>('.form-status')!;
    form.addEventListener('submit', event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      // This private demo has no submission service: never simulate a successful delivery.
      status.textContent = 'Démonstration : le formulaire est valide, mais aucune demande n’a été envoyée. Appelez-nous pour nous joindre.';
    });
    form.addEventListener('input', () => { status.textContent = ''; });
    // Attach handlers before revealing the form, avoiding an accidental GET submission.
    form.hidden = false;
  });
})();

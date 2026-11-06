/* OperA — boot, global behaviours (tabs, dialog focus return, routing) */
(function () {
  'use strict';
  const OperA = window.OperA;

  /* Accessible tabs (WAI-ARIA tabs pattern, automatic activation). */
  function activateTab(tab) {
    const list = tab.closest('[role="tablist"]');
    list.querySelectorAll('[role="tab"]').forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = document.getElementById(t.getAttribute('aria-controls'));
      if (panel) panel.hidden = !on;
    });
  }
  OperA.ui.activateTab = activateTab;
  OperA.actions.tab = (btn) => activateTab(btn);
  document.addEventListener('keydown', (e) => {
    const tab = e.target.closest && e.target.closest('[role="tab"]');
    if (!tab) return;
    const tabs = Array.from(tab.closest('[role="tablist"]').querySelectorAll('[role="tab"]'));
    let i = tabs.indexOf(tab);
    if (e.key === 'ArrowRight') i = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') i = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = tabs.length - 1;
    else return;
    e.preventDefault();
    tabs[i].focus();
    tabs[i].click();
  });

  /* Return focus to whatever opened the dialog (or its re-rendered twin). */
  document.getElementById('modal').addEventListener('close', () => OperA.modal.restoreFocus());

  // Only "#/..." hashes are routes; in-page anchors (skip link, #check-logs) are not.
  window.addEventListener('hashchange', () => { if (location.hash.startsWith('#/')) OperA.render(); });
  document.querySelector('.skip-link').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('main').focus();
  });
  if (!location.hash) history.replaceState(null, '', '#/home');
  OperA.render();
})();

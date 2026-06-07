(function () {
  const sidebar = document.querySelector('aside');
  if (!sidebar) return;

  const shell = sidebar.parentElement;
  if (shell) shell.classList.add('hp-app-shell');
  sidebar.classList.add('hp-sidebar');

  const style = document.createElement('style');
  style.textContent = `
    .hp-app-shell {
      position: relative;
      width: 100%;
    }

    .hp-app-shell > main {
      min-width: 0;
      width: 100%;
      transition: padding 180ms ease;
    }

    .hp-app-shell > main > main,
    .hp-app-shell > main > div > main {
      padding-left: 0 !important;
      padding-right: 0 !important;
      padding-top: 0 !important;
      width: 100%;
    }

    .hp-sidebar {
      transition: transform 180ms ease, opacity 180ms ease;
      z-index: 50;
    }

    .hp-sidebar-toggle {
      position: fixed;
      top: 12px;
      left: 12px;
      z-index: 70;
      display: inline-flex;
      height: 40px;
      width: 40px;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      border: 1px solid rgba(148, 163, 184, 0.35);
      background: rgba(15, 23, 42, 0.92);
      color: #fff;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.18);
      transition: left 180ms ease, background 160ms ease, transform 160ms ease;
    }

    .hp-sidebar-toggle:hover {
      background: #1e293b;
      transform: translateY(-1px);
    }

    .hp-sidebar-overlay {
      position: fixed;
      inset: 0;
      z-index: 45;
      display: none;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(2px);
    }

    body.hp-sidebar-open .hp-sidebar-overlay {
      display: block;
    }

    @media (min-width: 768px) {
      body.hp-sidebar-collapsed .hp-sidebar {
        display: none !important;
      }

      body:not(.hp-sidebar-collapsed) .hp-sidebar-toggle {
        left: 272px;
      }
    }

    @media (max-width: 767px) {
      .hp-app-shell {
        display: block !important;
      }

      .hp-sidebar {
        position: fixed !important;
        top: 0;
        left: 0;
        height: 100vh !important;
        width: min(82vw, 280px) !important;
        max-width: 280px;
        transform: translateX(-100%);
        border-right: 1px solid rgba(30, 64, 175, 0.35);
        border-bottom: 0 !important;
        box-shadow: 18px 0 40px rgba(15, 23, 42, 0.25);
      }

      body.hp-sidebar-open .hp-sidebar {
        transform: translateX(0);
      }

      .hp-app-shell > main {
        padding-top: 64px !important;
      }
    }
  `;
  document.head.appendChild(style);

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hp-sidebar-toggle';
  button.setAttribute('aria-label', 'Toggle sidebar');
  button.setAttribute('aria-expanded', 'true');
  button.innerHTML = '<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';

  const overlay = document.createElement('div');
  overlay.className = 'hp-sidebar-overlay';

  document.body.appendChild(button);
  document.body.appendChild(overlay);

  const mq = window.matchMedia('(min-width: 768px)');

  function applyInitialState() {
    if (mq.matches) {
      const saved = localStorage.getItem('hp_sidebar_collapsed') === 'true';
      document.body.classList.toggle('hp-sidebar-collapsed', saved);
      document.body.classList.remove('hp-sidebar-open');
      button.setAttribute('aria-expanded', String(!saved));
    } else {
      document.body.classList.remove('hp-sidebar-collapsed');
      document.body.classList.remove('hp-sidebar-open');
      button.setAttribute('aria-expanded', 'false');
    }
  }

  function toggleSidebar() {
    if (mq.matches) {
      const collapsed = !document.body.classList.contains('hp-sidebar-collapsed');
      document.body.classList.toggle('hp-sidebar-collapsed', collapsed);
      localStorage.setItem('hp_sidebar_collapsed', String(collapsed));
      button.setAttribute('aria-expanded', String(!collapsed));
    } else {
      const open = !document.body.classList.contains('hp-sidebar-open');
      document.body.classList.toggle('hp-sidebar-open', open);
      button.setAttribute('aria-expanded', String(open));
    }
  }

  button.addEventListener('click', toggleSidebar);
  overlay.addEventListener('click', () => {
    document.body.classList.remove('hp-sidebar-open');
    button.setAttribute('aria-expanded', 'false');
  });

  sidebar.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      if (!mq.matches) {
        document.body.classList.remove('hp-sidebar-open');
        button.setAttribute('aria-expanded', 'false');
      }
    });
  });

  mq.addEventListener('change', applyInitialState);
  applyInitialState();
})();

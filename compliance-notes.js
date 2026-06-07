(function () {
  const PAGE_CONFIG = {
    'doh-olrs.html': { key: 'doh_olrs', label: 'DOH OLRS' },
    'ndhrhis.html': { key: 'ndhrhis', legacyKey: 'ndshrhis', label: 'NDHRHIS' },
    'emb.html': { key: 'emb', label: 'EMB' },
    'idtomis.html': { key: 'idtomis', label: 'IDTOMIS' }
  };

  const pageName = window.location.pathname.split('/').pop();
  const storedUser = sessionStorage.getItem('hp_user');
  let currentUser = { username: 'admin', role: 'admin' };
  try { if (storedUser) currentUser = JSON.parse(storedUser); } catch (e) {}

  function getNotesForConfig(item) {
    try {
      const notes = JSON.parse(localStorage.getItem('hp_compliance_notes_' + item.key) || '[]');
      if (!item.legacyKey) return notes;

      const legacyNotes = JSON.parse(localStorage.getItem('hp_compliance_notes_' + item.legacyKey) || '[]');
      const noteIds = new Set(notes.map(note => note.id));
      return notes.concat(legacyNotes.filter(note => !noteIds.has(note.id)));
    } catch (e) {
      return [];
    }
  }

  function getClientNotes(notes) {
    if (currentUser.role !== 'client') return [];
    return notes.filter(note =>
      note.clientKey === currentUser.username ||
      (currentUser.clinicName && note.clientName === currentUser.clinicName)
    );
  }

  function updateComplianceBadges() {
    if (currentUser.role !== 'client') return;

    Object.entries(PAGE_CONFIG).forEach(([href, item]) => {
      const notes = getClientNotes(getNotesForConfig(item));
      const lastViewedKey = 'hp_last_viewed_compliance_' + item.key + '_' + currentUser.username;
      const isCurrentPage = pageName === href;

      if (isCurrentPage && notes.length > 0) {
        const maxTimestamp = notes.reduce((max, note) => note.timestamp > max ? note.timestamp : max, 0);
        localStorage.setItem(lastViewedKey, String(maxTimestamp));
      }

      const lastViewed = parseInt(localStorage.getItem(lastViewedKey) || '0', 10);
      const unreadCount = notes.filter(note => note.timestamp > lastViewed).length;
      const link = document.querySelector(`a[href="${href}"]`);
      if (!link) return;

      if (unreadCount > 0 && !isCurrentPage) {
        link.classList.add('relative');
        let badge = link.querySelector('.compliance-notifications-badge');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'compliance-notifications-badge absolute top-1 right-2 shrink-0 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[8px] font-extrabold text-white border border-white';
          badge.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.15)';
          link.appendChild(badge);
        }
        badge.textContent = unreadCount;
      } else {
        const badge = link.querySelector('.compliance-notifications-badge');
        if (badge) badge.remove();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', updateComplianceBadges);

  const config = PAGE_CONFIG[pageName];
  if (!config) return;

  const STORAGE_KEY = 'hp_compliance_notes_' + config.key;
  const LEGACY_STORAGE_KEY = config.legacyKey ? 'hp_compliance_notes_' + config.legacyKey : '';
  const CLIENT_STORAGE_KEY = 'hp_clients';
  let selectedClientKey = '';
  let pendingNoteFile = null;
  let editingNoteId = null;

  if (LEGACY_STORAGE_KEY && !localStorage.getItem(STORAGE_KEY) && localStorage.getItem(LEGACY_STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, localStorage.getItem(LEGACY_STORAGE_KEY));
  }

  function escapeHtml(value) {
    if (!value) return '';
    return value.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function getClients() {
    try {
      const clients = JSON.parse(localStorage.getItem(CLIENT_STORAGE_KEY) || '[]');
      return clients
        .filter(client => client.loginEmail || client.clinicName)
        .map(client => ({
          key: client.loginEmail || client.clinicName,
          name: client.clinicName || client.loginEmail,
          email: client.loginEmail || '',
          contactPerson: client.contactPerson || ''
        }));
    } catch (e) {
      return [];
    }
  }

  function getAllNotes() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveNotes(notes) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    updateComplianceBadges();
  }

  function getVisibleNotes() {
    const notes = getAllNotes();
    if (currentUser.role === 'client') {
      return notes.filter(note =>
        note.clientKey === currentUser.username ||
        (currentUser.clinicName && note.clientName === currentUser.clinicName)
      );
    }
    return selectedClientKey ? notes.filter(note => note.clientKey === selectedClientKey) : [];
  }

  function getSelectedClient() {
    return getClients().find(client => client.key === selectedClientKey);
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' at ' +
      date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function buildFileHtml(file) {
    if (!file) return '';
    if (file.type && file.type.startsWith('image/')) {
      return `
        <div class="mt-4 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
          <img src="${file.data}" alt="${escapeHtml(file.name)}" class="w-full h-auto max-h-96 object-contain" />
        </div>
      `;
    }
    return `
      <div class="mt-4 flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200">
        <div class="h-10 w-10 shrink-0 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-bold text-slate-700 truncate" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</p>
          <p class="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">Attached Document</p>
        </div>
        <a href="${file.data}" download="${escapeHtml(file.name)}" class="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 text-[10px] font-bold rounded-lg transition shrink-0 shadow-sm">Download</a>
      </div>
    `;
  }

  function renderClientList() {
    const list = document.getElementById('complianceClientList');
    if (!list) return;

    const clients = getClients();
    if (clients.length === 0) {
      list.innerHTML = `
        <div class="rounded-xl border border-dashed border-slate-200 p-5 text-center">
          <p class="text-xs font-semibold text-slate-400">No clients found yet.</p>
          <p class="mt-1 text-[10px] text-slate-300">Add clients in Client Record first.</p>
        </div>
      `;
      return;
    }

    if (!selectedClientKey) selectedClientKey = clients[0].key;

    list.innerHTML = clients.map(client => {
      const isActive = client.key === selectedClientKey;
      return `
        <button type="button" data-client-key="${escapeHtml(client.key)}" class="client-note-toggle w-full rounded-xl border px-4 py-3 text-left transition ${isActive ? 'border-blue-200 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'}">
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate text-xs font-bold ${isActive ? 'text-blue-700' : 'text-slate-800'}">${escapeHtml(client.name)}</p>
              <p class="mt-0.5 truncate text-[10px] text-slate-400">${escapeHtml(client.email || client.contactPerson || 'Client')}</p>
            </div>
            <span class="rounded-full px-2 py-1 text-[9px] font-bold ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}">${getAllNotes().filter(note => note.clientKey === client.key).length}</span>
          </div>
        </button>
      `;
    }).join('');

    list.querySelectorAll('.client-note-toggle').forEach(button => {
      button.addEventListener('click', () => {
        selectedClientKey = button.getAttribute('data-client-key');
        cancelEditNote();
        renderComplianceNotes();
      });
    });
  }

  function renderNotesTimeline() {
    const timeline = document.getElementById('complianceNotesTimeline');
    if (!timeline) return;

    const notes = getVisibleNotes().sort((a, b) => b.timestamp - a.timestamp);
    const selectedClient = getSelectedClient();
    const emptyText = currentUser.role === 'client'
      ? 'No notes have been posted for your account yet.'
      : selectedClient
        ? 'No notes posted for this client yet.'
        : 'Choose a client to view and write notes.';

    if (notes.length === 0) {
      timeline.innerHTML = `
        <div class="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm text-center">
          <div class="flex flex-col items-center gap-3">
            <div class="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-300">
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>
            </div>
            <p class="text-sm font-semibold text-slate-400">${emptyText}</p>
          </div>
        </div>
      `;
      return;
    }

    timeline.innerHTML = notes.map(note => {
      const adminActions = currentUser.role === 'client' ? '' : `
        <div class="flex items-center gap-1.5">
          <button type="button" onclick="startEditComplianceNote(${note.id})" class="text-slate-300 hover:text-slate-700 transition bg-slate-50 hover:bg-slate-100 p-1.5 rounded-lg" title="Edit Note">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button type="button" onclick="deleteComplianceNote(${note.id})" class="text-slate-300 hover:text-red-500 transition bg-slate-50 hover:bg-red-50 p-1.5 rounded-lg" title="Delete Note">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4h8v2"/></svg>
          </button>
        </div>
      `;
      return `
        <article class="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm transition-all hover:shadow-md">
          <div class="flex justify-between items-start gap-3 mb-4">
            <div class="flex items-center gap-3 min-w-0">
              <div class="h-10 w-10 shrink-0 rounded-full bg-slate-900 flex items-center justify-center text-white text-sm font-bold uppercase ring-4 ring-slate-50">AD</div>
              <div class="min-w-0">
                <p class="text-sm font-bold text-slate-900">HOOKED ADMIN</p>
                <p class="text-[10px] font-medium text-slate-400 mt-0.5">${formatDate(note.timestamp)}</p>
                <p class="mt-1 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-600">${escapeHtml(note.clientName)}</p>
              </div>
            </div>
            ${adminActions}
          </div>
          <p class="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">${escapeHtml(note.content)}</p>
          ${buildFileHtml(note.file)}
        </article>
      `;
    }).join('');
  }

  function renderComplianceNotes() {
    renderClientList();

    const createCard = document.getElementById('complianceCreateNoteCard');
    const selectedName = document.getElementById('selectedComplianceClientName');
    const selectedClient = getSelectedClient();

    if (createCard) {
      createCard.classList.toggle('hidden', currentUser.role === 'client' || !selectedClient);
    }
    if (selectedName) {
      selectedName.textContent = selectedClient ? selectedClient.name : 'No client selected';
    }
    renderNotesTimeline();
  }

  function removeNoteFile() {
    pendingNoteFile = null;
    const input = document.getElementById('complianceNoteFileInput');
    const preview = document.getElementById('complianceNoteFilePreview');
    if (input) input.value = '';
    if (preview) preview.classList.add('hidden');
  }

  function cancelEditNote() {
    editingNoteId = null;
    const textarea = document.getElementById('complianceNoteContent');
    const button = document.getElementById('createComplianceNoteBtn');
    const cancelButton = document.getElementById('cancelComplianceNoteBtn');
    if (textarea) textarea.value = '';
    removeNoteFile();
    if (button) button.textContent = 'Post Note';
    if (cancelButton) cancelButton.classList.add('hidden');
  }

  function createNote() {
    const selectedClient = getSelectedClient();
    const textarea = document.getElementById('complianceNoteContent');
    if (!selectedClient || !textarea) return;

    const content = textarea.value.trim();
    if (!content && !pendingNoteFile) {
      alert('Please write a note or attach a file.');
      return;
    }

    const notes = getAllNotes();
    if (editingNoteId) {
      const noteIndex = notes.findIndex(note => note.id === editingNoteId);
      if (noteIndex !== -1) {
        notes[noteIndex].content = content;
        notes[noteIndex].file = pendingNoteFile;
        notes[noteIndex].timestamp = Date.now();
      }
    } else {
      notes.push({
        id: Date.now(),
        clientKey: selectedClient.key,
        clientName: selectedClient.name,
        content,
        file: pendingNoteFile,
        timestamp: Date.now()
      });
    }

    saveNotes(notes);
    cancelEditNote();
    renderComplianceNotes();
  }

  function startEditNote(id) {
    const note = getAllNotes().find(item => item.id === id);
    if (!note) return;

    selectedClientKey = note.clientKey;
    editingNoteId = id;
    renderComplianceNotes();

    const textarea = document.getElementById('complianceNoteContent');
    const button = document.getElementById('createComplianceNoteBtn');
    const cancelButton = document.getElementById('cancelComplianceNoteBtn');
    if (textarea) textarea.value = note.content || '';
    if (note.file) {
      pendingNoteFile = note.file;
      document.getElementById('complianceNoteFileName').textContent = note.file.name;
      document.getElementById('complianceNoteFilePreview').classList.remove('hidden');
    } else {
      removeNoteFile();
    }
    if (button) button.textContent = 'Update Note';
    if (cancelButton) cancelButton.classList.remove('hidden');
    document.getElementById('complianceCreateNoteCard').scrollIntoView({ behavior: 'smooth' });
    if (textarea) textarea.focus();
  }

  function deleteNote(id) {
    if (!confirm('Are you sure you want to delete this note?')) return;
    saveNotes(getAllNotes().filter(note => note.id !== id));
    renderComplianceNotes();
  }

  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit for local storage simulation.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      pendingNoteFile = {
        name: file.name,
        type: file.type,
        data: readerEvent.target.result
      };
      document.getElementById('complianceNoteFileName').textContent = file.name;
      document.getElementById('complianceNoteFilePreview').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }

  function injectNotesUi() {
    const container = document.querySelector('main .mx-auto');
    if (!container) return;

    const adminClientPanel = currentUser.role === 'client' ? '' : `
      <section class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100">
          <p class="text-sm font-bold text-slate-900">Client Notes</p>
          <p class="text-[10px] text-slate-400 mt-0.5">Choose a client. Notes posted here are visible only to that selected client.</p>
        </div>
        <div id="complianceClientList" class="p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"></div>
      </section>
    `;

    const createPostCard = currentUser.role === 'client' ? '' : `
      <section id="complianceCreateNoteCard" class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hidden">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected Client</p>
            <p id="selectedComplianceClientName" class="mt-1 text-sm font-bold text-slate-900">No client selected</p>
          </div>
          <span class="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-bold text-blue-600">${config.label}</span>
        </div>
        <div class="flex items-start gap-3 mb-4">
          <div class="h-10 w-10 shrink-0 rounded-full bg-slate-900 flex items-center justify-center text-white text-sm font-bold uppercase">AD</div>
          <div class="flex-1 min-w-0">
            <textarea id="complianceNoteContent" class="w-full resize-none border-0 bg-transparent p-0 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-0" rows="3" placeholder="Write a private note for this client..."></textarea>
          </div>
        </div>
        <div id="complianceNoteFilePreview" class="hidden mb-4 flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
          <div class="flex items-center gap-2 overflow-hidden">
            <svg class="w-4 h-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span id="complianceNoteFileName" class="text-xs font-semibold text-slate-700 truncate">filename.pdf</span>
          </div>
          <button type="button" id="removeComplianceNoteFileBtn" class="text-slate-400 hover:text-red-500 transition shrink-0 ml-3" title="Remove File">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="flex items-center justify-between border-t border-slate-100 pt-3">
          <label class="cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition">
            <svg class="w-4 h-4 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            Attach File
            <input type="file" id="complianceNoteFileInput" class="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip" />
          </label>
          <div class="flex items-center gap-2">
            <button type="button" id="cancelComplianceNoteBtn" class="hidden px-3 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 text-xs font-semibold rounded-lg transition">Cancel</button>
            <button type="button" id="createComplianceNoteBtn" class="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition shadow-sm">Post Note</button>
          </div>
        </div>
      </section>
    `;

    container.insertAdjacentHTML('beforeend', `
      ${adminClientPanel}
      ${createPostCard}
      <section>
        <div class="mb-3 flex items-center justify-between gap-3">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">${currentUser.role === 'client' ? 'Private Client Notes' : 'Notes Timeline'}</p>
            <h2 class="mt-1 text-lg font-bold text-slate-900">${config.label} Notes</h2>
          </div>
        </div>
        <div id="complianceNotesTimeline" class="space-y-6"></div>
      </section>
    `);

    const createButton = document.getElementById('createComplianceNoteBtn');
    const cancelButton = document.getElementById('cancelComplianceNoteBtn');
    const fileInput = document.getElementById('complianceNoteFileInput');
    const removeFileButton = document.getElementById('removeComplianceNoteFileBtn');

    if (createButton) createButton.addEventListener('click', createNote);
    if (cancelButton) cancelButton.addEventListener('click', cancelEditNote);
    if (fileInput) fileInput.addEventListener('change', handleFileUpload);
    if (removeFileButton) removeFileButton.addEventListener('click', removeNoteFile);

    window.startEditComplianceNote = startEditNote;
    window.deleteComplianceNote = deleteNote;
    renderComplianceNotes();
  }

  document.addEventListener('DOMContentLoaded', injectNotesUi);
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === CLIENT_STORAGE_KEY) renderComplianceNotes();
    if (event.key && (event.key.startsWith('hp_compliance_notes_') || event.key.startsWith('hp_last_viewed_compliance_'))) {
      updateComplianceBadges();
    }
  });
})();

// API Base URL
const API_URL = 'http://localhost:3000/api';

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const mainApp = document.getElementById('main-app');
const googleLoginBtn = document.getElementById('google-login');
const logoutBtn = document.getElementById('logout-btn');
const searchInput = document.getElementById('search-input');
const navItems = document.querySelectorAll('.nav-item');
const itemsContainer = document.getElementById('items-container');
const emptyState = document.getElementById('empty-state');
const loadingState = document.getElementById('loading-state');
const addNewBtn = document.getElementById('add-new-btn');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFileInput = document.getElementById('import-file');
const pageTitle = document.getElementById('page-title');

// Modal elements
const itemModal = document.getElementById('item-modal');
const viewModal = document.getElementById('view-modal');
const categoryBtns = document.querySelectorAll('.cat-btn');

// State
let currentUser = null;
let currentCategory = 'all';
let items = [];
let currentViewItem = null;

// Category icons
const categoryIcons = {
  password: '🔑',
  document: '📄',
  payslip: '💰',
  photo: '📷',
  personal: '📁'
};

const categoryTitles = {
  all: 'All Items',
  password: 'Passwords',
  document: 'Documents',
  payslip: 'Payslips',
  photo: 'Photos',
  personal: 'Personal',
  trash: 'Trash'
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  const token = await getStoredToken();
  if (token) {
    const user = await verifyToken(token);
    if (user) {
      currentUser = user;
      showMainApp();
      loadItems();
      loadStats();
    } else {
      showLoginScreen();
    }
  } else {
    showLoginScreen();
  }

  // Event listeners
  setupEventListeners();
}

function setupEventListeners() {
  // Navigation
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      currentCategory = item.dataset.category;
      pageTitle.textContent = categoryTitles[currentCategory] || 'All Items';
      loadItems();
    });
  });

  // Search
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchItems(e.target.value);
    }, 300);
  });

  // Category selector in modal
  categoryBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      categoryBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('item-category').value = btn.dataset.cat;
      toggleFieldsByCategory(btn.dataset.cat);
    });
  });

  // Modal backdrop close
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', () => {
      closeModal();
      closeViewModal();
    });
  });

  // File input
  const fileInput = document.getElementById('item-file');
  if (fileInput) {
    fileInput.addEventListener('change', handleFileSelect);
  }

  // Button event listeners (replacing inline onclick)
  document.getElementById('empty-add-btn')?.addEventListener('click', () => openAddModal());
  document.getElementById('modal-close-btn')?.addEventListener('click', closeModal);
  document.getElementById('toggle-password-btn')?.addEventListener('click', togglePassword);
  document.getElementById('remove-file-btn')?.addEventListener('click', removeFile);
  document.getElementById('cancel-btn')?.addEventListener('click', closeModal);
  document.getElementById('save-btn')?.addEventListener('click', saveItem);
  document.getElementById('edit-item-btn')?.addEventListener('click', editCurrentItem);
  document.getElementById('delete-item-btn')?.addEventListener('click', deleteCurrentItem);
  document.getElementById('view-modal-close-btn')?.addEventListener('click', closeViewModal);
}

// Auth functions
async function getStoredToken() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['stashit_token'], (result) => {
        resolve(result.stashit_token || null);
      });
    } else {
      resolve(localStorage.getItem('stashit_token'));
    }
  });
}

async function storeToken(token) {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ stashit_token: token }, resolve);
    } else {
      localStorage.setItem('stashit_token', token);
      resolve();
    }
  });
}

async function clearToken() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.remove(['stashit_token'], resolve);
    } else {
      localStorage.removeItem('stashit_token');
      resolve();
    }
  });
}

async function verifyToken(token) {
  try {
    const response = await fetch(`${API_URL}/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

// Google Login - Open web OAuth flow
googleLoginBtn.addEventListener('click', async () => {
  const authUrl = `${API_URL}/auth/google/login`;
  window.location.href = authUrl;
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await clearToken();
  currentUser = null;
  items = [];
  showLoginScreen();
});

// Screen management
function showLoginScreen() {
  loginScreen.classList.remove('hidden');
  mainApp.classList.add('hidden');
}

function showMainApp() {
  loginScreen.classList.add('hidden');
  mainApp.classList.remove('hidden');
  updateUserInfo();
}

function updateUserInfo() {
  if (currentUser) {
    document.getElementById('user-name').textContent = currentUser.name || currentUser.email;
    const avatar = document.getElementById('user-avatar');
    if (currentUser.avatar) {
      avatar.src = currentUser.avatar;
    } else {
      avatar.style.display = 'none';
    }
  }
}

// Load items
async function loadItems() {
  showLoading();

  try {
    const token = await getStoredToken();
    let url = `${API_URL}/vault`;

    if (currentCategory === 'trash') {
      url = `${API_URL}/vault/trash`;
    } else if (currentCategory !== 'all') {
      url += `?category=${currentCategory}`;
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      items = await response.json();
      renderItems();
    } else {
      showToast('Failed to load items', 'error');
    }
  } catch (error) {
    console.error('Load items error:', error);
    showToast('Failed to load items', 'error');
  }

  hideLoading();
}

// Search items
async function searchItems(query) {
  if (!query.trim()) {
    loadItems();
    return;
  }

  showLoading();

  try {
    const token = await getStoredToken();
    let url = `${API_URL}/vault/search?q=${encodeURIComponent(query)}`;

    if (currentCategory !== 'all' && currentCategory !== 'trash') {
      url += `&category=${currentCategory}`;
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      items = await response.json();
      renderItems();
    }
  } catch (error) {
    console.error('Search error:', error);
  }

  hideLoading();
}

// Load stats
async function loadStats() {
  try {
    const token = await getStoredToken();
    const response = await fetch(`${API_URL}/vault/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      const stats = await response.json();
      document.getElementById('count-all').textContent = stats.total;
      document.getElementById('count-password').textContent = stats.password || 0;
      document.getElementById('count-document').textContent = stats.document || 0;
      document.getElementById('count-payslip').textContent = stats.payslip || 0;
      document.getElementById('count-photo').textContent = stats.photo || 0;
      document.getElementById('count-personal').textContent = stats.personal || 0;
    }
  } catch (error) {
    console.error('Stats error:', error);
  }
}

// Render items
function renderItems() {
  if (items.length === 0) {
    itemsContainer.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  itemsContainer.classList.remove('hidden');

  itemsContainer.innerHTML = items.map(item => `
    <div class="item-card" data-item-id="${item._id}">
      <div class="item-card-header">
        <div class="item-card-icon ${item.category}">
          ${categoryIcons[item.category] || '📁'}
        </div>
        <div class="item-card-info">
          <div class="item-card-name">${escapeHtml(item.name)}</div>
          <div class="item-card-subtitle">${getSubtitle(item)}</div>
        </div>
        <div class="item-card-actions">
          ${item.category === 'password' ? `
            <button class="item-card-action copy-password-btn" data-item-id="${item._id}" title="Copy Password">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          ` : ''}
        </div>
      </div>
      ${item.tags && item.tags.length > 0 ? `
        <div class="item-card-tags">
          ${item.tags.slice(0, 3).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');

  // Add event listeners for item cards
  itemsContainer.querySelectorAll('.item-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.copy-password-btn')) {
        viewItem(card.dataset.itemId);
      }
    });
  });

  // Add event listeners for copy password buttons
  itemsContainer.querySelectorAll('.copy-password-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyPassword(btn.dataset.itemId);
    });
  });
}

function getSubtitle(item) {
  if (item.category === 'password' && item.website) {
    return escapeHtml(item.website.replace(/https?:\/\//, '').split('/')[0]);
  }
  if (item.fileName) {
    return escapeHtml(item.fileName);
  }
  return item.category.charAt(0).toUpperCase() + item.category.slice(1);
}

// View item
async function viewItem(id) {
  try {
    const token = await getStoredToken();
    const response = await fetch(`${API_URL}/vault/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      currentViewItem = await response.json();
      renderViewModal();
      viewModal.classList.remove('hidden');
    }
  } catch (error) {
    console.error('View item error:', error);
    showToast('Failed to load item', 'error');
  }
}

async function renderViewModal() {
  const item = currentViewItem;
  const token = await getStoredToken();
  document.getElementById('view-title').textContent = item.name;

  let content = '';

  if (item.category === 'password') {
    content += `
      <div class="view-field">
        <div class="view-label">Website</div>
        <div class="view-value">
          <span class="view-value-text">${escapeHtml(item.website || '-')}</span>
          ${item.website ? `<a href="${item.website}" target="_blank" class="copy-btn" title="Open"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg></a>` : ''}
        </div>
      </div>
      <div class="view-field">
        <div class="view-label">Username / Email</div>
        <div class="view-value">
          <span class="view-value-text">${escapeHtml(item.username || '-')}</span>
          <button class="copy-btn copy-username-btn" title="Copy"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        </div>
      </div>
      <div class="view-field">
        <div class="view-label">Password</div>
        <div class="view-value">
          <span class="view-value-text" id="view-password">••••••••••••</span>
          <button class="copy-btn toggle-view-password-btn" title="Show/Hide"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button class="copy-btn copy-password-view-btn" title="Copy"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        </div>
      </div>
    `;
  }

  if (item.fileName) {
    content += `
      <div class="view-field">
        <div class="view-label">File</div>
        <div class="view-value">
          <span class="view-value-text">${escapeHtml(item.fileName)}</span>
          <button class="copy-btn download-file-btn" data-item-id="${item._id}" title="Download"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>
        </div>
        ${item.fileType && item.fileType.startsWith('image/') ? `
          <div class="file-preview-container">
            <img src="${API_URL}/vault/${item._id}/file?token=${token}" alt="${item.fileName}">
          </div>
        ` : ''}
        ${item.fileType === 'application/pdf' ? `
          <div class="file-preview-container">
            <iframe src="${API_URL}/vault/${item._id}/file?token=${token}"></iframe>
          </div>
        ` : ''}
      </div>
    `;
  }

  if (item.notes) {
    content += `
      <div class="view-field">
        <div class="view-label">Notes</div>
        <div class="view-value">
          <span class="view-value-text">${escapeHtml(item.notes)}</span>
        </div>
      </div>
    `;
  }

  if (item.tags && item.tags.length > 0) {
    content += `
      <div class="view-field">
        <div class="view-label">Tags</div>
        <div class="item-card-tags">
          ${item.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  document.getElementById('view-content').innerHTML = content;

  // Add event listeners for view modal buttons
  const viewContent = document.getElementById('view-content');

  viewContent.querySelector('.copy-username-btn')?.addEventListener('click', () => {
    copyText(item.username);
  });

  viewContent.querySelector('.toggle-view-password-btn')?.addEventListener('click', toggleViewPassword);

  viewContent.querySelector('.copy-password-view-btn')?.addEventListener('click', () => {
    copyText(item.password);
  });

  viewContent.querySelector('.download-file-btn')?.addEventListener('click', (e) => {
    downloadFile(e.target.closest('.download-file-btn').dataset.itemId);
  });
}

let passwordVisible = false;
function toggleViewPassword() {
  const el = document.getElementById('view-password');
  passwordVisible = !passwordVisible;
  el.textContent = passwordVisible ? currentViewItem.password : '••••••••••••';
}

function closeViewModal() {
  viewModal.classList.add('hidden');
  currentViewItem = null;
  passwordVisible = false;
}

// Add/Edit Modal
addNewBtn.addEventListener('click', () => openAddModal());

function openAddModal(item = null) {
  document.getElementById('modal-title').textContent = item ? 'Edit Item' : 'Add New Item';
  document.getElementById('item-id').value = item ? item._id : '';
  document.getElementById('category-group').classList.toggle('hidden', !!item);

  // Reset form
  document.getElementById('item-form').reset();
  document.getElementById('file-preview').classList.add('hidden');
  document.getElementById('file-drop-zone').querySelector('.file-upload-content').classList.remove('hidden');

  if (item) {
    document.getElementById('item-category').value = item.category;
    document.getElementById('item-name').value = item.name;
    document.getElementById('item-website').value = item.website || '';
    document.getElementById('item-username').value = item.username || '';
    document.getElementById('item-password').value = item.password || '';
    document.getElementById('item-notes').value = item.notes || '';
    document.getElementById('item-tags').value = item.tags ? item.tags.join(', ') : '';
    toggleFieldsByCategory(item.category);
  } else {
    // Default to password
    categoryBtns.forEach(b => b.classList.remove('active'));
    document.querySelector('.cat-btn[data-cat="password"]').classList.add('active');
    document.getElementById('item-category').value = 'password';
    toggleFieldsByCategory('password');
  }

  itemModal.classList.remove('hidden');
}

function closeModal() {
  itemModal.classList.add('hidden');
}

function toggleFieldsByCategory(category) {
  const passwordFields = document.getElementById('password-fields');
  const fileFields = document.getElementById('file-fields');

  if (category === 'password') {
    passwordFields.classList.remove('hidden');
    fileFields.classList.add('hidden');
  } else {
    passwordFields.classList.add('hidden');
    fileFields.classList.remove('hidden');
  }
}

// File handling
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) {
    document.getElementById('preview-file-name').textContent = file.name;
    document.getElementById('file-preview').classList.remove('hidden');
    document.querySelector('.file-upload-content').classList.add('hidden');
  }
}

function removeFile() {
  document.getElementById('item-file').value = '';
  document.getElementById('file-preview').classList.add('hidden');
  document.querySelector('.file-upload-content').classList.remove('hidden');
}

// Save item
async function saveItem() {
  const id = document.getElementById('item-id').value;
  const category = document.getElementById('item-category').value;
  const name = document.getElementById('item-name').value;

  if (!name) {
    showToast('Name is required', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('category', category);
  formData.append('name', name);
  formData.append('website', document.getElementById('item-website').value);
  formData.append('username', document.getElementById('item-username').value);
  formData.append('password', document.getElementById('item-password').value);
  formData.append('notes', document.getElementById('item-notes').value);
  formData.append('tags', document.getElementById('item-tags').value);

  const fileInput = document.getElementById('item-file');
  if (fileInput.files[0]) {
    formData.append('file', fileInput.files[0]);
  }

  try {
    const token = await getStoredToken();
    const url = id ? `${API_URL}/vault/${id}` : `${API_URL}/vault`;
    const method = id ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });

    if (response.ok) {
      showToast(id ? 'Item updated' : 'Item added', 'success');
      closeModal();
      loadItems();
      loadStats();
    } else {
      const data = await response.json();
      showToast(data.error || 'Failed to save item', 'error');
    }
  } catch (error) {
    console.error('Save error:', error);
    showToast('Failed to save item', 'error');
  }
}

// Edit current item
function editCurrentItem() {
  if (currentViewItem) {
    closeViewModal();
    openAddModal(currentViewItem);
  }
}

// Delete current item
async function deleteCurrentItem() {
  if (!currentViewItem) return;

  if (!confirm('Move this item to trash?')) return;

  try {
    const token = await getStoredToken();
    const response = await fetch(`${API_URL}/vault/${currentViewItem._id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      showToast('Item moved to trash', 'success');
      closeViewModal();
      loadItems();
      loadStats();
    } else {
      showToast('Failed to delete item', 'error');
    }
  } catch (error) {
    console.error('Delete error:', error);
    showToast('Failed to delete item', 'error');
  }
}

// Copy functions
async function copyPassword(id) {
  const item = items.find(i => i._id === id);
  if (item && item.password) {
    await navigator.clipboard.writeText(item.password);
    showToast('Password copied!', 'success');
  }
}

async function copyText(text) {
  if (text) {
    await navigator.clipboard.writeText(text);
    showToast('Copied!', 'success');
  }
}

// Download file using fetch with Authorization header
async function downloadFile(id) {
  try {
    const token = await getStoredToken();
    const response = await fetch(`${API_URL}/vault/${id}/file`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      showToast('Failed to download file', 'error');
      return;
    }

    // Get filename from Content-Disposition header or use default
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = 'download';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="(.+)"/);
      if (match) filename = match[1];
    }

    // Create blob and download
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Download error:', error);
    showToast('Failed to download file', 'error');
  }
}

// Toggle password visibility
function togglePassword() {
  const input = document.getElementById('item-password');
  input.type = input.type === 'password' ? 'text' : 'password';
}

// Export
exportBtn.addEventListener('click', async () => {
  try {
    const token = await getStoredToken();
    const response = await fetch(`${API_URL}/vault/export`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `stashit-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup exported', 'success');
    }
  } catch (error) {
    console.error('Export error:', error);
    showToast('Failed to export', 'error');
  }
});

// Import
importBtn.addEventListener('click', () => {
  importFileInput.click();
});

importFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  // Reset input so same file can be selected again
  e.target.value = '';

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!data.items || !Array.isArray(data.items)) {
      showToast('Invalid backup file format', 'error');
      return;
    }

    if (!confirm(`Import ${data.items.length} items from backup? This will add to your existing vault.`)) {
      return;
    }

    const token = await getStoredToken();
    const response = await fetch(`${API_URL}/vault/import`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ items: data.items })
    });

    if (response.ok) {
      const result = await response.json();
      showToast(`Imported ${result.imported} items (${result.skipped} skipped)`, 'success');
      loadItems();
      loadStats();
    } else {
      const error = await response.json();
      showToast(error.error || 'Failed to import', 'error');
    }
  } catch (error) {
    console.error('Import error:', error);
    if (error instanceof SyntaxError) {
      showToast('Invalid JSON file', 'error');
    } else {
      showToast('Failed to import backup', 'error');
    }
  }
});

// Utility functions
function showLoading() {
  loadingState.classList.remove('hidden');
  itemsContainer.classList.add('hidden');
  emptyState.classList.add('hidden');
}

function hideLoading() {
  loadingState.classList.add('hidden');
}

function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// No longer need most global functions - using event listeners instead
// Keep viewItem for dynamically created elements
window.viewItem = viewItem;
window.copyPassword = copyPassword;

// API Base URL
const API_URL = 'https://stashit-production.up.railway.app/api';

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');
const googleLoginBtn = document.getElementById('google-login');
const logoutBtn = document.getElementById('logout');
const openVaultBtn = document.getElementById('open-vault');
const searchInput = document.getElementById('search-input');
const categoryBtns = document.querySelectorAll('.category-btn');
const itemsList = document.getElementById('items-list');
const addNewBtn = document.getElementById('add-new');

// State
let currentUser = null;
let currentCategory = 'password';
let items = [];

// Map frontend plural categories to backend singular categories
const categoryMap = {
  passwords: 'password',
  documents: 'document',
  payslips: 'payslip',
  photos: 'photo',
  personal: 'personal'
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Check if user is logged in
  const token = await getStoredToken();
  if (token) {
    const user = await verifyToken(token);
    if (user) {
      currentUser = user;
      showMainScreen();
      loadItems();
    } else {
      showLoginScreen();
    }
  } else {
    showLoginScreen();
  }
}

// Auth Functions
async function getStoredToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['stashit_token'], (result) => {
      resolve(result.stashit_token || null);
    });
  });
}

async function storeToken(token) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ stashit_token: token }, resolve);
  });
}

async function clearToken() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['stashit_token'], resolve);
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
  // Open backend OAuth URL in new tab
  const authUrl = `${API_URL}/auth/google/login`;
  chrome.tabs.create({ url: authUrl });
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await clearToken();
  currentUser = null;
  items = [];
  showLoginScreen();
});

// Open Full Vault (extension options page)
openVaultBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Screen Toggle
function showLoginScreen() {
  loginScreen.classList.remove('hidden');
  mainScreen.classList.add('hidden');
}

function showMainScreen() {
  loginScreen.classList.add('hidden');
  mainScreen.classList.remove('hidden');
}

// Category Selection
categoryBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    categoryBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    // Map plural category from HTML to singular for API
    currentCategory = categoryMap[btn.dataset.category] || btn.dataset.category;
    renderItems();
  });
});

// Search
searchInput.addEventListener('input', (e) => {
  renderItems(e.target.value);
});

// Load Items from API
async function loadItems() {
  try {
    const token = await getStoredToken();
    const response = await fetch(`${API_URL}/vault`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (response.ok) {
      items = await response.json();
      updateCounts();
      renderItems();
    }
  } catch (error) {
    console.error('Failed to load items:', error);
  }
}

// Update Category Counts
function updateCounts() {
  // Use singular category names (from backend) and map to plural (for HTML)
  const counts = {
    password: 0,
    document: 0,
    payslip: 0,
    photo: 0,
    personal: 0
  };

  items.forEach(item => {
    if (counts[item.category] !== undefined) {
      counts[item.category]++;
    }
  });

  // Map to plural for HTML element IDs
  const categoryToHtmlId = {
    password: 'passwords',
    document: 'documents',
    payslip: 'payslips',
    photo: 'photos',
    personal: 'personal'
  };

  Object.keys(counts).forEach(cat => {
    const htmlId = categoryToHtmlId[cat];
    const el = document.getElementById(`count-${htmlId}`);
    if (el) el.textContent = counts[cat];
  });
}

// Render Items
function renderItems(searchQuery = '') {
  const filtered = items.filter(item => {
    const matchesCategory = item.category === currentCategory;
    const matchesSearch = searchQuery
      ? item.name.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchesCategory && matchesSearch;
  });

  if (filtered.length === 0) {
    itemsList.innerHTML = `
      <div class="empty-state">
        <p>No ${currentCategory} yet</p>
        <button class="btn-secondary empty-add-btn">Add your first item</button>
      </div>
    `;
    itemsList.querySelector('.empty-add-btn')?.addEventListener('click', () => addNewBtn.click());
    return;
  }

  itemsList.innerHTML = filtered.map(item => `
    <div class="item-card" data-id="${item._id}">
      <div class="item-icon ${item.category}">
        ${getItemIcon(item.category)}
      </div>
      <div class="item-info">
        <div class="item-title">${item.name}</div>
        <div class="item-subtitle">${item.subtitle || ''}</div>
      </div>
      <button class="item-action copy-item-btn" data-id="${item._id}" title="Copy">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      </button>
    </div>
  `).join('');

  // Add click handlers for item cards
  document.querySelectorAll('.item-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.copy-item-btn')) {
        openItemDetail(card.dataset.id);
      }
    });
  });

  // Add click handlers for copy buttons
  document.querySelectorAll('.copy-item-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyItem(btn.dataset.id);
    });
  });
}

function getItemIcon(category) {
  const icons = {
    password: '🔑',
    document: '📄',
    payslip: '💰',
    photo: '📷',
    personal: '📁'
  };
  return icons[category] || '📁';
}

// Copy Item (for passwords)
async function copyItem(id) {
  const item = items.find(i => i._id === id);
  if (item && item.category === 'password' && item.password) {
    await navigator.clipboard.writeText(item.password);
    // Show brief feedback
    showToast('Password copied!');
  }
}

// Open Item Detail
function openItemDetail(id) {
  // Open the extension options page
  chrome.runtime.openOptionsPage();
}

// Add New
addNewBtn.addEventListener('click', () => {
  // Open the extension options page
  chrome.runtime.openOptionsPage();
});

// Toast notification
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%);
    background: #10b981;
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 12px;
    z-index: 1000;
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}

// No longer need global functions - using event listeners instead

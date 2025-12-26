# StashIt - Personal Vault Extension

## Project Overview
A Chrome extension for storing passwords, resumes, payslips, photos, and personal documents securely.

---

## Tech Stack
- **Extension**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Express.js + Node.js
- **Database**: MongoDB Atlas
- **Auth**: Google OAuth (20-day session)
- **File Storage**: MongoDB GridFS (for PDFs, images)

---

## Features

### Authentication
- [ ] Google OAuth sign-in
- [ ] 20-day JWT session
- [ ] Auto-logout after session expiry
- [ ] Token stored in chrome.storage.local

### Categories
- [ ] 🔑 Passwords (website, username, password, notes)
- [ ] 📄 Documents/Resumes (PDF upload, preview)
- [ ] 💰 Payslips (PDF upload, preview)
- [ ] 📷 Photos (image upload, preview)
- [ ] 📁 Personal Docs (any file type)

### Search
- [ ] **Global Search** - Search across ALL categories
- [ ] **Category Search** - Search within selected category
- [ ] Search by name, tags, website URL

### Vault Operations
- [ ] Add new item (password/document/photo)
- [ ] View item details
- [ ] Edit item
- [ ] Delete item (soft delete - 30 days trash)
- [ ] Copy password to clipboard
- [ ] Download files

### UI Components
- [ ] **Popup** (360x500px) - Quick access, search, recent items
- [ ] **Options Page** (Full page) - Complete vault management

### Backup & Recovery
- [ ] Export vault as encrypted JSON
- [ ] Import from backup
- [ ] Trash folder (30-day recovery)

---

## Project Structure

```
StashIt/
├── extension/
│   ├── manifest.json
│   ├── popup/
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── options/
│   │   ├── options.html
│   │   ├── options.css
│   │   └── options.js
│   ├── background/
│   │   └── service-worker.js
│   └── icons/
│       ├── icon16.png
│       ├── icon32.png
│       ├── icon48.png
│       └── icon128.png
│
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   └── auth.js
│   ├── models/
│   │   ├── User.js
│   │   └── VaultItem.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── vault.js
│   └── .env.example
│
└── task.md
```

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/google` | Exchange Google token for JWT |
| GET | `/api/auth/verify` | Verify JWT token |
| POST | `/api/auth/logout` | Logout (optional) |

### Vault
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/vault` | Get all items (with optional category filter) |
| GET | `/api/vault/:id` | Get single item |
| POST | `/api/vault` | Create new item |
| PUT | `/api/vault/:id` | Update item |
| DELETE | `/api/vault/:id` | Soft delete item |
| GET | `/api/vault/search?q=xxx` | Global search |
| GET | `/api/vault/trash` | Get deleted items |
| POST | `/api/vault/:id/restore` | Restore from trash |

### Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload file (PDF/image) |
| GET | `/api/files/:id` | Get file |
| DELETE | `/api/files/:id` | Delete file |

---

## MongoDB Schema

### User
```javascript
{
  _id: ObjectId,
  googleId: String,
  email: String,
  name: String,
  avatar: String,
  createdAt: Date,
  lastLoginAt: Date
}
```

### VaultItem
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  category: "password" | "document" | "payslip" | "photo" | "personal",
  name: String,

  // For passwords
  website: String,
  username: String,
  password: String,  // Encrypted

  // For files
  fileId: ObjectId,  // GridFS reference
  fileName: String,
  fileType: String,
  fileSize: Number,

  // Common
  notes: String,
  tags: [String],
  favorite: Boolean,

  // Timestamps
  createdAt: Date,
  updatedAt: Date,

  // Soft delete
  deleted: Boolean,
  deletedAt: Date
}
```

---

## Tasks

### Phase 1: Backend Setup
- [x] Create project structure
- [ ] Setup Express server
- [ ] Connect MongoDB
- [ ] Create User model
- [ ] Create VaultItem model
- [ ] Implement Google OAuth
- [ ] Generate 20-day JWT

### Phase 2: API Development
- [ ] Auth routes (login, verify, logout)
- [ ] Vault CRUD routes
- [ ] Search route (global + category)
- [ ] File upload route (GridFS)
- [ ] Soft delete + trash routes

### Phase 3: Extension Popup
- [x] Manifest.json
- [x] Popup HTML/CSS
- [x] Popup JS (basic)
- [ ] Connect to backend API
- [ ] Google OAuth flow
- [ ] Display items by category
- [ ] Quick search
- [ ] Copy password

### Phase 4: Extension Options Page (Full UI)
- [ ] Options page HTML structure
- [ ] Sidebar navigation
- [ ] Category views (grid/list)
- [ ] Add/Edit item modal
- [ ] Item detail view
- [ ] File preview (PDF, images)
- [ ] Global search bar
- [ ] Category filter search
- [ ] Trash view
- [ ] Settings page
- [ ] Export/Import backup

### Phase 5: Polish
- [ ] Create icons (16, 32, 48, 128)
- [ ] Error handling
- [ ] Loading states
- [ ] Toast notifications
- [ ] Responsive design
- [ ] Dark mode (default)

---

## Environment Variables

```env
# Backend (.env)
PORT=3000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=20d
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

---

## Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Background | #0f0f0f | Main bg (dark) |
| Card | #1a1a1a | Cards, inputs |
| Border | #2d2d2d | Borders |
| Primary | #6366f1 | Buttons, accents |
| Success | #10b981 | Success states |
| Danger | #ef4444 | Delete, errors |
| Text | #ffffff | Primary text |
| Muted | #6b7280 | Secondary text |

---

## Notes
- Personal use only
- Simple server-side encryption for passwords
- MongoDB Atlas backup = recovery option
- Soft delete for 30 days protection

---

Made with ❤️ by Sayed Abdul Karim

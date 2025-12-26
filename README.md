# 🔐 StashIt

Your personal secure vault for passwords, documents & more.

## Features

- **🔑 Passwords** - Store website credentials securely (AES-256-GCM encrypted)
- **📄 Documents** - Upload and organize resumes, contracts
- **💰 Payslips** - Keep your salary slips safe
- **📷 Photos** - Store personal photos
- **📁 Personal** - Any other important files

## Tech Stack

- **Extension**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Express.js + Node.js
- **Database**: MongoDB Atlas
- **Auth**: Google OAuth (20-day session)
- **Security**: AES-256-GCM password encryption

## Features

- ✅ Google Sign-In
- ✅ 20-day session expiry
- ✅ **Password encryption** (AES-256-GCM)
- ✅ Global Search across all categories
- ✅ Category-specific search
- ✅ File upload (PDF, Images up to 10MB)
- ✅ Soft delete with 30-day trash
- ✅ Export backup as JSON
- ✅ **Import backup from JSON**
- ✅ Dark mode UI

## Setup

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

### Extension

1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `extension` folder
5. Copy the **Extension ID** (shown under the extension name)
6. Add the Extension ID to your `.env` file

## Environment Variables

```env
PORT=3000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_secret_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
EXTENSION_ID=your_chrome_extension_id
```

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | Secret key for JWT tokens |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `EXTENSION_ID` | Chrome Extension ID (for auth callback) |

## Project Structure

```
StashIt/
├── extension/
│   ├── manifest.json
│   ├── popup/           # Quick access popup
│   ├── options/         # Full vault page
│   ├── background/      # Service worker
│   └── icons/
│
├── backend/
│   ├── server.js
│   ├── config/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   └── utils/           # Crypto utilities
│
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/google/login` | Initiate Google OAuth |
| GET | `/api/auth/google/callback` | OAuth callback |
| GET | `/api/auth/verify` | Verify JWT token |
| GET | `/api/vault` | Get all items |
| GET | `/api/vault/:id` | Get single item |
| GET | `/api/vault/search?q=xxx` | Search items |
| GET | `/api/vault/stats` | Get category counts |
| GET | `/api/vault/trash` | Get trash items |
| POST | `/api/vault` | Create item |
| PUT | `/api/vault/:id` | Update item |
| DELETE | `/api/vault/:id` | Soft delete item |
| DELETE | `/api/vault/:id/permanent` | Permanent delete |
| POST | `/api/vault/:id/restore` | Restore from trash |
| POST | `/api/vault/export` | Export all items |
| POST | `/api/vault/import` | Import from backup |

## Security

- **Password Encryption**: All passwords are encrypted using AES-256-GCM before storing in database
- **JWT Authentication**: 20-day expiry tokens
- **Secure File Download**: Authorization header based file access

---

Made with ❤️ by **Sayed Abdul Karim**

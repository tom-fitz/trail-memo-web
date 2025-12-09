# TrailMemo Web

> Web interface for TrailMemo - A voice memo application for field workers with GPS-tagged audio recordings displayed on an interactive map.

## 🎯 Overview

TrailMemo Web is the browser-based frontend for viewing and managing voice memos recorded in the field. Users can:

- 🗺️ View all memos on an interactive topographic map
- 🎧 Play audio recordings
- 📍 See GPS locations and park information
- 👤 Register and authenticate via Firebase
- 🗑️ Delete their own memos

## 🏗️ Architecture

```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   React Web App  │ ───▶ │   Go API Server  │ ───▶ │   PostgreSQL     │
│  (This project)  │      │   (Railway.app)  │      │   (Railway.app)  │
└──────────────────┘      └──────────────────┘      └──────────────────┘
         │                         │                          
         │                         │                          
         ▼                         ▼                          
┌──────────────────┐      ┌──────────────────┐              
│  Firebase Auth   │      │ Firebase Storage │              
│ (Authentication) │      │  (Audio files)   │              
└──────────────────┘      └──────────────────┘              
```

## 🛠️ Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Mapping**: Leaflet with OpenTopoMap tiles (FREE, no API key)
- **Styling**: Tailwind CSS
- **Auth**: Firebase Authentication SDK
- **API**: Axios for REST calls to Go backend
- **State**: React Context + TanStack Query
- **Deployment**: Railway.app or Vercel

## 📋 Features

### MVP (Implemented)
- ✅ User registration and login
- ✅ Interactive map with topographic tiles
- ✅ Pins showing all memos from all users
- ✅ Memo detail cards with audio playback
- ✅ Delete own memos
- ✅ Responsive design (mobile & desktop)
- ✅ Color-coded pins by user

### Future Enhancements
- 🔮 Record memos from web browser
- 🔮 Search and filter memos
- 🔮 Offline support (PWA)
- 🔮 Edit memo text
- 🔮 Photo attachments

## 📚 Documentation

- **[Implementation Plan](./IMPLEMENTATION_PLAN.md)** - Quick start guide and overview
- **[Frontend Architecture](./documentation/Frontend_Architecture.md)** - Detailed technical architecture
- **[API Specification](./documentation/API_Specification.md)** - Backend API reference
- **[Backend Setup](./documentation/Quick_Start_Setup_Guide.md)** - Setting up the Go API
- **[Deployment Guide](./documentation/DEPLOYMENT.md)** - Deploying to production

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Firebase account (for authentication)
- Access to TrailMemo API (Go backend)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd trail-memo-web

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Edit .env.local with your values
# - VITE_API_BASE_URL (your Go API)
# - VITE_FIREBASE_* (from Firebase Console)

# Start development server
npm run dev
```

Visit `http://localhost:5173`

### Environment Variables

Create `.env.local`:

```env
# Backend API
VITE_API_BASE_URL=https://your-api.railway.app/api/v1

# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Map Configuration (optional)
VITE_DEFAULT_MAP_LAT=45.6789
VITE_DEFAULT_MAP_LNG=-111.0123
VITE_DEFAULT_MAP_ZOOM=12
```

## 🗺️ Map Implementation

We use **OpenTopoMap** for free, beautiful topographic maps:

- ✅ No API key required
- ✅ No usage limits
- ✅ No credit card needed
- ✅ Beautiful topographic styling
- ✅ Open source

Alternative tile options are documented in `Frontend_Architecture.md`.

## 📱 Screenshots

*(Screenshots will be added after implementation)*

## 🧪 Development

```bash
# Install dependencies
npm install

# Start dev server (with hot reload)
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🚢 Deployment

### Option 1: Vercel (Recommended for Frontend)

```bash
npm install -g vercel
vercel
```

### Option 2: Railway.app

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway up
```

### Option 3: Netlify

```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

See [DEPLOYMENT.md](./documentation/DEPLOYMENT.md) for detailed instructions.

## 📂 Project Structure

```
trail-memo-web/
├── documentation/          # Architecture and guides
│   ├── Frontend_Architecture.md
│   ├── API_Specification.md
│   ├── Quick_Start_Setup_Guide.md
│   └── DEPLOYMENT.md
├── src/
│   ├── components/        # React components
│   │   ├── auth/         # Login, Register
│   │   ├── map/          # Map, Markers
│   │   ├── memos/        # Memo cards, Audio player
│   │   └── ui/           # Reusable UI components
│   ├── contexts/         # React contexts (Auth, etc.)
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities and configs
│   │   ├── api/          # API client
│   │   └── firebase/     # Firebase setup
│   ├── pages/            # Page components
│   ├── types/            # TypeScript types
│   └── App.tsx           # Root component
├── .env.example          # Environment template
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## 🔐 Security

- All API calls require Firebase authentication tokens
- Backend validates tokens on every request
- HTTPS enforced in production
- Environment variables never committed to git
- XSS protection via React's built-in escaping

## 💰 Cost

**Development**: $0  
**Production (small team)**: $0-5/month
- Vite/React: Free
- Leaflet: Free
- OpenTopoMap: Free
- Firebase Auth: Free (< 50K users)
- Vercel hosting: Free (100GB bandwidth)
- Backend API: See backend documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

[Your License Here]

## 🆘 Support

For issues and questions:
- Check the [documentation](./documentation/)
- Open an issue on GitHub
- Review the [Implementation Plan](./IMPLEMENTATION_PLAN.md)

## 🎯 Roadmap

### Phase 1: MVP ✅
- User authentication
- Map view with memos
- Audio playback
- Basic CRUD operations

### Phase 2: Enhanced Features
- Search and filters
- List view
- User profiles
- Offline support (PWA)

### Phase 3: Advanced Features
- Web recording (Web Speech API)
- Photo attachments
- Comments and collaboration
- Export functionality
- Analytics dashboard

---

Built with ❤️ for field workers everywhere
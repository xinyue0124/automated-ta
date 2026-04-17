# 🚀 Automated TA Setup Guide

Here are the complete steps to clone, set up, and run the Automated TA AI Teaching Assistant:

## 📋 Prerequisites
- **Node.js 18+** and npm
- **Docker** and Docker Compose
- **Git**

## 🛠️ Setup Steps

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/automated_TA.git
cd automated_TA
```

### 2. Install Dependencies
```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
cd ..
```

### 3. Set Up Environment Variables
```bash
# Create .env file
cat > .env << 'EOF'
# Backend Configuration
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/automated_ta
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-please
CORS_ORIGIN=http://localhost:5173

# OpenAI API Key (optional - system works with mock responses without it)
OPENAI_API_KEY=

# Frontend Configuration
VITE_API_URL=http://localhost:3001
EOF

# Copy .env to backend directory
cp .env backend/.env
```

### 4. Stop Any Conflicting Services
```bash
# Stop local PostgreSQL if running (common conflict)
brew services stop postgresql@14
# or for other versions:
# brew services stop postgresql@15
# brew services stop postgresql
```

### 5. Start Database with Docker
```bash
# Start PostgreSQL with pgvector
docker-compose up postgres -d

# Wait for database to be ready
sleep 10
```

### 6. Start Backend Server
```bash
# Start backend in background
cd backend
npm run dev &
cd ..
```

### 7. Start Frontend Server
```bash
# Start frontend in background
cd frontend
npm run dev &
cd ..
```

### 8. Verify Everything is Running
```bash
# Check backend
curl http://localhost:3001/api/health

# Check frontend (should return HTML)
curl http://localhost:5173
```

### 9. Open the Application
Open your browser and go to: **http://localhost:5173**

## 🎯 Quick Test
1. Click "Sign Up" in the top right
2. Create an account
3. Upload a text file with some content
4. Start a new chat and ask questions!

## 🛑 Stop the Application
```bash
# Stop all services
pkill -f "node.*server.js"
pkill -f "vite"
docker-compose down
```

## 🔧 Troubleshooting

### If you get "port already in use" errors:
```bash
# Kill processes on ports 3001 and 5173
lsof -ti:3001 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### If database connection fails:
```bash
# Check if local PostgreSQL is running
brew services list | grep postgres
# Stop it if running
brew services stop postgresql@14
```

### If frontend won't start:
```bash
# Clean and reinstall frontend dependencies
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## 📚 Documentation
- `README.md` - Complete technical documentation
- `QUICKSTART.md` - 5-minute setup guide
- `FEATURES.md` - Feature implementation details


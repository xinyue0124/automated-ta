# Automated TA - AI Teaching Assistant

An intelligent teaching assistant that provides personalized help based on students' uploaded class notes. Built with React, Node.js, PostgreSQL (with pgvector), and OpenAI.

## Features

✨ **Authentication System**
- Sign up / Sign in functionality
- JWT-based authentication
- Secure password hashing with bcrypt

📚 **Document Management**
- Upload class notes (PDF, DOCX, PPTX, TXT, MD formats)
- Automatic text extraction and processing
- Vector embeddings for semantic search
- Document storage with PostgreSQL + pgvector

💬 **Intelligent Chat**
- AI-powered responses based on uploaded notes
- Context-aware conversations
- Multiple chat sessions
- Real-time message history

🎨 **Beautiful UI**
- Modern, responsive design with Tailwind CSS
- Smooth animations and transitions
- Intuitive user experience
- Dashboard for managing documents and chats

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **Zustand** for state management
- **React Router** for navigation
- **Axios** for API calls
- **React Dropzone** for file uploads

### Backend
- **Node.js** with Express
- **PostgreSQL** with pgvector extension
- **OpenAI API** for embeddings and chat
- **JWT** for authentication
- **Multer** for file uploads
- **bcrypt** for password hashing

### DevOps
- **Docker** and Docker Compose
- Containerized PostgreSQL with pgvector
- Hot-reload development environment
- GitHub Actions CI: tests against Postgres, then a Docker build

## Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose
- OpenAI API key (optional - works with mock responses without it)

## Quick Start

### 1. Clone and Install

```bash
# Clone the repository
cd automated_TA

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

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your configuration:

```env
# Backend Configuration
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/automated_ta
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
CORS_ORIGIN=http://localhost:5173

# OpenAI API Key (optional - system works with mock responses without it)
OPENAI_API_KEY=your-openai-api-key-here

# Frontend Configuration
VITE_API_URL=http://localhost:3001
```

### 3. Start with Docker (Recommended)

```bash
# Start PostgreSQL and backend services
npm run docker:up

# In a new terminal, start the frontend
cd frontend
npm run dev
```

### 4. Start Manually (Alternative)

If you prefer to run services manually:

```bash
# Terminal 1: Start PostgreSQL
docker-compose up postgres

# Terminal 2: Start backend
cd backend
npm run dev

# Terminal 3: Start frontend
cd frontend
npm run dev
```

### 5. Access the Application

Open your browser and navigate to:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

## Usage Guide

### First-Time Setup

1. **Create an Account**
   - Click "Sign Up" in the top right
   - Enter your email, password, and full name
   - You'll be automatically signed in

2. **Upload Your Notes**
   - From the dashboard, click "Upload Notes"
   - Drag & drop or select your class notes (PDF, DOCX, PPTX, TXT, MD)
   - Wait for processing to complete (you'll see a "Processed" status)

3. **Start Chatting**
   - Click "New Chat" to create a chat session
   - Ask questions about your uploaded notes
   - The AI will provide answers based on your materials

### Features Overview

#### Dashboard
- View statistics (documents, chat sessions, messages)
- Manage uploaded documents
- Create and access chat sessions

#### File Upload
- Drag & drop interface
- Support for multiple file formats
- Automatic text extraction and vectorization
- Real-time processing status

#### Chat Interface
- Context-aware AI responses
- Upload files directly from chat
- Message history persistence
- Beautiful, responsive design

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/signin` - Sign in
- `GET /api/auth/verify` - Verify token

### Files
- `POST /api/files/upload` - Upload document
- `GET /api/files` - Get user's documents
- `DELETE /api/files/:id` - Delete document

### Chat
- `POST /api/chat/sessions` - Create chat session
- `GET /api/chat/sessions` - Get user's sessions
- `GET /api/chat/sessions/:id/messages` - Get messages
- `POST /api/chat/sessions/:id/messages` - Send message
- `DELETE /api/chat/sessions/:id` - Delete session

### User
- `GET /api/user/profile` - Get user profile
- `GET /api/user/stats` - Get user statistics

## Database Schema

### Tables
- **users** - User accounts
- **documents** - Uploaded files metadata
- **document_chunks** - Text chunks with embeddings
- **chat_sessions** - Chat conversations
- **chat_messages** - Individual messages

### Vector Search
Uses pgvector extension for semantic similarity search on document chunks.

## Development

### Project Structure

```
automated_TA/
├── backend/
│   ├── src/
│   │   ├── config/         # Database config
│   │   ├── middleware/     # Auth middleware
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   └── server.js       # Entry point
│   ├── db/
│   │   └── init.sql        # Database schema
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   ├── store/          # State management
│   │   ├── lib/            # Utilities
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── tailwind.config.js
│   └── package.json
├── docker-compose.yml
└── README.md
```

### Running Tests

The backend tests run against a real Postgres with pgvector. They cover rejected tokens, per-user data isolation, input validation, and sign-in rate limiting.

```bash
docker-compose up -d postgres
cd backend
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/automated_ta npm test
```

GitHub Actions runs the same tests against a pgvector service container on every push, then builds the backend Docker image.

### Eval

`npm run eval` (in `backend/`, same `DATABASE_URL`) scores the assistant on 30 course questions and 10 off-topic questions over sample course materials. Retrieval (hit@1/3/5, MRR, off-topic similarity) runs with no API key; with `OPENAI_API_KEY` set it also has a judge model grade each answer for groundedness, correctness and refusals. CI runs it on every push. Method: [backend/eval/README.md](backend/eval/README.md).

Baseline (Nov 2026, chunks of 1000/200 characters, top 3 sent to the model; answers from DeepSeek `deepseek-chat`, judged by the same model, range over 3 runs):

| Metric | Result |
|---|---|
| Retrieval hit@3 / hit@1 / MRR | 87% / 73% / 0.826 |
| Off-topic questions below similarity threshold 0.22 | 100% (and 3% of course questions) |
| Answer groundedness (0–2 rubric, as %) / fully grounded | 83–85% / 70–73% |
| Course answers correct | 87–90% |
| Off-topic refusal rate (says the notes don't cover it) | 60–80%; with no outside knowledge at all, 30–60% |

Without `OPENAI_API_KEY`, embeddings come from a local model (all-MiniLM-L6-v2), downloaded into `backend/models/` on first use. A database must use one embedding provider throughout.

### Building for Production

```bash
# Frontend build
cd frontend
npm run build

# Backend (uses Node.js directly)
cd backend
npm start
```

## Docker Commands

```bash
# Start all services
npm run docker:up

# Stop all services
npm run docker:down

# View logs
npm run docker:logs

# Rebuild containers
docker-compose up --build
```

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker ps

# View PostgreSQL logs
docker logs automated_ta_db

# Reset database
docker-compose down -v
docker-compose up
```

### Port Already in Use
```bash
# Check what's using the port
lsof -i :3001  # Backend
lsof -i :5173  # Frontend
lsof -i :5432  # PostgreSQL

# Kill the process or change ports in .env
```

### File Upload Issues
- Ensure uploads directory exists and has write permissions
- Check file size limits (default 10MB)
- Verify supported file formats (PDF, DOCX, PPTX, TXT, MD)

### OpenAI API Issues
- System works without OpenAI API key (uses mock responses)
- Check API key validity and billing status
- Monitor rate limits

## Security Considerations

⚠️ **Important for Production:**

1. **Change JWT Secret**: Update `JWT_SECRET` in `.env`
2. **Use HTTPS**: Enable SSL/TLS in production
3. **Environment Variables**: Never commit `.env` to version control
4. **Database Credentials**: Use strong passwords
5. **Rate Limiting**: Sign-in and sign-up are limited to 20 attempts per IP every 15 minutes
6. **Input Validation**: Implemented with express-validator
7. **CORS**: Configure `CORS_ORIGIN` for your domain

## Future Enhancements

- [ ] Support for more file formats (images, audio)
- [ ] Real-time collaboration features
- [ ] Advanced analytics dashboard
- [ ] Mobile app (React Native)
- [ ] Integration with learning management systems
- [ ] Custom AI model fine-tuning
- [ ] Multi-language support
- [ ] Export chat history

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - feel free to use this project for learning or commercial purposes.

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Contact the development team

---

Built with ❤️ for students everywhere


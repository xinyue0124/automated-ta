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
Hybrid search over a user's chunks: pgvector cosine similarity plus Postgres full-text search, merged with reciprocal rank fusion.

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

`npm run eval` (in `backend/`, same `DATABASE_URL`) scores the assistant on 30 course questions and 10 off-topic questions over sample course materials. Retrieval (hit@1/3/5, MRR, off-topic similarity; hybrid or vector-only search) runs with no API key; with `OPENAI_API_KEY` set it also has a judge model grade each answer for groundedness, correctness and refusals. CI runs it on every push. Method: [backend/eval/README.md](backend/eval/README.md).

Results (Nov 2026, chunks of 1000/200 characters, top 3 sent to the model; answers from DeepSeek `deepseek-chat`, judged by the same model, range over 3 runs; before/after detail in the eval README):

| Metric | Result |
|---|---|
| Retrieval hit@3 / hit@1 / MRR (hybrid search) | 97% / 70% / 0.828 (vector only: 87% / 73% / 0.826) |
| Off-topic questions below similarity threshold 0.22 | 100% (and 3% of course questions) |
| Answer groundedness (0–2 rubric, as %) | 98–100% (83–85% before the notes-only prompt) |
| Off-topic refusal rate | 100% (60–80% before the notes-only prompt) |
| Course questions answered and correct | 26–28 of 30 (25 with vector-only search, 26–27 with the first prompt) |

Without `OPENAI_API_KEY`, embeddings come from a local model (all-MiniLM-L6-v2), downloaded into `backend/models/` on first use. A database must use one embedding provider throughout.

### Load test and per-answer stats

Every chat answer records time per stage (query embedding, search, history, model call), prompt and output tokens, and the model the API reports. They go to the log as one JSON line (`{"event":"chat",...}`; `LOG_CHAT_STATS=0` turns it off).

`npm run loadtest` (in `backend/`, same `DATABASE_URL`) starts the app, ingests the eval course notes for one student, and sends chat messages through the HTTP API with 1, 5, 10 and 20 in flight (`--concurrency 1,10,50 --requests 200` to change). Each message goes to a new session, so every prompt has the same shape. Without `OPENAI_API_KEY` the app gives its demo reply, which measures everything except the model; CI runs that version on every push.

With the model (Nov 2026, DeepSeek: `AI_MODEL=deepseek-chat`, which the API reports as `deepseek-flash`; this Mac, PGlite database):

| Concurrent | Requests | Errors | req/s | p50 | p95 | Search (embed + query) | Model call | Prompt / output tokens | Cost per answer |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 20 | 0 | 0.8 | 1.17 s | 1.76 s | 5 ms | 1.23 s | 736 / 45 | $0.00012 |
| 10 | 20 | 0 | 6.5 | 1.37 s | 1.57 s | 8 ms | 1.30 s | 736 / 52 | $0.00013 |
| 50 | 50 | 0 | 24.5 | 1.37 s | 1.67 s | 24 ms | 1.25 s | 736 / 56 | $0.00013 |

Cost uses DeepSeek's published peak rates for deepseek-flash ($0.30 per 1M input tokens on a cache miss, $1.20 per 1M output); off-peak is half. At 50 concurrent, 50 requests is one wave, so req/s is a lower bound.

Without the model (demo reply), app and database only:

| Concurrent | Where | req/s | p50 | p95 | Search (embed + query) |
|---|---|---|---|---|---|
| 1 | GitHub Actions runner, Postgres 16 | 42 | 9 ms | 104 ms | 4 ms |
| 10 | GitHub Actions runner, Postgres 16 | 143 | 65 ms | 99 ms | 19 ms |
| 50 | GitHub Actions runner, Postgres 16 | 136 | 354 ms | 759 ms | 63 ms |
| 50 | This Mac, PGlite | 485 | 98 ms | 117 ms | 31 ms |

Findings:

1. **The model is almost all of the latency and all of the cost.** Retrieval takes 5–25 ms of a 1.2–1.4 s answer, so speeding up search would not change what students feel; streaming the answer, a faster model, or a shorter prompt would. The prompt is about 736 tokens, mostly the 3 retrieved notes, so the notes' length sets the cost.
2. **Latency stays flat from 1 to 50 concurrent students.** p95 stays between 1.57 and 1.76 s with no errors, because each request mostly waits on the model API.
3. **Without the model, a small CI machine serves about 140 requests per second**, and past 10 concurrent requests extra load turns into queueing (p95 759 ms at 50). Where that queue forms (the 10-connection Postgres pool, or the embedding model on the CPU) is not measured yet.
4. **The question was sent to the model twice.** The route saved the question and then loaded the session history, which already contained it. Fixed: prompt tokens 747 → 736 per answer.

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


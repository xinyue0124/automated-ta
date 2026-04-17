# Automated TA - User Flows

Visual guide to user interactions and system flows.

## 🎬 User Journey Map

### Flow 1: First-Time User Sign Up

```
┌─────────────────────────────────────────────────────────┐
│  STEP 1: Landing Page                                   │
│  • User visits http://localhost:5173                    │
│  • Sees beautiful hero section                          │
│  • Sees "Sign Up" button in header                      │
│  • Sees "Get Started Free" button in hero               │
│  • Reads about features and benefits                    │
└────────────────┬────────────────────────────────────────┘
                 │ Clicks "Sign Up"
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 2: Sign Up Modal                                  │
│  • Modal slides up from bottom                          │
│  • Form fields: Full Name, Email, Password              │
│  • Password minimum 6 characters                        │
│  • "Sign Up" button at bottom                           │
│  • "Already have account? Sign In" link                 │
└────────────────┬────────────────────────────────────────┘
                 │ Fills form & submits
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 3: Account Creation                               │
│  • POST /api/auth/signup                                │
│  • Password hashed with bcrypt                          │
│  • User record created in database                      │
│  • JWT token generated                                  │
│  • Token stored in localStorage                         │
└────────────────┬────────────────────────────────────────┘
                 │ Auto sign-in & redirect
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 4: Dashboard (First Visit)                        │
│  • Header shows: User Name + Sign Out button            │
│  • Stats show: 0 Documents, 0 Chats, 0 Messages         │
│  • Empty state: "No documents uploaded yet"             │
│  • Big "Upload Your First Document" button              │
│  • Empty state: "No chat sessions yet"                  │
│  • "Start Your First Chat" button                       │
└─────────────────────────────────────────────────────────┘
```

---

### Flow 2: Upload First Document

```
┌─────────────────────────────────────────────────────────┐
│  STEP 1: Click Upload                                   │
│  • From Dashboard, click "Upload Notes"                 │
│  • OR from any page with "Upload Notes" button          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 2: Upload Modal Opens                             │
│  • Drag & drop zone appears                             │
│  • "Drag & drop your notes here, or click to browse"    │
│  • Shows: "Supported: PDF, TXT, DOC, DOCX, MD (10MB)"   │
└────────────────┬────────────────────────────────────────┘
                 │ Drag file or click to browse
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 3: File Selected                                  │
│  • File preview shows: filename, file size              │
│  • X button to remove and select different file         │
│  • "Upload" button enabled                              │
│  • "Cancel" button                                       │
└────────────────┬────────────────────────────────────────┘
                 │ Click "Upload"
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 4: Upload in Progress                             │
│  • Button shows "Uploading..."                          │
│  • Button disabled during upload                        │
│  • POST /api/files/upload with FormData                 │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 5: Server Processing                              │
│  • File saved to ./uploads/                             │
│  • Metadata saved to documents table                    │
│  • Background processing starts:                        │
│    1. Extract text from file (PDF/DOCX parser)          │
│    2. Split into chunks (1000 chars, 200 overlap)       │
│    3. Generate embeddings (OpenAI API)                  │
│    4. Store chunks + vectors in database                │
│    5. Mark document as processed                        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 6: Back to Dashboard                              │
│  • Modal closes                                          │
│  • Dashboard refreshes                                   │
│  • Document appears in list with:                       │
│    - Filename                                            │
│    - File size                                           │
│    - Upload date                                         │
│    - Status: "Processing..." (yellow clock icon)        │
└────────────────┬────────────────────────────────────────┘
                 │ Wait a few seconds
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 7: Processing Complete                            │
│  • Status changes to "Processed" (green checkmark)       │
│  • Document ready for AI queries                         │
│  • Stats update: "1 Document"                            │
└─────────────────────────────────────────────────────────┘
```

---

### Flow 3: Start Chat Session

```
┌─────────────────────────────────────────────────────────┐
│  STEP 1: Create New Chat                                │
│  • From Dashboard, click "New Chat"                     │
│  • POST /api/chat/sessions                              │
│  • Session created in database                          │
└────────────────┬────────────────────────────────────────┘
                 │ Redirect to /chat/:sessionId
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 2: Chat Interface                                 │
│  • Header: "Back to Dashboard" + "Upload Notes"         │
│  • Empty state: "Start a conversation"                  │
│  • Icon with helpful message                            │
│  • Input box at bottom with:                            │
│    - Paperclip button (upload)                          │
│    - Text area                                           │
│    - Send button                                         │
└────────────────┬────────────────────────────────────────┘
                 │ Type question & press Enter or click Send
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 3: Send Message                                   │
│  • User message appears immediately (blue bubble)       │
│  • Input cleared                                         │
│  • Loading indicator (3 bouncing dots)                  │
│  • POST /api/chat/sessions/:id/messages                 │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 4: Server Processing                              │
│  • Save user message to database                        │
│  • Generate embedding for question                      │
│  • Vector similarity search in document_chunks          │
│  • Find top 3 most relevant chunks                      │
│  • Build context from chunks                            │
│  • Send to OpenAI GPT-4 with context                    │
│  • Receive AI response                                   │
│  • Save AI message to database                          │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 5: Display Response                               │
│  • Loading dots disappear                               │
│  • AI response appears (white bubble, left side)        │
│  • Response references user's uploaded notes            │
│  • Timestamp shown on both messages                     │
│  • Conversation continues...                            │
└─────────────────────────────────────────────────────────┘
```

---

### Flow 4: Returning User Sign In

```
┌─────────────────────────────────────────────────────────┐
│  STEP 1: Visit Site (Signed Out)                        │
│  • User visits http://localhost:5173                    │
│  • Sees landing page                                    │
│  • Clicks "Sign In" in header                           │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 2: Sign In Modal                                  │
│  • Modal appears with Email & Password fields           │
│  • "Sign In" button                                     │
│  • "Don't have account? Sign Up" link                   │
└────────────────┬────────────────────────────────────────┘
                 │ Enter credentials & submit
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 3: Authentication                                 │
│  • POST /api/auth/signin                                │
│  • Server verifies email exists                         │
│  • Compares password hash                               │
│  • Generates JWT token                                  │
│  • Returns token + user info                            │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 4: Redirect to Dashboard                          │
│  • Token stored in localStorage                         │
│  • Auto redirect to /dashboard                          │
│  • Dashboard loads with user's data:                    │
│    - All uploaded documents                             │
│    - All chat sessions                                  │
│    - Updated statistics                                 │
└─────────────────────────────────────────────────────────┘
```

---

### Flow 5: Upload File from Chat

```
┌─────────────────────────────────────────────────────────┐
│  STEP 1: In Active Chat                                 │
│  • User is chatting with AI                             │
│  • Realizes they need to upload additional notes        │
│  • Clicks paperclip icon in input area                  │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 2: Upload Modal Opens                             │
│  • Same upload modal as dashboard                       │
│  • User drags/selects file                              │
│  • Clicks "Upload"                                      │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 3: File Uploaded                                  │
│  • Modal closes                                          │
│  • Chat interface remains open                          │
│  • File processes in background                         │
│  • User can immediately continue chatting               │
└────────────────┬────────────────────────────────────────┘
                 │ After processing completes
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 4: Enhanced Responses                             │
│  • Subsequent questions now include new document        │
│  • AI has access to both old and new notes              │
│  • More comprehensive, personalized answers             │
└─────────────────────────────────────────────────────────┘
```

---

### Flow 6: Unauthenticated User Tries to Upload

```
┌─────────────────────────────────────────────────────────┐
│  SCENARIO: User not signed in                           │
│  • User tries to access /chat/:id directly              │
│  • OR tries any authenticated route                     │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 1: Route Protection                               │
│  • React Router checks: token exists?                   │
│  • No token found in localStorage                       │
│  • <Navigate to="/" /> triggered                        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STEP 2: Redirect to Landing                            │
│  • User sees landing page                               │
│  • Prominent "Sign Up" / "Sign In" buttons              │
│  • Must authenticate to access features                 │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 State Management Flow

### Authentication State (Zustand)

```
┌──────────────────────────────────────────────────┐
│  useAuthStore                                    │
│                                                  │
│  State:                                          │
│  • user: User | null                             │
│  • token: string | null                          │
│  • isLoading: boolean                            │
│                                                  │
│  Actions:                                        │
│  • signIn(email, password)                       │
│  • signUp(email, password, fullName)             │
│  • signOut()                                     │
│  • checkAuth()                                   │
│                                                  │
│  Persistence:                                    │
│  • localStorage: 'auth-token'                    │
│  • Auto-load on app start                        │
│  • Auto-clear on sign out                        │
└──────────────────────────────────────────────────┘
```

---

## 🎯 Component Hierarchy

```
App.tsx
├── Header
│   ├── Logo + Brand
│   ├── Sign Up Button (if not authenticated)
│   ├── Sign In Button (if not authenticated)
│   ├── User Name (if authenticated)
│   └── Sign Out Button (if authenticated)
│
├── Route: /
│   └── LandingPage
│       ├── Hero Section
│       ├── Features Grid (3 columns)
│       └── Benefits Section
│
├── Route: /dashboard (protected)
│   └── Dashboard
│       ├── Stats Cards (3 cards)
│       ├── Documents Section
│       │   ├── Upload Button
│       │   └── Document List
│       │       └── Document Item (filename, status, delete)
│       └── Chat Sessions Section
│           ├── New Chat Button
│           └── Session List
│               └── Session Item (title, date, delete)
│
└── Route: /chat/:sessionId (protected)
    └── ChatPage
        ├── Chat Header
        │   ├── Back Button
        │   └── Upload Button
        ├── Messages Area
        │   ├── Empty State (if no messages)
        │   └── Message List
        │       └── Message (user/AI, content, timestamp)
        └── Input Area
            ├── Paperclip Button
            ├── Text Area
            └── Send Button

Modals (conditional):
├── AuthModal
│   ├── Sign Up Form (if mode=signup)
│   └── Sign In Form (if mode=signin)
│
└── FileUploadModal
    ├── Drag & Drop Zone
    ├── File Preview
    └── Upload/Cancel Buttons
```

---

## 🗄️ Data Flow Diagram

```
Frontend                 Backend                  Database
────────                 ────────                 ────────

User Action
    │
    ├─► API Call ────────► Route Handler
    │                       │
    │                       ├─► Middleware (Auth)
    │                       │
    │                       ├─► Service Layer
    │                       │    │
    │                       │    ├─► Document Processor
    │                       │    ├─► Embedding Service
    │                       │    └─► AI Service
    │                       │
    │                       └─► Database Query ──► PostgreSQL
    │                                                │
    │                                                ├─► users
    │                                                ├─► documents
    │                                                ├─► document_chunks
    │                                                ├─► chat_sessions
    │                                                └─► chat_messages
    │                                                
    ◄── Response ◄────────── JSON Response ◄─────── Query Results
    │
    └─► Update UI State
```

---

## ⚡ Real-Time Interactions

### Message Sending Flow
```
1. User types message and presses Enter/Send
2. Message added to state immediately (optimistic update)
3. Input field cleared
4. Loading indicator shown
5. API call to POST /api/chat/sessions/:id/messages
6. Server processes and generates response
7. Response received (both user & AI messages)
8. State updated with server data
9. Loading indicator hidden
10. AI message appears
11. Auto-scroll to bottom
```

### File Upload Flow
```
1. User drags file over drop zone → highlight zone
2. User drops file → capture file
3. Show file preview with name/size
4. User clicks Upload → disable button, show "Uploading..."
5. FormData created and sent to API
6. Server receives file → save to disk
7. Metadata saved to DB → return response
8. Background processing starts (non-blocking)
9. Modal closes → return to dashboard
10. Document appears with "Processing..." status
11. Processing completes → status updates to "Processed"
12. Document ready for AI queries
```

---

## 🎨 UI State Patterns

### Loading States
- **Sign In/Up**: Button text changes to "Please wait..."
- **File Upload**: Button shows "Uploading..."
- **Chat**: Bouncing dots animation
- **Dashboard**: Spinning loader on initial load

### Empty States
- **No Documents**: Icon + message + "Upload First Document" CTA
- **No Chats**: Icon + message + "Start First Chat" CTA
- **New Chat**: Welcome message with icon

### Error States
- **Auth Error**: Red banner with error message
- **Upload Error**: Red banner with error details
- **Network Error**: Generic error message

### Success States
- **Upload Complete**: Green checkmark, "Processed" label
- **Account Created**: Auto sign-in and redirect
- **Message Sent**: Appears in chat immediately

---

## 📱 Responsive Behavior

### Mobile (< 768px)
- Single column layouts
- Stacked navigation
- Full-width modals
- Larger touch targets
- Hamburger menu (if needed)

### Tablet (768px - 1024px)
- 2-column layouts where appropriate
- Adjusted spacing
- Responsive modals

### Desktop (> 1024px)
- Full 3-column layouts
- Optimal spacing
- Larger modals
- Hover effects

---

This guide shows every major user interaction in Automated TA! 🎓


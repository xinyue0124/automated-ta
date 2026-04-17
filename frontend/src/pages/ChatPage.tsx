import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Send, Upload, ArrowLeft, Paperclip, Plus, MessageSquare, Trash2 } from 'lucide-react'
import api from '../lib/api'
import FileUploadModal from '../components/FileUploadModal'

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

interface ChatSession {
  id: number
  title: string
  createdAt: string
  updatedAt: string
}

export default function ChatPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadMessages()
    loadSessions()
  }, [sessionId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadMessages = async () => {
    try {
      const response = await api.get(`/chat/sessions/${sessionId}/messages`)
      setMessages(response.data.messages)
    } catch (error) {
      console.error('Error loading messages:', error)
    }
  }

  const loadSessions = async () => {
    try {
      const response = await api.get('/chat/sessions')
      setSessions(response.data.sessions)
    } catch (error) {
      console.error('Error loading sessions:', error)
    }
  }

  const createNewSession = async () => {
    try {
      const response = await api.post('/chat/sessions', {
        title: `Chat ${sessions.length + 1}`
      })
      navigate(`/chat/${response.data.session.id}`)
    } catch (error) {
      console.error('Error creating session:', error)
    }
  }

  const deleteSession = async (sessionIdToDelete: number) => {
    if (!confirm('Are you sure you want to delete this chat session?')) return

    try {
      await api.delete(`/chat/sessions/${sessionIdToDelete}`)
      setSessions(sessions.filter(s => s.id !== sessionIdToDelete))
      
      // If we're deleting the current session, navigate to a new one
      if (sessionIdToDelete === parseInt(sessionId || '0')) {
        if (sessions.length > 1) {
          const remainingSession = sessions.find(s => s.id !== sessionIdToDelete)
          if (remainingSession) {
            navigate(`/chat/${remainingSession.id}`)
          } else {
            createNewSession()
          }
        } else {
          createNewSession()
        }
      }
    } catch (error) {
      console.error('Error deleting session:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setIsLoading(true)

    try {
      const response = await api.post(`/chat/sessions/${sessionId}/messages`, {
        content: userMessage
      })

      setMessages([
        ...messages,
        response.data.userMessage,
        response.data.aiMessage
      ])
      
      // Refresh sessions to update the current session's timestamp
      loadSessions()
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <div className="flex-1 flex bg-gray-50">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 bg-white border-r border-gray-200 flex flex-col overflow-hidden`}>
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Chat History</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={createNewSession}
              className="w-full btn-primary flex items-center justify-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>New Chat</span>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer group ${
                  session.id === parseInt(sessionId || '0') ? 'bg-blue-50 border-blue-200' : ''
                }`}
                onClick={() => navigate(`/chat/${session.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <MessageSquare className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {session.title}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatDate(session.updatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSession(session.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                  >
                    <Trash2 className="h-3 w-3 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {!sidebarOpen && (
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <MessageSquare className="h-5 w-5 text-gray-600" />
                  </button>
                )}
                <button
                  onClick={() => navigate('/dashboard')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft className="h-5 w-5 text-gray-600" />
                </button>
                <div>
                  <h1 className="text-lg font-semibold text-gray-900">Chat Session</h1>
                  <p className="text-sm text-gray-500">Ask questions about your uploaded materials</p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(true)}
                className="btn-secondary flex items-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>Upload Notes</span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 py-8">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
                    <Send className="h-8 w-8 text-primary-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Start a conversation
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Ask me anything about your uploaded notes, or upload new materials to get started.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-3xl rounded-2xl px-6 py-4 ${
                          message.role === 'user'
                            ? 'bg-primary-600 text-white'
                            : 'bg-white text-gray-900 shadow-sm border border-gray-200'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        <p
                          className={`text-xs mt-2 ${
                            message.role === 'user' ? 'text-primary-100' : 'text-gray-500'
                          }`}
                        >
                          {new Date(message.createdAt).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white text-gray-900 shadow-sm border border-gray-200 rounded-2xl px-6 py-4">
                        <div className="flex space-x-2">
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="bg-white border-t border-gray-200 px-4 py-4">
            <div className="max-w-4xl mx-auto">
              <form onSubmit={sendMessage} className="flex items-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="p-3 text-gray-400 hover:text-primary-600 transition-colors flex-shrink-0"
                  title="Upload file"
                >
                  <Paperclip className="h-6 w-6" />
                </button>
                <div className="flex-1 relative">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        sendMessage(e)
                      }
                    }}
                    placeholder="Ask a question about your notes..."
                    rows={1}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
                    style={{ maxHeight: '150px', minHeight: '50px' }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="btn-primary p-3 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Send className="h-5 w-5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {showUploadModal && (
        <FileUploadModal
          onClose={() => setShowUploadModal(false)}
          onUploadComplete={() => {
            setShowUploadModal(false)
          }}
        />
      )}
    </>
  )
}
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, MessageSquare, FileText, Trash2, Upload, CheckCircle, Clock } from 'lucide-react'
import api from '../lib/api'
import FileUploadModal from '../components/FileUploadModal'

interface ChatSession {
  id: number
  title: string
  createdAt: string
  updatedAt: string
}

interface Document {
  id: number
  filename: string
  fileType: string
  fileSize: number
  uploadDate: string
  processed: boolean
}

interface Stats {
  documentsUploaded: number
  chatSessions: number
  totalMessages: number
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [sessionsRes, docsRes, statsRes] = await Promise.all([
        api.get('/chat/sessions'),
        api.get('/files'),
        api.get('/user/stats')
      ])

      setSessions(sessionsRes.data.sessions)
      setDocuments(docsRes.data.documents)
      setStats(statsRes.data.stats)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setIsLoading(false)
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

  const deleteSession = async (sessionId: number) => {
    if (!confirm('Are you sure you want to delete this chat session?')) return

    try {
      await api.delete(`/chat/sessions/${sessionId}`)
      setSessions(sessions.filter(s => s.id !== sessionId))
    } catch (error) {
      console.error('Error deleting session:', error)
    }
  }

  const deleteDocument = async (docId: number) => {
    if (!confirm('Are you sure you want to delete this document?')) return

    try {
      await api.delete(`/files/${docId}`)
      setDocuments(documents.filter(d => d.id !== docId))
    } catch (error) {
      console.error('Error deleting document:', error)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="flex-1 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Documents</p>
                  <p className="text-3xl font-bold text-gray-900">{stats?.documentsUploaded || 0}</p>
                </div>
                <FileText className="h-12 w-12 text-primary-600 opacity-20" />
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Chat Sessions</p>
                  <p className="text-3xl font-bold text-gray-900">{stats?.chatSessions || 0}</p>
                </div>
                <MessageSquare className="h-12 w-12 text-primary-600 opacity-20" />
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Messages</p>
                  <p className="text-3xl font-bold text-gray-900">{stats?.totalMessages || 0}</p>
                </div>
                <MessageSquare className="h-12 w-12 text-primary-600 opacity-20" />
              </div>
            </div>
          </div>

          {/* Documents Section */}
          <div className="card mb-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Your Documents</h2>
              <button
                onClick={() => setShowUploadModal(true)}
                className="btn-primary flex items-center space-x-2"
              >
                <Upload className="h-4 w-4" />
                <span>Upload Notes</span>
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No documents uploaded yet</p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="btn-primary"
                >
                  Upload Your First Document
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{doc.filename}</p>
                        <p className="text-sm text-gray-500">
                          {formatFileSize(doc.fileSize)} • {formatDate(doc.uploadDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {doc.processed ? (
                        <span className="flex items-center text-sm text-green-600">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Processed
                        </span>
                      ) : (
                        <span className="flex items-center text-sm text-yellow-600">
                          <Clock className="h-4 w-4 mr-1" />
                          Processing
                        </span>
                      )}
                      <button
                        onClick={() => deleteDocument(doc.id)}
                        className="text-red-600 hover:text-red-700 p-2"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chat Sessions Section */}
          <div className="card">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">Chat Sessions</h2>
              <button
                onClick={createNewSession}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>New Chat</span>
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">No chat sessions yet</p>
                <button
                  onClick={createNewSession}
                  className="btn-primary"
                >
                  Start Your First Chat
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => navigate(`/chat/${session.id}`)}
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <MessageSquare className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{session.title}</p>
                        <p className="text-sm text-gray-500">
                          Updated {formatDate(session.updatedAt)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteSession(session.id)
                      }}
                      className="text-red-600 hover:text-red-700 p-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showUploadModal && (
        <FileUploadModal
          onClose={() => setShowUploadModal(false)}
          onUploadComplete={() => {
            setShowUploadModal(false)
            loadData()
          }}
        />
      )}
    </>
  )
}


import { useState } from 'react'
import { BookOpen, Brain, Upload, Sparkles } from 'lucide-react'
import AuthModal from '../components/AuthModal'

export default function LandingPage() {
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup')

  const handleGetStarted = () => {
    setAuthMode('signup')
    setShowAuthModal(true)
  }

  return (
    <>
      <div className="flex-1">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-primary-50 via-blue-50 to-indigo-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <div className="text-center max-w-3xl mx-auto">
              <h1 className="text-5xl font-bold text-gray-900 mb-6 animate-fade-in">
                Your Automated AI Teaching Assistant
              </h1>
              <p className="text-xl text-gray-600 mb-8 animate-fade-in">
                Upload your class notes and get personalized help powered by AI. 
                Automated TA learns from your materials to provide tailored assistance.
              </p>
              <button
                onClick={handleGetStarted}
                className="btn-primary text-lg px-8 py-4 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all animate-slide-up"
              >
                Get Started Free
              </button>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            How Automated TA Works
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="card text-center hover:shadow-lg transition-shadow">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
                <Upload className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Upload Your Notes
              </h3>
              <p className="text-gray-600">
                Upload your class notes, lecture slides, or study materials in PDF, DOCX, or TXT format.
              </p>
            </div>

            <div className="card text-center hover:shadow-lg transition-shadow">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
                <Brain className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                AI Learns Your Content
              </h3>
              <p className="text-gray-600">
                Our AI processes your materials and creates a personalized knowledge base just for you.
              </p>
            </div>

            <div className="card text-center hover:shadow-lg transition-shadow">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
                <Sparkles className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Get Personalized Help
              </h3>
              <p className="text-gray-600">
                Ask questions and get answers based specifically on your uploaded course materials.
              </p>
            </div>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="bg-gray-50 py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-6">
                  Study Smarter, Not Harder
                </h2>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <BookOpen className="h-6 w-6 text-primary-600 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">
                        Personalized Learning
                      </h4>
                      <p className="text-gray-600">
                        Get help tailored to your specific course content and learning style.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Brain className="h-6 w-6 text-primary-600 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">
                        24/7 Availability
                      </h4>
                      <p className="text-gray-600">
                        Your AI teaching assistant is always ready to help, day or night.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <Sparkles className="h-6 w-6 text-primary-600 mt-1 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-1">
                        Better Retention
                      </h4>
                      <p className="text-gray-600">
                        Engage with your materials in new ways for deeper understanding.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-xl p-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  Ready to get started?
                </h3>
                <p className="text-gray-600 mb-6">
                  Join thousands of students using AI to enhance their learning experience.
                </p>
                <button
                  onClick={handleGetStarted}
                  className="w-full btn-primary text-lg py-3"
                >
                  Create Free Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAuthModal && (
        <AuthModal
          mode={authMode}
          onClose={() => setShowAuthModal(false)}
          onSwitchMode={(mode) => setAuthMode(mode)}
        />
      )}
    </>
  )
}


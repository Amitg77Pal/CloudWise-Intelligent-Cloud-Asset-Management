import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Button from '../components/common/Button';
import {
  Cloud,
  Brain,
  ArrowRight,
  Sun,
  Moon,
  ShieldCheck,
  MessageSquare,
  Sparkles,
  Upload,
  FolderOpen,
  FileSearch,
  CheckCircle2,
  Play,
  Zap,
  Lock,
  Clock3,
  QrCode,
  Mail
} from 'lucide-react';

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeFeature, setActiveFeature] = useState('upload');

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-indigo-600 dark:text-indigo-400">
        <div className="relative w-20 h-20">
          <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-2xl"></div>
          <div className="absolute inset-0 border-4 border-t-indigo-600 dark:border-t-indigo-400 rounded-2xl animate-spin"></div>
          <Cloud className="absolute inset-0 m-auto text-indigo-600 dark:text-indigo-400 animate-pulse" size={32} />
        </div>
      </div>
    );
  }

  if (isAuthenticated) return null;

  const features = [
    {
      id: 'upload',
      icon: Upload,
      title: 'Smart Upload',
      description: 'Drag & drop files. AI analyzes content instantly.',
      color: 'indigo',
      demo: (
        <div className="relative w-full h-56 sm:h-64 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-2xl border-2 border-dashed border-indigo-500/30 flex items-center justify-center group hover:border-indigo-500 hover:bg-indigo-500/5 transition-all cursor-pointer">
          <div className="text-center">
            <Upload className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-indigo-600 group-hover:scale-110 transition-transform" />
            <p className="text-base sm:text-lg font-bold text-foreground">Drop files here</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2 font-medium">AI will categorize automatically</p>
          </div>
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-emerald-500/20 text-emerald-600 text-[10px] sm:text-xs font-bold border border-emerald-500/30">
            <CheckCircle2 size={12} className="inline mr-1" />
            Secure
          </div>
        </div>
      )
    },
    {
      id: 'categorize',
      icon: Brain,
      title: 'Auto-Organize',
      description: 'AI categorizes files by content, not just names.',
      color: 'blue',
      demo: (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 sm:p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl hover:bg-blue-500/20 transition-all cursor-pointer group">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-blue-600 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
              <FileSearch size={24} />
            </div>
            <div className="flex-1">
              <p className="text-sm sm:text-base font-bold text-foreground">Work Documents</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Auto-tagged by AI</p>
            </div>
            <Sparkles className="text-blue-600" size={20} />
          </div>
          <div className="flex items-center gap-3 p-3 sm:p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl hover:bg-purple-500/20 transition-all cursor-pointer group">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-purple-600 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
              <FolderOpen size={24} />
            </div>
            <div className="flex-1">
              <p className="text-sm sm:text-base font-bold text-foreground">Personal Files</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Smart sorted</p>
            </div>
            <Sparkles className="text-purple-600" size={20} />
          </div>
          <div className="flex items-center gap-3 p-3 sm:p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/20 transition-all cursor-pointer group">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-emerald-600 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
              <Brain size={24} />
            </div>
            <div className="flex-1">
              <p className="text-sm sm:text-base font-bold text-foreground">Reports & Data</p>
              <p className="text-xs sm:text-sm text-muted-foreground">AI grouped</p>
            </div>
            <Sparkles className="text-emerald-600" size={20} />
          </div>
        </div>
      )
    },
    {
      id: 'search',
      icon: MessageSquare,
      title: 'AI Assistant',
      description: 'Ask questions, get summaries, find anything instantly.',
      color: 'purple',
      demo: (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0">
              You
            </div>
            <div className="flex-1 bg-secondary p-3 sm:p-4 rounded-2xl rounded-tl-none">
              <p className="text-xs sm:text-sm font-medium text-foreground">"Show me all resumes from 2024"</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center flex-shrink-0">
              <Brain className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex-1 bg-indigo-500/10 border border-indigo-500/20 p-3 sm:p-4 rounded-2xl rounded-tl-none">
              <p className="text-xs sm:text-sm font-medium text-foreground mb-3">Found 12 resumes from 2024:</p>
              <div className="space-y-2">
                <div className="text-[11px] sm:text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-sm">
                  📄 John_Resume_2024.pdf
                </div>
                <div className="text-[11px] sm:text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-lg font-bold text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-sm">
                  📄 Jane_CV_2024.docx
                </div>
                <div className="text-[11px] sm:text-xs text-indigo-600 dark:text-indigo-400 font-bold cursor-pointer hover:underline">
                  + 10 more files →
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-background selection:bg-indigo-500/30 relative overflow-hidden">
      {/* Animated Mesh Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-500/20 dark:bg-purple-500/10 rounded-full mix-blend-multiply dark:mix-blend-lighten filter blur-[128px] animate-blob"></div>
        <div className="absolute top-0 -right-4 w-96 h-96 bg-indigo-500/20 dark:bg-indigo-500/10 rounded-full mix-blend-multiply dark:mix-blend-lighten filter blur-[128px] animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-1/2 w-96 h-96 bg-blue-500/20 dark:bg-blue-500/10 rounded-full mix-blend-multiply dark:mix-blend-lighten filter blur-[128px] animate-blob animation-delay-4000"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border transition-all duration-300 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => navigate('/')}>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 transform group-hover:rotate-12 transition-transform duration-300">
              <Cloud className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl sm:text-2xl font-black text-foreground tracking-tighter bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">CloudWise</span>
          </div>

          <div className="hidden lg:flex items-center gap-10">
            <a href="#features" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">Features</a>
            <a href="#demo" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">Demo</a>
            <a href="#how-it-works" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors">How It Works</a>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 sm:p-2.5 rounded-xl bg-secondary hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all mr-1 sm:mr-2 group"
              aria-label="Toggle theme"
            >
              {theme === 'light' ?
                <Moon size={18} className="group-hover:rotate-12 transition-transform" /> :
                <Sun size={18} className="group-hover:rotate-12 transition-transform" />
              }
            </button>
            <Link to="/login">
              <Button variant="ghost" className="font-bold text-xs sm:text-sm h-9 sm:h-11 px-3 sm:px-4 hover:scale-105 transition-transform">Sign In</Button>
            </Link>
            <Link to="/register">
              <Button variant="primary" className="font-bold text-xs sm:text-sm h-9 sm:h-11 px-4 sm:px-6 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-xl shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105 transition-all">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative pt-[96px] sm:pt-24 pb-16 sm:pb-20 lg:pt-32 lg:pb-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 mb-5 sm:mb-6 hover:scale-105 transition-transform cursor-pointer">
            <Sparkles size={16} className="text-indigo-600 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400">AI-Powered File Management</span>
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-8xl font-black tracking-tighter text-foreground mb-5 sm:mb-7 leading-[1.05] sm:leading-[0.95] max-w-5xl mx-auto">
            Never Lose a File <br />
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 bg-clip-text text-transparent animate-gradient-x">
              Ever Again.
            </span>
          </h1>

          <p className="text-base sm:text-xl lg:text-2xl text-muted-foreground mb-8 sm:mb-10 max-w-3xl mx-auto font-medium leading-relaxed">
            AI-powered cloud storage that automatically organizes, categorizes, and helps you find anything with natural language. <span className="text-indigo-600 dark:text-indigo-400 font-bold">Like magic.</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5 mb-8 sm:mb-12">
            <Link to="/register" className="w-full sm:w-auto group">
              <Button variant="primary" size="large" className="w-full py-4 sm:py-5 px-8 sm:px-10 rounded-2xl text-base sm:text-lg font-black bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-2xl shadow-indigo-500/40 hover:shadow-indigo-500/60 transform hover:-translate-y-1 hover:scale-105 transition-all">
                Start Free Trial
                <ArrowRight className="inline ml-2 group-hover:translate-x-1 transition-transform" size={20} />
              </Button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto group">
              <Button variant="secondary" size="large" className="w-full py-4 sm:py-5 px-8 sm:px-10 rounded-2xl text-base sm:text-lg font-black border-2 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 hover:scale-105 transition-all">
                Sign In
              </Button>
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground font-medium">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>1GB free storage</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span>Setup in 2 minutes</span>
            </div>
          </div>
        </div>
      </main>

      {/* Interactive Feature Demo */}
      <section id="demo" className="py-20 sm:py-28 lg:py-32 relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <span className="text-xs font-black uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-400 mb-4 block">See It in Action</span>
            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-foreground mb-4 sm:mb-6 leading-tight">
              Three Steps to <br />
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">Organized Files</span>
            </h2>
            <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
              Upload, let AI organize, and find anything instantly with natural language.
            </p>
          </div>

          {/* Feature Tabs */}
          <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mb-10 sm:mb-12">
            {features.map((feature) => (
              <button
                key={feature.id}
                onClick={() => setActiveFeature(feature.id)}
                className={`
                  w-full sm:w-auto flex items-center justify-center gap-3 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl font-bold text-xs sm:text-sm transition-all
                  ${activeFeature === feature.id
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xl shadow-indigo-500/30 scale-105'
                    : 'bg-secondary text-muted-foreground hover:bg-primary/10 hover:scale-105'
                  }
                `}
              >
                <feature.icon size={20} />
                {feature.title}
              </button>
            ))}
          </div>

          {/* Active Feature Demo */}
          <div className="max-w-4xl mx-auto">
            <div className="glass rounded-3xl sm:rounded-[48px] p-6 sm:p-8 lg:p-12 border border-border shadow-2xl">
              <div className="mb-8">
                <h3 className="text-2xl sm:text-3xl font-black text-foreground mb-3">
                  {features.find(f => f.id === activeFeature)?.title}
                </h3>
                <p className="text-base sm:text-lg text-muted-foreground font-medium">
                  {features.find(f => f.id === activeFeature)?.description}
                </p>
              </div>
              <div className="animate-fade-in">
                {features.find(f => f.id === activeFeature)?.demo}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Section */}
      <section id="features" className="py-32 bg-slate-50 dark:bg-slate-900/40 relative border-y border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div>
              <span className="text-xs font-black uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-400 mb-4 block">Why CloudWise</span>
              <h2 className="text-5xl font-black tracking-tight text-foreground mb-8 leading-tight">
                Beyond storage. <br />Manage files <span className="text-indigo-600">smarter.</span>
              </h2>
              <div className="space-y-10">
                <div className="flex gap-6 group cursor-pointer">
                  <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-slate-100 dark:border-slate-700 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white group-hover:scale-110 transition-all duration-500 text-slate-600 dark:text-slate-400">
                    <Cloud size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-foreground mb-2 tracking-tight">Secure Cloud Storage</h3>
                    <p className="text-muted-foreground font-medium leading-relaxed">
                      Upload any file type securely to AWS S3. Your data is encrypted and protected with industry-standard security.
                    </p>
                  </div>
                </div>
                <div className="flex gap-6 group cursor-pointer">
                  <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-slate-100 dark:border-slate-700 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white group-hover:scale-110 transition-all duration-500 text-slate-600 dark:text-slate-400">
                    <Brain size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-foreground mb-2 tracking-tight">AI Categorization</h3>
                    <p className="text-muted-foreground font-medium leading-relaxed">
                      Google Gemini AI automatically analyzes and categorizes your files based on actual content, not just filenames.
                    </p>
                  </div>
                </div>
                <div className="flex gap-6 group cursor-pointer">
                  <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 shadow-xl border border-slate-100 dark:border-slate-700 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-600 group-hover:text-white group-hover:scale-110 transition-all duration-500 text-slate-600 dark:text-slate-400">
                    <MessageSquare size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-foreground mb-2 tracking-tight">Smart AI Assistant</h3>
                    <p className="text-muted-foreground font-medium leading-relaxed">
                      Chat naturally with your files. Ask questions, generate summaries, and get instant answers from your documents.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative group">
              <div className="aspect-square rounded-[48px] bg-gradient-to-br from-indigo-500 via-purple-500 to-blue-500 p-1 shadow-2xl overflow-hidden group-hover:scale-105 transition-transform duration-500">
                <div className="w-full h-full rounded-[44px] bg-slate-900 overflow-hidden relative">
                  {/* Abstract Dashboard Mockup */}
                  <div className="absolute inset-x-8 top-16 bottom-0 rounded-t-3xl bg-slate-800/80 border-x border-t border-slate-700/50 p-6">
                    <div className="flex gap-3 mb-8">
                      <div className="w-12 h-3 rounded-full bg-slate-700 animate-pulse"></div>
                      <div className="w-8 h-3 rounded-full bg-slate-700 animate-pulse animation-delay-200"></div>
                    </div>
                    <div className="space-y-4">
                      <div className="h-20 w-full rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center px-4 gap-4 hover:bg-indigo-500/20 transition-all cursor-pointer">
                        <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                          <Sparkles size={20} />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="h-2 w-1/3 bg-indigo-400 rounded-full"></div>
                          <div className="h-2 w-1/2 bg-slate-700/50 rounded-full"></div>
                        </div>
                      </div>
                      <div className="h-20 w-full rounded-2xl bg-slate-700/20 border border-slate-700 flex items-center px-4 gap-4 hover:bg-slate-700/30 transition-all cursor-pointer">
                        <div className="w-10 h-10 rounded-lg bg-slate-700"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-2 w-1/4 bg-slate-700 rounded-full"></div>
                          <div className="h-2 w-1/3 bg-slate-700/50 rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating Security Badge */}
              <div className="absolute -bottom-10 -right-6 bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-2xl border border-border flex items-center gap-4 animate-float">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <p className="text-sm font-black text-foreground">256-bit Encrypted</p>
                  <p className="text-xs text-muted-foreground font-medium">Bank-level security</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <span className="text-xs font-black uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-400 mb-4 block">Simple Process</span>
            <h2 className="text-5xl lg:text-6xl font-black tracking-tight text-foreground mb-6 leading-tight">
              Get organized in <br />
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">three simple steps</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center group">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-indigo-500/30 group-hover:scale-110 group-hover:rotate-12 transition-all">
                1
              </div>
              <h3 className="text-2xl font-black text-foreground mb-3">Upload Files</h3>
              <p className="text-muted-foreground font-medium leading-relaxed">
                Drag and drop your files or connect your cloud storage. Supports all file types.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-blue-500/30 group-hover:scale-110 group-hover:rotate-12 transition-all">
                2
              </div>
              <h3 className="text-2xl font-black text-foreground mb-3">AI Organizes</h3>
              <p className="text-muted-foreground font-medium leading-relaxed">
                Our AI automatically categorizes and tags files based on content analysis.
              </p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-purple-500/30 group-hover:scale-110 group-hover:rotate-12 transition-all">
                3
              </div>
              <h3 className="text-2xl font-black text-foreground mb-3">Find Anything</h3>
              <p className="text-muted-foreground font-medium leading-relaxed">
                Search naturally or chat with AI assistant to find files instantly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* MFA Security Feature */}
      <section className="py-20 sm:py-28 relative border-t border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Visual Side */}
            <div className="relative order-2 lg:order-1">
              <div className="rounded-[36px] bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 shadow-2xl p-8 sm:p-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
                
                <div className="relative z-10 space-y-6 max-w-sm mx-auto">
                  {/* Mockup Screen */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-200 dark:border-slate-800">
                    <div className="flex justify-center mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 shadow-inner">
                        <ShieldCheck size={32} />
                      </div>
                    </div>
                    <div className="text-center mb-6">
                      <h4 className="text-lg font-black text-slate-900 dark:text-white mb-1">Multi-Factor Auth</h4>
                      <p className="text-sm font-medium text-slate-500">Enter the 6-digit code sent to your email.</p>
                    </div>
                    <div className="flex justify-center gap-2 sm:gap-3 mb-8">
                      {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="w-10 sm:w-12 h-12 sm:h-14 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 flex items-center justify-center font-black text-2xl text-emerald-600">
                          *
                        </div>
                      ))}
                    </div>
                    <div className="w-full bg-emerald-600 text-white font-bold text-center py-3.5 rounded-xl shadow-lg shadow-emerald-500/30">
                      Verify Identity
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Content Side */}
            <div className="space-y-6 order-1 lg:order-2">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-400 block">Bank-Grade Security</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground">
                Bulletproof protection for your data.
              </h2>
              <p className="text-sm sm:text-lg text-muted-foreground font-medium leading-relaxed">
                Take control of your account security with Multi-Factor Authentication (MFA). Enable email-based verification to ensure that only you can access your valuable files, even if your password is compromised.
              </p>
              <div className="flex flex-col gap-5 mt-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 flex-shrink-0">
                    <Lock size={20} />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-foreground">Impenetrable Access</h4>
                    <p className="text-sm text-muted-foreground font-medium">Every login attempt requires a fresh, one-time code.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600 flex-shrink-0">
                    <Mail size={20} />
                  </div>
                  <div>
                    <h4 className="text-base font-black text-foreground">Instant Delivery</h4>
                    <p className="text-sm text-muted-foreground font-medium">Codes are securely delivered directly to your inbox instantly.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Transfer Feature */}
      <section className="py-20 sm:py-28 bg-slate-50 dark:bg-slate-900/40 border-y border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-sky-600 dark:text-sky-400 block">Secure Transfer</span>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground">
                Share files with a one‑time PIN.
              </h2>
              <p className="text-sm sm:text-lg text-muted-foreground font-medium leading-relaxed">
                Create a secure transfer link, share a PIN separately, and let recipients download with precision‑timed expiry.
              </p>
              <div className="flex flex-wrap gap-3">
                {['QR + Link share', 'PIN verification', 'Auto-expire sessions'].map((item) => (
                  <span key={item} className="px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300">
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-[36px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="text-sm font-black uppercase tracking-wider text-slate-500">Transfer Card</div>
                  <span className="px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-600 text-[10px] font-black uppercase">Active</span>
                </div>
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-4">
                    <div className="text-xs uppercase font-black text-slate-500 mb-1">PIN</div>
                    <div className="text-2xl font-black tracking-[0.3em] text-slate-900 dark:text-white">493 221</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase font-black text-slate-500">Expires</div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">10 mins</div>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center text-sky-600">
                      <Clock3 size={18} />
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex items-center justify-between">
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200">Share link + QR</div>
                    <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <QrCode size={18} className="text-slate-500" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-8 -right-6 w-36 h-36 rounded-full bg-sky-500/20 blur-3xl"></div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 sm:py-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 rounded-3xl sm:rounded-[56px] p-6 sm:p-10 lg:p-24 overflow-hidden shadow-2xl shadow-indigo-500/40 text-center group hover:shadow-indigo-500/60 transition-shadow">
            <div className="absolute top-0 right-0 w-[420px] sm:w-[600px] h-[420px] sm:h-[600px] bg-white/10 rounded-full blur-3xl -mr-48 sm:-mr-64 -mt-48 sm:-mt-64 group-hover:scale-110 transition-transform duration-1000"></div>
            <div className="absolute bottom-0 left-0 w-[280px] sm:w-[400px] h-[280px] sm:h-[400px] bg-white/5 rounded-full blur-3xl -ml-20 sm:-ml-32 -mb-20 sm:-mb-32"></div>

            <div className="relative z-10 max-w-3xl mx-auto">
              <h2 className="text-2xl sm:text-4xl lg:text-6xl font-black text-white mb-4 sm:mb-8 tracking-tighter leading-tight">
                Ready to get started?
              </h2>
              <p className="text-sm sm:text-lg lg:text-xl text-indigo-100 mb-6 sm:mb-12 font-medium">
                Join the smart way to manage your files with AI-powered organization.
              </p>
              <Link to="/register">
                <Button size="large" variant="secondary" className="bg-white !text-indigo-600 hover:bg-slate-50 py-4 sm:py-6 px-6 sm:px-12 rounded-2xl text-base sm:text-xl font-black shadow-xl hover:-translate-y-2 hover:shadow-2xl transition-all group flex items-center justify-center border-none w-full sm:w-auto">
                  Get Started Free
                  <ArrowRight className="inline ml-2 group-hover:translate-x-2 transition-transform" size={24} />
                </Button>
              </Link>
              <p className="text-xs sm:text-sm text-indigo-200 mt-4 sm:mt-6 font-medium">No credit card required • 1GB free storage • Setup in 2 minutes</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-20 bg-white dark:bg-slate-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center">
                  <Cloud className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-black text-foreground tracking-tighter">CloudWise</span>
              </div>
              <p className="text-muted-foreground font-medium max-w-sm leading-relaxed">
                AI-powered file management system built with React, Spring Boot, and Google Gemini AI.
              </p>
            </div>

            <div>
              <h4 className="font-black text-foreground mb-4">Product</h4>
              <ul className="space-y-3 text-sm font-medium text-muted-foreground">
                <li><a href="#features" className="hover:text-primary transition-colors">Features</a></li>
                <li><a href="#demo" className="hover:text-primary transition-colors">Demo</a></li>
                <li><a href="#how-it-works" className="hover:text-primary transition-colors">How It Works</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-black text-foreground mb-4">Links</h4>
              <ul className="space-y-3 text-sm font-medium text-muted-foreground">
                <li><Link to="/login" className="hover:text-primary transition-colors">Sign In</Link></li>
                <li><Link to="/register" className="hover:text-primary transition-colors">Register</Link></li>
                <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-primary transition-colors">Terms of Use</Link></li>
              </ul>
            </div>
          </div>

          <div className="pt-10 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              © 2026 CloudWise
            </p>
            <div className="flex items-center gap-6 text-muted-foreground">
              <Lock size={16} className="text-emerald-500" />
              <span className="text-xs font-medium">Secure & Private</span>
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-20px);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes gradient-x {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }

        .animate-blob {
          animation: blob 7s infinite;
        }

        .animation-delay-2000 {
          animation-delay: 2s;
        }

        .animation-delay-4000 {
          animation-delay: 4s;
        }

        .animation-delay-200 {
          animation-delay: 0.2s;
        }

        .animate-float {
          animation: float 6s ease-in-out infinite;
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }

        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }

        .glass {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .dark .glass {
          background: rgba(15, 23, 42, 0.7);
        }
      `}</style>
    </div>
  );
};

export default Home;

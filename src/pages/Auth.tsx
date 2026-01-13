import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { TerminalAuth } from '@/components/TerminalAuth';
import { Terminal, Mail, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FadeContent } from '@/components/animations/FadeContent';
import { Link } from 'react-router-dom';

type AuthView = 'terminal' | 'email-sent' | 'confirming' | 'confirmed' | 'error' | 'recovery';

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();
  const [view, setView] = useState<AuthView>('terminal');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [pendingEmail, setPendingEmail] = useState<string>('');

  // Handle deep links for email confirmation and password recovery
  useEffect(() => {
    const handleAuthRedirect = async () => {
      // Check URL hash for Supabase auth tokens
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');
      const error = hashParams.get('error');
      const errorDescription = hashParams.get('error_description');

      if (error) {
        setErrorMessage(errorDescription || error);
        setView('error');
        return;
      }

      if (accessToken && refreshToken) {
        setView('confirming');
        
        try {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            setErrorMessage(sessionError.message);
            setView('error');
            return;
          }

          if (type === 'recovery') {
            setView('recovery');
            toast.success('You can now reset your password');
          } else {
            setView('confirmed');
            toast.success('Email confirmed successfully!');
            // Redirect to home after confirmation
            setTimeout(() => navigate('/'), 2000);
          }
        } catch (err: any) {
          setErrorMessage(err.message || 'Authentication failed');
          setView('error');
        }
      }
    };

    handleAuthRedirect();
  }, [navigate]);

  // Redirect if already logged in (and not in recovery flow)
  useEffect(() => {
    if (!loading && user && view !== 'recovery' && view !== 'confirming' && view !== 'confirmed') {
      navigate('/');
    }
  }, [user, loading, view, navigate]);

  const handleAuthComplete = () => {
    navigate('/');
  };

  const handleEmailSent = (email: string) => {
    setPendingEmail(email);
    setView('email-sent');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground matrix-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 glass-card">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded bg-primary/20 border border-primary/50 flex items-center justify-center glow-border">
                <Terminal className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h1 className="font-mono font-bold text-sm text-foreground">MuriukiDB</h1>
                <p className="font-mono text-[10px] text-muted-foreground">Authentication</p>
              </div>
            </Link>
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2 font-mono">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
        <FadeContent blur duration={500}>
          {view === 'terminal' && (
            <div className="w-full max-w-2xl h-[500px]">
              <TerminalAuth 
                onComplete={handleAuthComplete} 
                onCancel={() => navigate('/')}
                onEmailSent={handleEmailSent}
              />
            </div>
          )}

          {view === 'email-sent' && (
            <div className="text-center max-w-md mx-auto">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center">
                <Mail className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-mono font-bold mb-4 text-primary">Check Your Email</h2>
              <p className="text-muted-foreground mb-2">
                We've sent a confirmation link to:
              </p>
              <p className="text-foreground font-mono mb-6 text-lg">{pendingEmail}</p>
              <div className="bg-secondary/30 rounded-lg p-4 mb-6 text-left font-mono text-sm">
                <p className="text-muted-foreground mb-2">📧 Open the email</p>
                <p className="text-muted-foreground mb-2">🔗 Click the confirmation link</p>
                <p className="text-muted-foreground">✅ You'll be redirected back here</p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setView('terminal')}
                className="font-mono"
              >
                Back to Login
              </Button>
            </div>
          )}

          {view === 'confirming' && (
            <div className="text-center max-w-md mx-auto">
              <Loader2 className="w-16 h-16 mx-auto mb-6 animate-spin text-primary" />
              <h2 className="text-2xl font-mono font-bold mb-4">Confirming...</h2>
              <p className="text-muted-foreground">Please wait while we verify your account.</p>
            </div>
          )}

          {view === 'confirmed' && (
            <div className="text-center max-w-md mx-auto">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 border border-green-500/50 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-mono font-bold mb-4 text-green-500">Email Confirmed!</h2>
              <p className="text-muted-foreground mb-6">
                Your account has been verified. Redirecting you to the app...
              </p>
              <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
            </div>
          )}

          {view === 'recovery' && (
            <div className="text-center max-w-md mx-auto">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/20 border border-primary/50 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-mono font-bold mb-4 text-primary">Password Reset</h2>
              <p className="text-muted-foreground mb-6">
                You can now set a new password for your account.
              </p>
              <Button 
                onClick={() => navigate('/')}
                className="font-mono"
              >
                Continue to App
              </Button>
            </div>
          )}

          {view === 'error' && (
            <div className="text-center max-w-md mx-auto">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-destructive/20 border border-destructive/50 flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-destructive" />
              </div>
              <h2 className="text-2xl font-mono font-bold mb-4 text-destructive">Error</h2>
              <p className="text-muted-foreground mb-6">{errorMessage}</p>
              <Button 
                variant="outline" 
                onClick={() => setView('terminal')}
                className="font-mono"
              >
                Try Again
              </Button>
            </div>
          )}
        </FadeContent>
      </main>
    </div>
  );
};

export default Auth;
import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

type AuthStep = 'idle' | 'signup_nickname' | 'signup_email' | 'signup_password' | 'signup_confirm' |
                'login_email' | 'login_password' |
                'recovery_email' | 'recovery_sent';

interface TerminalAuthProps {
  onComplete: () => void;
  onCancel: () => void;
}

export function TerminalAuth({ onComplete, onCancel }: TerminalAuthProps) {
  const [step, setStep] = useState<AuthStep>('idle');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<Array<{ type: 'input' | 'output' | 'error' | 'success'; text: string }>>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ nickname: '', email: '', password: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { signUp, signIn, resetPassword, user } = useAuth();

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [history]);

  // Focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  // Handle Ctrl+T for password toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 't') {
        e.preventDefault();
        setShowPassword(prev => !prev);
        toast.info(showPassword ? 'Password hidden' : 'Password visible', { duration: 1000 });
      }
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPassword, onCancel]);

  // If user is already logged in
  useEffect(() => {
    if (user) {
      addOutput('success', `✓ Already authenticated as ${user.email}`);
      setTimeout(onComplete, 1000);
    }
  }, [user, onComplete]);

  const addOutput = (type: 'input' | 'output' | 'error' | 'success', text: string) => {
    setHistory(prev => [...prev, { type, text }]);
  };

  const processCommand = useCallback(async (command: string) => {
    const cmd = command.trim().toUpperCase();
    const rawValue = command.trim();

    // Handle idle state commands
    if (step === 'idle') {
      if (cmd === 'SIGNUP' || cmd === 'REGISTER') {
        addOutput('input', `> ${command}`);
        addOutput('output', '╔════════════════════════════════════════╗');
        addOutput('output', '║         ACCOUNT REGISTRATION           ║');
        addOutput('output', '╚════════════════════════════════════════╝');
        addOutput('output', '');
        addOutput('output', 'Enter your desired NICKNAME:');
        addOutput('output', '(2-20 characters, spaces allowed between characters)');
        setStep('signup_nickname');
        return;
      }
      
      if (cmd === 'LOGIN' || cmd === 'SIGNIN') {
        addOutput('input', `> ${command}`);
        addOutput('output', '╔════════════════════════════════════════╗');
        addOutput('output', '║            ACCOUNT LOGIN               ║');
        addOutput('output', '╚════════════════════════════════════════╝');
        addOutput('output', '');
        addOutput('output', 'Enter your EMAIL:');
        setStep('login_email');
        return;
      }
      
      if (cmd === 'RECOVER' || cmd === 'RESET' || cmd === 'FORGOT') {
        addOutput('input', `> ${command}`);
        addOutput('output', '╔════════════════════════════════════════╗');
        addOutput('output', '║         PASSWORD RECOVERY              ║');
        addOutput('output', '╚════════════════════════════════════════╝');
        addOutput('output', '');
        addOutput('output', 'Enter your EMAIL to receive recovery link:');
        setStep('recovery_email');
        return;
      }
      
      if (cmd === 'EXIT' || cmd === 'CANCEL' || cmd === 'QUIT') {
        onCancel();
        return;
      }
      
      if (cmd === 'HELP') {
        addOutput('input', `> ${command}`);
        addOutput('output', '');
        addOutput('output', 'Available commands:');
        addOutput('output', '  SIGNUP   - Create a new account');
        addOutput('output', '  LOGIN    - Sign in to existing account');
        addOutput('output', '  RECOVER  - Reset forgotten password');
        addOutput('output', '  EXIT     - Cancel and return');
        addOutput('output', '');
        addOutput('output', 'Shortcuts:');
        addOutput('output', '  Ctrl+T   - Toggle password visibility');
        addOutput('output', '  Escape   - Cancel operation');
        return;
      }
      
      addOutput('input', `> ${command}`);
      addOutput('error', `Unknown command: ${command}`);
      addOutput('output', 'Type HELP for available commands');
      return;
    }

    // Handle signup flow
    if (step === 'signup_nickname') {
      const nickname = rawValue.replace(/^\s+|\s+$/g, '').replace(/\s+/g, ' ');
      if (nickname.length < 2 || nickname.length > 20) {
        addOutput('input', `> ${nickname}`);
        addOutput('error', 'Nickname must be 2-20 characters');
        return;
      }
      addOutput('input', `> ${nickname}`);
      setFormData(prev => ({ ...prev, nickname }));
      addOutput('output', '');
      addOutput('output', 'Enter your EMAIL:');
      setStep('signup_email');
      return;
    }

    if (step === 'signup_email') {
      const email = rawValue.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        addOutput('input', `> ${email}`);
        addOutput('error', 'Invalid email format');
        return;
      }
      addOutput('input', `> ${email}`);
      setFormData(prev => ({ ...prev, email }));
      addOutput('output', '');
      addOutput('output', 'Enter your PASSWORD:');
      addOutput('output', '(min 6 characters, Ctrl+T to toggle visibility)');
      setStep('signup_password');
      return;
    }

    if (step === 'signup_password') {
      const password = rawValue.trim();
      if (password.length < 6) {
        addOutput('input', `> ${'*'.repeat(password.length)}`);
        addOutput('error', 'Password must be at least 6 characters');
        return;
      }
      addOutput('input', `> ${'*'.repeat(password.length)}`);
      setFormData(prev => ({ ...prev, password }));
      addOutput('output', '');
      addOutput('output', '╔════════════════════════════════════════╗');
      addOutput('output', `║ Nickname: ${formData.nickname.padEnd(28)}║`);
      addOutput('output', `║ Email:    ${formData.email.padEnd(28)}║`);
      addOutput('output', '╚════════════════════════════════════════╝');
      addOutput('output', '');
      addOutput('output', 'Type CONFIRM to create account or CANCEL to abort:');
      setStep('signup_confirm');
      return;
    }

    if (step === 'signup_confirm') {
      if (cmd === 'CONFIRM' || cmd === 'YES' || cmd === 'Y') {
        addOutput('input', `> ${command}`);
        setIsProcessing(true);
        addOutput('output', 'Creating account...');
        
        const { error } = await signUp(formData.email, formData.password, formData.nickname);
        
        if (error) {
          addOutput('error', `Error: ${error}`);
          addOutput('output', 'Type SIGNUP to try again or EXIT to cancel');
          setStep('idle');
        } else {
          addOutput('success', '');
          addOutput('success', '✓ Account created successfully!');
          addOutput('success', '✓ You are now logged in');
          addOutput('success', '');
          toast.success('Welcome to the leaderboard!');
          setTimeout(onComplete, 1500);
        }
        setIsProcessing(false);
        return;
      }
      
      if (cmd === 'CANCEL' || cmd === 'NO' || cmd === 'N') {
        addOutput('input', `> ${command}`);
        addOutput('output', 'Registration cancelled');
        setFormData({ nickname: '', email: '', password: '' });
        setStep('idle');
        return;
      }
      
      addOutput('input', `> ${command}`);
      addOutput('error', 'Type CONFIRM or CANCEL');
      return;
    }

    // Handle login flow
    if (step === 'login_email') {
      const email = rawValue.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        addOutput('input', `> ${email}`);
        addOutput('error', 'Invalid email format');
        return;
      }
      addOutput('input', `> ${email}`);
      setFormData(prev => ({ ...prev, email }));
      addOutput('output', '');
      addOutput('output', 'Enter your PASSWORD:');
      addOutput('output', '(Ctrl+T to toggle visibility)');
      setStep('login_password');
      return;
    }

    if (step === 'login_password') {
      const password = rawValue.trim();
      addOutput('input', `> ${'*'.repeat(password.length)}`);
      setIsProcessing(true);
      addOutput('output', 'Authenticating...');
      
      const { error } = await signIn(formData.email, password);
      
      if (error) {
        addOutput('error', `Error: ${error}`);
        addOutput('output', 'Type LOGIN to try again or RECOVER for password reset');
        setStep('idle');
      } else {
        addOutput('success', '');
        addOutput('success', '✓ Authentication successful!');
        addOutput('success', '');
        toast.success('Welcome back!');
        setTimeout(onComplete, 1500);
      }
      setIsProcessing(false);
      return;
    }

    // Handle recovery flow
    if (step === 'recovery_email') {
      const email = rawValue.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        addOutput('input', `> ${email}`);
        addOutput('error', 'Invalid email format');
        return;
      }
      addOutput('input', `> ${email}`);
      setIsProcessing(true);
      addOutput('output', 'Sending recovery email...');
      
      const { error } = await resetPassword(email);
      
      if (error) {
        addOutput('error', `Error: ${error}`);
        setStep('idle');
      } else {
        addOutput('success', '');
        addOutput('success', '✓ Recovery email sent!');
        addOutput('output', 'Check your inbox for the reset link');
        addOutput('output', '');
        setStep('recovery_sent');
      }
      setIsProcessing(false);
      return;
    }

    if (step === 'recovery_sent') {
      addOutput('input', `> ${command}`);
      addOutput('output', 'Type LOGIN to sign in or EXIT to cancel');
      setStep('idle');
      return;
    }
  }, [step, formData, signUp, signIn, resetPassword, onComplete, onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      processCommand(input);
      setInput('');
    }
  };

  const isPasswordField = step === 'signup_password' || step === 'login_password';

  return (
    <div className="terminal-window h-full flex flex-col">
      <div className="terminal-header">
        <div className="terminal-dot terminal-dot-red" onClick={onCancel} style={{ cursor: 'pointer' }} />
        <div className="terminal-dot terminal-dot-yellow" />
        <div className="terminal-dot terminal-dot-green" />
        <span className="ml-4 text-sm text-muted-foreground font-medium">AUTH — Secure Login Terminal</span>
      </div>
      
      <div ref={containerRef} className="terminal-body flex-1 overflow-auto scanline">
        {/* Welcome message */}
        <div className="mb-4 text-muted-foreground">
          <pre className="text-[hsl(var(--terminal-cyan))] text-xs leading-tight">{`
╔═══════════════════════════════════════════╗
║     LEADERBOARD AUTHENTICATION SYSTEM     ║
╚═══════════════════════════════════════════╝`}</pre>
          <p className="mt-2 text-[hsl(var(--terminal-green))]">Available commands:</p>
          <p className="text-xs ml-2">• SIGNUP  - Create new account</p>
          <p className="text-xs ml-2">• LOGIN   - Sign in to account</p>
          <p className="text-xs ml-2">• RECOVER - Reset password</p>
          <p className="text-xs ml-2">• HELP    - Show all commands</p>
          <p className="text-xs ml-2">• EXIT    - Cancel</p>
        </div>

        {/* Command history */}
        {history.map((entry, i) => (
          <div 
            key={i} 
            className={`font-mono text-sm ${
              entry.type === 'error' ? 'text-destructive' :
              entry.type === 'success' ? 'text-[hsl(var(--terminal-bright-green))]' :
              entry.type === 'input' ? 'text-[hsl(var(--terminal-cyan))]' :
              'text-foreground'
            }`}
          >
            {entry.text}
          </div>
        ))}

        {/* Current input */}
        {!isProcessing && (
          <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-2">
            <span className="text-[hsl(var(--terminal-cyan))]">❯</span>
            <input
              ref={inputRef}
              type={isPasswordField && !showPassword ? 'password' : 'text'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-foreground font-mono"
              placeholder={step === 'idle' ? 'Enter command...' : ''}
              autoComplete="off"
              spellCheck={false}
            />
          </form>
        )}
        
        {isProcessing && (
          <div className="flex items-center gap-2 mt-2 text-muted-foreground">
            <span className="animate-pulse">⋯</span>
            <span>Processing...</span>
          </div>
        )}
      </div>
    </div>
  );
}
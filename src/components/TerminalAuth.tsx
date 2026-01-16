import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Eye, EyeOff } from 'lucide-react';
import { PasswordStrengthIndicator } from './PasswordStrengthIndicator';

type AuthStep = 
  | 'idle' 
  | 'signup_nickname' | 'signup_email' | 'signup_password' | 'signup_confirming'
  | 'login_email' | 'login_password'
  | 'recovery_email' | 'recovery_confirming' | 'recovery_new_password'
  | 'email_change_new' | 'email_change_confirm';

interface TerminalAuthProps {
  onComplete: () => void;
  onCancel: () => void;
  onEmailSent?: (email: string) => void;
  initialStep?: AuthStep;
}

// Terminal commands for autocomplete
const TERMINAL_COMMANDS = ['SIGNUP', 'LOGIN', 'RECOVER', 'EMAIL', 'HELP', 'EXIT'];

export function TerminalAuth({ onComplete, onCancel, onEmailSent, initialStep }: TerminalAuthProps) {
  const [step, setStep] = useState<AuthStep>(initialStep || 'idle');
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<Array<{ type: 'input' | 'output' | 'error' | 'success'; text: string }>>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ nickname: '', email: '', password: '', newEmail: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [authCompleted, setAuthCompleted] = useState(false);
  const [cmdSuggestionIndex, setCmdSuggestionIndex] = useState(-1);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { signUp, signIn, resetPassword, updatePassword, updateEmail, user } = useAuth();

  // Show recovery mode welcome message
  useEffect(() => {
    if (initialStep === 'recovery_new_password') {
      setHistory([
        { type: 'output', text: '╔══════════════════════════════════════════╗' },
        { type: 'output', text: '║         PASSWORD RESET                   ║' },
        { type: 'output', text: '╚══════════════════════════════════════════╝' },
        { type: 'output', text: '' },
        { type: 'success', text: '✓ Recovery link verified!' },
        { type: 'output', text: '' },
        { type: 'output', text: 'Enter your NEW PASSWORD:' },
        { type: 'output', text: '(min 6 characters, Shift+T to toggle visibility)' },
      ]);
    }
  }, [initialStep]);

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

  // Handle Shift+T for password toggle and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isPasswordStep = step === 'signup_password' || step === 'login_password' || step === 'recovery_new_password';

      if (isPasswordStep && e.shiftKey && !e.altKey && !e.ctrlKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setShowPassword(prev => !prev);
      }

      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [step, onCancel]);

  // If user is already logged in (but only check once on mount, not during flow)
  useEffect(() => {
    if (user && step === 'idle' && !authCompleted) {
      addOutput('success', `✓ Already authenticated as ${user.email}`);
      setAuthCompleted(true);
      setTimeout(onComplete, 1000);
    }
  }, [user, step, authCompleted, onComplete]);

  const addOutput = (type: 'input' | 'output' | 'error' | 'success', text: string) => {
    setHistory(prev => [...prev, { type, text }]);
  };

  const completeAuth = useCallback(() => {
    setAuthCompleted(true);
    setTimeout(onComplete, 1500);
  }, [onComplete]);

  const processCommand = useCallback(async (command: string) => {
    const cmd = command.trim().toUpperCase();
    const rawValue = command.trim();

    // Handle idle state commands
    if (step === 'idle') {
      if (cmd === 'SIGNUP' || cmd === 'REGISTER') {
        addOutput('input', `> ${command}`);
        addOutput('output', '╔══════════════════════════════════════════╗');
        addOutput('output', '║         ACCOUNT REGISTRATION             ║');
        addOutput('output', '╚══════════════════════════════════════════╝');
        addOutput('output', '');
        addOutput('output', 'Enter your desired NICKNAME:');
        addOutput('output', '(2-20 characters, spaces allowed between characters)');
        setStep('signup_nickname');
        return;
      }
      
      if (cmd === 'LOGIN' || cmd === 'SIGNIN') {
        addOutput('input', `> ${command}`);
        addOutput('output', '╔══════════════════════════════════════════╗');
        addOutput('output', '║            ACCOUNT LOGIN                 ║');
        addOutput('output', '╚══════════════════════════════════════════╝');
        addOutput('output', '');
        addOutput('output', 'Enter your EMAIL:');
        setStep('login_email');
        return;
      }
      
      if (cmd === 'RECOVER' || cmd === 'RESET' || cmd === 'FORGOT') {
        addOutput('input', `> ${command}`);
        addOutput('output', '╔══════════════════════════════════════════╗');
        addOutput('output', '║         PASSWORD RECOVERY                ║');
        addOutput('output', '╚══════════════════════════════════════════╝');
        addOutput('output', '');
        addOutput('output', 'Enter your EMAIL to receive a reset link:');
        setStep('recovery_email');
        return;
      }

      if (cmd === 'EMAIL' || cmd === 'CHANGE-EMAIL') {
        if (!user) {
          addOutput('input', `> ${command}`);
          addOutput('error', 'You must be logged in to change your email');
          addOutput('output', 'Use LOGIN or SIGNUP first');
          return;
        }
        addOutput('input', `> ${command}`);
        addOutput('output', '╔══════════════════════════════════════════╗');
        addOutput('output', '║           EMAIL CHANGE                   ║');
        addOutput('output', '╚══════════════════════════════════════════╝');
        addOutput('output', '');
        addOutput('output', `Current email: ${user.email}`);
        addOutput('output', '');
        addOutput('output', 'Enter your NEW EMAIL address:');
        setStep('email_change_new');
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
        addOutput('output', '  EMAIL    - Change your email address');
        addOutput('output', '  EXIT     - Cancel and return');
        addOutput('output', '');
        addOutput('output', 'Shortcuts:');
        addOutput('output', '  Shift+T  - Toggle password visibility');
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
      addOutput('output', '(min 6 characters, Shift+T to toggle visibility)');
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
      
      // Show summary and create account
      addOutput('output', '');
      addOutput('output', '╔══════════════════════════════════════════╗');
      addOutput('output', `║ Nickname: ${formData.nickname.padEnd(29)}║`);
      addOutput('output', `║ Email:    ${formData.email.padEnd(29)}║`);
      addOutput('output', '╚══════════════════════════════════════════╝');
      addOutput('output', '');
      setIsProcessing(true);
      addOutput('output', 'Creating your account...');
      
      // Use native Supabase signup with email confirmation link
      const { error, needsEmailConfirmation } = await signUp(formData.email, password, formData.nickname);
      
      if (error) {
        addOutput('error', `Error: ${error}`);
        addOutput('output', 'Type SIGNUP to try again or EXIT to cancel');
        setStep('idle');
        setIsProcessing(false);
        return;
      }
      
      if (needsEmailConfirmation) {
        addOutput('success', '');
        addOutput('success', '✓ Account created!');
        addOutput('output', '');
        addOutput('output', 'Check your email and click the confirmation link.');
        addOutput('output', 'You will be automatically logged in after clicking.');
        if (onEmailSent) {
          onEmailSent(formData.email);
        }
        setStep('signup_confirming');
      } else {
        addOutput('success', '');
        addOutput('success', '✓ Account created successfully!');
        addOutput('success', '✓ You are now logged in');
        addOutput('success', '');
        toast.success('Welcome to MuriukiDB RDBMS!');
        setFormData({ nickname: '', email: '', password: '', newEmail: '' });
        completeAuth();
      }
      setIsProcessing(false);
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
      addOutput('output', '(Shift+T to toggle visibility)');
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
        setIsProcessing(false);
        return;
      }
      
      addOutput('success', '');
      addOutput('success', '✓ Authentication successful!');
      addOutput('success', '');
      toast.success('Welcome back!');
      completeAuth();
      setIsProcessing(false);
      return;
    }

    // Handle recovery flow - sends native Supabase reset email
    if (step === 'recovery_email') {
      const email = rawValue.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        addOutput('input', `> ${email}`);
        addOutput('error', 'Invalid email format');
        return;
      }
      addOutput('input', `> ${email}`);
      setFormData(prev => ({ ...prev, email }));
      setIsProcessing(true);
      addOutput('output', 'Sending password reset link...');
      
      // Use native Supabase password reset
      const { error } = await resetPassword(email);
      
      if (error) {
        addOutput('error', `Error: ${error}`);
        setStep('idle');
        setIsProcessing(false);
        return;
      }
      
      addOutput('success', '');
      addOutput('success', '✓ Password reset link sent!');
      addOutput('output', '');
      addOutput('output', 'Check your email and click the reset link.');
      addOutput('output', 'You will be prompted to set a new password.');
      setStep('recovery_confirming');
      setIsProcessing(false);
      return;
    }

    // Handle password update after recovery link click
    if (step === 'recovery_new_password') {
      const password = rawValue.trim();
      if (password.length < 6) {
        addOutput('input', `> ${'*'.repeat(password.length)}`);
        addOutput('error', 'Password must be at least 6 characters');
        return;
      }
      
      addOutput('input', `> ${'*'.repeat(password.length)}`);
      setIsProcessing(true);
      addOutput('output', 'Updating your password...');
      
      const { error } = await updatePassword(password);
      
      if (error) {
        addOutput('error', `Error: ${error}`);
        addOutput('output', 'Please try again:');
        setIsProcessing(false);
        return;
      }
      
      addOutput('success', '');
      addOutput('success', '✓ Password updated successfully!');
      addOutput('success', '✓ You are now logged in');
      addOutput('success', '');
      toast.success('Password updated! Welcome back!');
      setFormData({ nickname: '', email: '', password: '', newEmail: '' });
      completeAuth();
      setIsProcessing(false);
      return;
    }

    // Handle email change flow
    if (step === 'email_change_new') {
      const newEmail = rawValue.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        addOutput('input', `> ${newEmail}`);
        addOutput('error', 'Invalid email format');
        return;
      }
      addOutput('input', `> ${newEmail}`);
      setFormData(prev => ({ ...prev, newEmail }));
      setIsProcessing(true);
      addOutput('output', 'Sending confirmation to new email...');
      
      const { error } = await updateEmail(newEmail);
      
      if (error) {
        addOutput('error', `Error: ${error}`);
        setStep('idle');
        setIsProcessing(false);
        return;
      }
      
      addOutput('success', '');
      addOutput('success', '✓ Confirmation email sent!');
      addOutput('output', '');
      addOutput('output', 'A confirmation link has been sent to your NEW email.');
      addOutput('output', 'Click the link in the email to confirm the change.');
      addOutput('output', '(Link expires in 24 hours)');
      addOutput('output', '');
      addOutput('output', 'Press ENTER or type DONE to continue:');
      setStep('email_change_confirm');
      setIsProcessing(false);
      return;
    }

    if (step === 'email_change_confirm') {
      addOutput('input', `> ${command}`);
      addOutput('output', '');
      addOutput('output', 'Email change pending confirmation.');
      addOutput('output', 'Check your new email inbox and click the confirmation link.');
      setFormData({ nickname: '', email: '', password: '', newEmail: '' });
      setStep('idle');
      return;
    }
  }, [step, formData, signUp, signIn, resetPassword, updatePassword, updateEmail, onCancel, onEmailSent, completeAuth, user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      processCommand(input);
      setInput('');
    }
  };

  const isPasswordField = step === 'signup_password' || step === 'login_password' || step === 'recovery_new_password';

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
          <p className="text-xs ml-2">• EMAIL   - Change email address</p>
          <p className="text-xs ml-2">• HELP    - Show all commands</p>
          <p className="text-xs ml-2">• EXIT    - Cancel</p>
        </div>

        {/* Command history - use whitespace-pre for proper box rendering */}
        {history.map((entry, i) => (
          <div 
            key={i} 
            className={`font-mono text-sm whitespace-pre ${
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
          <form onSubmit={handleSubmit} className="flex flex-col gap-2 mt-2">
            <div className="flex items-center gap-2">
              <span className="text-[hsl(var(--terminal-green))] font-mono">{'>'}</span>
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type={isPasswordField && !showPassword ? 'password' : 'text'}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    setCmdSuggestionIndex(-1);
                    if (isPasswordField) {
                      setCurrentPasswordInput(e.target.value);
                    }
                  }}
                  onKeyDown={(e) => {
                    // Tab autocomplete for commands in idle state
                    if (e.key === 'Tab' && step === 'idle') {
                      e.preventDefault();
                      const upperInput = input.toUpperCase();
                      const matches = TERMINAL_COMMANDS.filter(cmd => 
                        cmd.startsWith(upperInput) && cmd !== upperInput
                      );
                      
                      if (matches.length === 1) {
                        setInput(matches[0]);
                      } else if (matches.length > 1) {
                        const nextIdx = (cmdSuggestionIndex + 1) % matches.length;
                        setCmdSuggestionIndex(nextIdx);
                        setInput(matches[nextIdx]);
                      }
                    }
                  }}
                  className="w-full bg-transparent border-none outline-none font-mono text-foreground"
                  autoComplete="off"
                  spellCheck="false"
                  placeholder={step === 'idle' ? 'Type command... (Tab to autocomplete)' : ''}
                />
              </div>
              {isPasswordField && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              )}
            </div>
            
            {/* Password strength indicator */}
            {isPasswordField && currentPasswordInput.length > 0 && (
              <div className="ml-4 max-w-xs">
                <PasswordStrengthIndicator password={currentPasswordInput} />
              </div>
            )}
          </form>
        )}

        {isProcessing && (
          <div className="flex items-center gap-2 mt-2 text-muted-foreground">
            <span className="animate-pulse">Processing...</span>
          </div>
        )}
      </div>
    </div>
  );
}

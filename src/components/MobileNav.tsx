import { useState } from 'react';
import { Menu, X, Play, Keyboard, Trophy, Github, LogIn, LogOut, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';

interface MobileNavProps {
  onStartTour: () => void;
  onOpenShortcuts: () => void;
  onOpenProfile: () => void;
  isAuthenticated: boolean;
  onAuth: () => void;
  onSignOut: () => void;
  userNickname?: string;
}

export function MobileNav({
  onStartTour,
  onOpenShortcuts,
  onOpenProfile,
  isAuthenticated,
  onAuth,
  onSignOut,
  userNickname,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);

  const handleAction = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden glass-button h-9 w-9"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="right" 
        className="w-72 glass-card border-l border-border/50 bg-background/95 backdrop-blur-xl"
      >
        <SheetHeader className="border-b border-border/30 pb-4 mb-4">
          <SheetTitle className="text-left font-mono text-primary flex items-center gap-2">
            <span className="text-lg">Menu</span>
          </SheetTitle>
        </SheetHeader>
        
        <nav className="flex flex-col gap-2">
          {/* User Section */}
          {isAuthenticated ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 mb-2 animate-in fade-in slide-in-from-right-2 duration-200">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{userNickname || 'User'}</p>
                <p className="text-xs text-muted-foreground">Signed in</p>
              </div>
            </div>
          ) : null}

          {/* Navigation Items */}
          <NavItem
            icon={<Play className="h-4 w-4" />}
            label="Start Interactive Tour"
            onClick={() => handleAction(onStartTour)}
            delay={0}
          />
          
          <NavItem
            icon={<Keyboard className="h-4 w-4" />}
            label="Keyboard Shortcuts"
            onClick={() => handleAction(onOpenShortcuts)}
            delay={1}
          />
          
          <NavItem
            icon={<Trophy className="h-4 w-4" />}
            label="Achievements"
            href="/achievements"
            delay={2}
          />
          
          <NavItem
            icon={<Github className="h-4 w-4" />}
            label="View on GitHub"
            href="https://github.com/muriukiian/rdbms"
            external
            delay={3}
          />

          <div className="my-2 border-t border-border/30" />

          {/* Theme Toggle */}
          <div 
            className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors animate-in fade-in slide-in-from-right-2 duration-200"
            style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}
          >
            <span className="text-sm font-medium">Theme</span>
            <ThemeToggle />
          </div>

          <div className="my-2 border-t border-border/30" />

          {/* Auth Actions */}
          {isAuthenticated ? (
            <>
              <NavItem
                icon={<User className="h-4 w-4" />}
                label="Profile"
                onClick={() => handleAction(onOpenProfile)}
                delay={5}
              />
              <NavItem
                icon={<LogOut className="h-4 w-4" />}
                label="Sign Out"
                onClick={() => handleAction(onSignOut)}
                variant="destructive"
                delay={6}
              />
            </>
          ) : (
            <NavItem
              icon={<LogIn className="h-4 w-4" />}
              label="Sign In / Sign Up"
              onClick={() => handleAction(onAuth)}
              variant="primary"
              delay={5}
            />
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
  variant?: 'default' | 'primary' | 'destructive';
  delay?: number;
}

function NavItem({ icon, label, onClick, href, external, variant = 'default', delay = 0 }: NavItemProps) {
  const baseClasses = cn(
    "flex items-center gap-3 p-3 rounded-lg transition-all duration-200 animate-in fade-in slide-in-from-right-2",
    variant === 'default' && "hover:bg-muted/50 text-foreground",
    variant === 'primary' && "hover:bg-primary/10 text-primary",
    variant === 'destructive' && "hover:bg-destructive/10 text-destructive"
  );

  const style = { 
    animationDelay: `${delay * 50}ms`, 
    animationFillMode: 'backwards' as const 
  };

  if (href) {
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className={baseClasses}
        style={style}
      >
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </a>
    );
  }

  return (
    <button onClick={onClick} className={cn(baseClasses, "w-full text-left")} style={style}>
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

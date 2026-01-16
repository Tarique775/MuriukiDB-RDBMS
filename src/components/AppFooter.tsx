import { Heart } from 'lucide-react';

export function AppFooter() {
  return (
    <footer className="border-t border-border/30 py-3 glass-card flex-shrink-0">
      <div className="container mx-auto px-4">
        <p className="text-center text-xs font-mono text-muted-foreground flex items-center justify-center gap-1 flex-wrap">
          <span className="text-primary font-bold">Pesapal Junior Dev Challenge '26</span> 
          <span>•</span> 
          Built by{' '}
          <a 
            href="https://samuel-muriuki.vercel.app/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-primary hover:underline font-semibold"
          >
            Samuel-Muriuki
          </a>
          {' '}in collaboration with 
          <Heart className="w-3 h-3 text-destructive inline animate-pulse" />
          <a 
            href="https://lovable.dev/invite/A5KC0U8" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-primary hover:underline"
          >
            Lovable
          </a>
        </p>
      </div>
    </footer>
  );
}

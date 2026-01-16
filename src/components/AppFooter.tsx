import { Heart } from 'lucide-react';

export function AppFooter() {
  return (
    <footer className="border-t border-border/50 p-4 text-center text-xs text-muted-foreground">
      <div className="flex items-center justify-center gap-1 flex-wrap">
        <span>Pesapal Junior Dev Challenge '26</span>
        <span>•</span>
        <span>Built by</span>
        <a 
          href="https://samuel-muriuki.vercel.app/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:underline font-medium"
        >
          Samuel-Muriuki
        </a>
        <span>in collaboration with</span>
        <a 
          href="https://lovable.dev/invite/A5KC0U8" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:underline font-medium inline-flex items-center gap-1"
        >
          Lovable <Heart className="h-3 w-3 text-red-500 fill-red-500" />
        </a>
      </div>
    </footer>
  );
}

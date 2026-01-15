import { useState, useEffect, useRef } from 'react';

interface UserInfo {
  fingerprint: string;
  isReturning: boolean;
  visitCount: number;
  firstVisit: string;
  lastVisit: string;
  browser: string;
  os: string;
  device: string;
}

function getBrowserInfo(): { browser: string; os: string; device: string } {
  const ua = navigator.userAgent;
  
  // Browser detection
  let browser = 'Unknown';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Opera')) browser = 'Opera';
  
  // OS detection
  let os = 'Unknown';
  if (ua.includes('Windows')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Linux')) os = 'Linux';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  
  // Device detection
  let device = 'Desktop';
  if (ua.includes('Mobile')) device = 'Mobile';
  else if (ua.includes('Tablet') || ua.includes('iPad')) device = 'Tablet';
  
  return { browser, os, device };
}

function generateFingerprint(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('MuriukiDB fingerprint', 2, 2);
  }
  
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 'unknown',
    canvas.toDataURL(),
  ];
  
  // Simple hash function
  let hash = 0;
  const str = components.join('|');
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return Math.abs(hash).toString(36);
}

// Session key for tracking visits within a single browser session
const SESSION_KEY = 'muriukidb-session-id';

function getOrCreateSessionId(): string {
  // Use sessionStorage to track the current session
  let sessionId = sessionStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = Date.now().toString(36) + Math.random().toString(36).slice(2);
    sessionStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

export function useUserFingerprint() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const hasInitialized = useRef(false);

  useEffect(() => {
    // Prevent double initialization in StrictMode
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const fingerprint = generateFingerprint();
    const storageKey = 'muriukidb-user-info';
    const stored = localStorage.getItem(storageKey);
    const { browser, os, device } = getBrowserInfo();
    const now = new Date().toISOString();
    
    // Get or create session ID - visits only increment once per session
    const currentSessionId = getOrCreateSessionId();
    
    let info: UserInfo;
    
    if (stored) {
      const parsed = JSON.parse(stored);
      const lastSessionId = parsed.lastSessionId || '';
      
      // Only increment visit count if this is a new session
      const isNewSession = currentSessionId !== lastSessionId;
      
      info = {
        fingerprint,
        isReturning: true,
        visitCount: isNewSession ? parsed.visitCount + 1 : parsed.visitCount,
        firstVisit: parsed.firstVisit,
        lastVisit: now,
        browser,
        os,
        device,
      };
      
      // Store with session ID to track session
      localStorage.setItem(storageKey, JSON.stringify({
        ...info,
        lastSessionId: currentSessionId,
      }));
    } else {
      info = {
        fingerprint,
        isReturning: false,
        visitCount: 1,
        firstVisit: now,
        lastVisit: now,
        browser,
        os,
        device,
      };
      
      localStorage.setItem(storageKey, JSON.stringify({
        ...info,
        lastSessionId: currentSessionId,
      }));
    }
    
    setUserInfo(info);
    setLoading(false);
  }, []);

  return { userInfo, loading };
}

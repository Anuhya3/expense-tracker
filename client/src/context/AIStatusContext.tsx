import { createContext, useContext, useEffect, useState } from 'react';
import { AIStatus } from '../types';

interface AIStatusContextValue {
  status: AIStatus | null;
  loading: boolean;
}

const AIStatusContext = createContext<AIStatusContextValue>({ status: null, loading: true });

export function AIStatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ai/status')
      .then(r => r.json())
      .then(setStatus)
      .catch(() => setStatus({ available: false, mode: 'demo' }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AIStatusContext.Provider value={{ status, loading }}>
      {children}
    </AIStatusContext.Provider>
  );
}

export function useAIStatus() {
  return useContext(AIStatusContext);
}

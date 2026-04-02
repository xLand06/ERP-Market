import { useEffect, useRef } from 'react';

export const useBarcodeScanner = (onScan: (code: string) => void) => {
  const buffer = useRef('');
  const lastKeyTime = useRef(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el usuario está escribiendo manualmente en un input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const now = Date.now();
      
      // Si pasa mucho tiempo entre teclas, el buffer se limpia (humano tecleando lento)
      if (now - lastKeyTime.current > 50) {
        buffer.current = '';
      }

      if (e.key === 'Enter') {
        if (buffer.current.length > 2) {
          onScan(buffer.current);
        }
        buffer.current = '';
      } else if (e.key.length === 1) {
        buffer.current += e.key;
      }
      
      lastKeyTime.current = now;
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan]);
};
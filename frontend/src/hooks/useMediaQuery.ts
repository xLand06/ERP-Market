import { useEffect, useState } from 'react';

/**
 * Reactively tracks a CSS media query through `window.matchMedia`.
 *
 * - Listens to the `change` event of the MediaQueryList, which fires whenever
 *   the viewport crosses the query boundary (including resizes).
 * - Falls back to `false` when `matchMedia` is unavailable (SSR, jsdom
 *   without a matchMedia mock), so callers default to the desktop layout.
 */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState<boolean>(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return false;
        }
        return window.matchMedia(query).matches;
    });

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return;
        }

        const mql = window.matchMedia(query);
        const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);

        mql.addEventListener('change', handleChange);
        return () => mql.removeEventListener('change', handleChange);
    }, [query]);

    return matches;
}
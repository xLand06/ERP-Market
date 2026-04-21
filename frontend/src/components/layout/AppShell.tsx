import { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { cn } from '@/lib/utils';
import { useConfigStore } from '@/hooks/useConfigStore';
import { useSyncStore } from '@/services/sync.service';

export function AppShellLayout() {
    const { fetchRates } = useConfigStore();
    const navigate = useNavigate();
    // Initial state based on window width to avoid flashes on load
    const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768);
    const location = useLocation();

    // Keyboard Shortcuts Logic
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Ignorar si el usuario está escribiendo en un input, textarea o contentEditable
        const target = e.target as HTMLElement;
        const isTyping = 
            target.tagName === 'INPUT' || 
            target.tagName === 'TEXTAREA' || 
            target.isContentEditable;

        if (isTyping) return;

        const key = e.key.toUpperCase();
        const paths: Record<string, string> = {
            'V': '/pos',
            'P': '/products',
            'I': '/inventory',
            'F': '/finance',
            'C': '/settings'
        };

        if (paths[key]) {
            e.preventDefault();
            navigate(paths[key]);
        }
    }, [navigate]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Initial fetch of configuration
    useEffect(() => {
        fetchRates();
        const { checkConnection } = useSyncStore.getState();
        checkConnection();
        const interval = setInterval(checkConnection, 30000);
        return () => clearInterval(interval);
    }, [fetchRates]);

    // Close sidebar on mobile when navigating
    useEffect(() => {
        if (window.innerWidth < 768) {
            setCollapsed(true);
        }
    }, [location.pathname]);

    // Handle window resize dynamically
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setCollapsed(true);
            } else {
                setCollapsed(false);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <div className="flex h-dvh overflow-hidden bg-[#F8FAFC]">
            {/* Mobile Overlay */}
            {!collapsed && (
                <div 
                    className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
                    onClick={() => setCollapsed(true)}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed left-0 top-0 h-dvh z-50 bg-slate-900 flex flex-col transition-all duration-300 ease-in-out shadow-2xl md:shadow-[4px_0_24px_-12px_rgba(0,0,0,0.5)] border-r border-slate-800',
                    collapsed ? '-translate-x-full md:translate-x-0 md:w-20' : 'translate-x-0 w-65'
                )}
            >
                <div className="flex-1 w-full h-full overflow-hidden">
                    <Sidebar 
                        collapsed={collapsed} 
                        onCloseMobile={() => setCollapsed(true)} 
                        onToggleDesktop={() => setCollapsed(!collapsed)} 
                    />
                </div>
            </aside>

            {/* Main Content Area */}
            <div
                className={cn(
                    'flex flex-col flex-1 min-w-0 transition-all duration-300 ease-in-out',
                    collapsed ? 'md:ml-20' : 'md:ml-65' // Always 0 on mobile implicitly
                )}
            >
                {/* Topbar – Fixed */}
                <div
                    className={cn(
                        'fixed top-0 right-0 z-30 transition-all duration-300 ease-in-out',
                        collapsed ? 'left-0 md:left-20' : 'left-0 md:left-65'
                    )}
                >
                    <TopBar onToggleSidebar={() => setCollapsed(!collapsed)} collapsed={collapsed} />
                </div>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto mt-16 p-4 md:p-6 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

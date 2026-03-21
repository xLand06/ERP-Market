import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { cn } from '@/lib/utils';

export function AppShellLayout() {
    // Initial state based on window width to avoid flashes on load
    const [collapsed, setCollapsed] = useState(() => window.innerWidth < 768);
    const location = useLocation();

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
                    'fixed left-0 top-0 h-dvh z-50 bg-[#0F172A] flex flex-col transition-all duration-300 ease-in-out shadow-2xl md:shadow-none',
                    collapsed ? '-translate-x-full md:translate-x-0 md:w-16' : 'translate-x-0 w-[260px] md:w-60'
                )}
            >
                <div className={cn('flex-1 overflow-y-auto overflow-x-hidden pt-4 md:pt-16', collapsed ? 'px-2 py-2' : 'px-3 py-2')}>
                    <Sidebar collapsed={collapsed} onCloseMobile={() => setCollapsed(true)} />
                </div>
            </aside>

            {/* Main Content Area */}
            <div
                className={cn(
                    'flex flex-col flex-1 min-w-0 transition-all duration-300 ease-in-out',
                    collapsed ? 'md:ml-16' : 'md:ml-60' // Always 0 on mobile implicitly
                )}
            >
                {/* Topbar – Fixed */}
                <div
                    className={cn(
                        'fixed top-0 right-0 z-30 transition-all duration-300 ease-in-out',
                        collapsed ? 'left-0 md:left-16' : 'left-0 md:left-60'
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

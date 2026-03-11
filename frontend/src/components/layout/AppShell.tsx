import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { cn } from '@/lib/utils';

export function AppShellLayout() {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="flex h-dvh overflow-hidden bg-[#F8FAFC]">
            {/* Sidebar */}
            <aside
                className={cn(
                    'fixed left-0 top-0 h-dvh z-40 bg-[#0F172A] flex flex-col transition-all duration-200 overflow-hidden',
                    collapsed ? 'w-16' : 'w-60'
                )}
            >
                {/* Collapse toggle */}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={cn(
                        'absolute top-[76px] -right-3 z-50 w-6 h-6 rounded-full bg-slate-700 border-2 border-[#0F172A]',
                        'flex items-center justify-center hover:bg-slate-600 transition-colors'
                    )}
                    aria-label={collapsed ? 'Expandir' : 'Colapsar'}
                >
                    <svg
                        className={cn('w-2.5 h-2.5 text-slate-400 transition-transform duration-200', collapsed ? 'rotate-180' : '')}
                        viewBox="0 0 10 10" fill="none"
                    >
                        <path d="M6 2L3 5L6 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>

                <div className={cn('flex-1 overflow-y-auto overflow-x-hidden pt-16', collapsed ? 'px-2 py-2' : 'px-3 py-2')}>
                    <Sidebar collapsed={collapsed} />
                </div>
            </aside>

            {/* Main */}
            <div
                className={cn(
                    'flex flex-col flex-1 min-w-0 transition-all duration-200',
                    collapsed ? 'ml-16' : 'ml-60'
                )}
            >
                {/* Topbar – fixed */}
                <div
                    className={cn(
                        'fixed top-0 right-0 z-30 transition-all duration-200',
                        collapsed ? 'left-16' : 'left-60'
                    )}
                >
                    <TopBar />
                </div>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto mt-16 p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

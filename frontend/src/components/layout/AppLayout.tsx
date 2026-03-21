import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppLayout() {
    return (
        <div className="flex h-[100dvh] w-full bg-slate-50 overflow-hidden font-sans text-slate-900">
            <Sidebar />
            <div className="flex-1 flex flex-col h-full min-w-0">
                <TopBar />
                <main className="flex-1 overflow-y-auto w-full p-6 md:p-8 isolate">
                    <div className="max-w-[1600px] mx-auto w-full">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}

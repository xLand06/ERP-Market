import { AppShell, Burger, Group, Text, useMantineColorScheme } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShellLayout() {
    const [opened, { toggle }] = useDisclosure();

    return (
        <AppShell
            navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
            header={{ height: 60 }}
            padding="md"
        >
            <AppShell.Header>
                <TopBar opened={opened} toggle={toggle} />
            </AppShell.Header>

            <AppShell.Navbar p="md">
                <Sidebar />
            </AppShell.Navbar>

            <AppShell.Main>
                <Outlet />
            </AppShell.Main>
        </AppShell>
    );
}

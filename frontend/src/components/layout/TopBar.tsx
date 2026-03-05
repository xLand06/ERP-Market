import { Group, Burger, Text, ActionIcon, useMantineColorScheme } from '@mantine/core';
import { IconSun, IconMoon } from '@tabler/icons-react';

interface TopBarProps {
    opened: boolean;
    toggle: () => void;
}

export function TopBar({ opened, toggle }: TopBarProps) {
    const { colorScheme, toggleColorScheme } = useMantineColorScheme();

    return (
        <Group h="100%" px="md" justify="space-between">
            <Group>
                <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
                <Text fw={700} size="lg">🍷 ERP-Market Bodegón</Text>
            </Group>
            <ActionIcon onClick={() => toggleColorScheme()} variant="subtle" size="lg">
                {colorScheme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
            </ActionIcon>
        </Group>
    );
}

import { MantineThemeOverride } from '@mantine/core';

export const theme: MantineThemeOverride = {
    primaryColor: 'violet',
    fontFamily: 'Inter, sans-serif',
    defaultRadius: 'md',
    focusRing: 'auto',
    colors: {
        // Custom amber accent for Bodegón warm brand feel
        bodegon: ['#fff8e1', '#ffecb3', '#ffe082', '#ffd54f', '#ffca28', '#ffc107', '#ffb300', '#ffa000', '#ff8f00', '#ff6f00'],
    },
};

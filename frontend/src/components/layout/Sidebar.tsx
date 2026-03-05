import { NavLink, Stack, Text, Group } from '@mantine/core';
import {
    IconDashboard, IconPackage, IconShoppingCart, IconReceipt,
    IconCashRegister, IconReportAnalytics, IconUsers, IconBuildingStore,
    IconTruck, IconTag,
} from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';

const navItems = [
    { label: 'Dashboard', icon: IconDashboard, href: '/dashboard' },
    { label: 'Inventario', icon: IconPackage, href: '/inventory' },
    { label: 'Lotes', icon: IconTag, href: '/inventory/batches' },
    { label: 'Productos', icon: IconBuildingStore, href: '/products' },
    { label: 'Proveedores', icon: IconTruck, href: '/suppliers' },
    { label: 'Punto de Venta', icon: IconShoppingCart, href: '/pos' },
    { label: 'Ventas', icon: IconReceipt, href: '/sales' },
    { label: 'Finanzas', icon: IconCashRegister, href: '/finance' },
    { label: 'Reportes', icon: IconReportAnalytics, href: '/reports' },
    { label: 'Usuarios', icon: IconUsers, href: '/users' },
];

export function Sidebar() {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <Stack gap="xs">
            <Text fw={700} size="sm" c="dimmed" mb="xs">🍷 BODEGÓN ERP</Text>
            {navItems.map((item) => (
                <NavLink
                    key={item.href}
                    label={item.label}
                    leftSection={<item.icon size={18} />}
                    active={location.pathname === item.href}
                    onClick={() => navigate(item.href)}
                />
            ))}
        </Stack>
    );
}

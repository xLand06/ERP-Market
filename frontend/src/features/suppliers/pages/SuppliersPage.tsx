import { Title, Card, Text, Group, Button } from '@mantine/core';

export default function SuppliersPage() {
    return (
        <div>
            <Group justify="space-between" mb="md">
                <Title order={2}>Proveedores</Title>
                <Button>Nuevo Proveedor</Button>
            </Group>
            <Card shadow="sm" p="lg" radius="md" withBorder>
                <Text c="dimmed">Agenda de proveedores, historial de pedidos, etc...</Text>
            </Card>
        </div>
    );
}

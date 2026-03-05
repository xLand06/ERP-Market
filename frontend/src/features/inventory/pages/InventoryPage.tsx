import { Title, Card, Text, Group, Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

export default function InventoryPage() {
    return (
        <div>
            <Group justify="space-between" mb="md">
                <Title order={2}>Inventario</Title>
                <Button leftSection={<IconPlus size={16} />}>Ajuste de Stock</Button>
            </Group>
            <Card shadow="sm" p="lg" radius="md" withBorder>
                <Text c="dimmed">Tabla de inventario general aquí...</Text>
            </Card>
        </div>
    );
}

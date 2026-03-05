import { Title, Card, Text, Group, Button } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';

export default function ProductsPage() {
    return (
        <div>
            <Group justify="space-between" mb="md">
                <Title order={2}>Productos</Title>
                <Button leftSection={<IconPlus size={16} />}>Nuevo Producto</Button>
            </Group>
            <Card shadow="sm" p="lg" radius="md" withBorder>
                <Text c="dimmed">Catálogo de productos, maestro de artículos, etc...</Text>
            </Card>
        </div>
    );
}

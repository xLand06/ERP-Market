import { Title, SimpleGrid, Card, Text } from '@mantine/core';

export default function DashboardPage() {
    return (
        <div>
            <Title order={2} mb="md">Dashboard</Title>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
                <Card shadow="sm" p="lg" radius="md" withBorder>
                    <Text size="sm" c="dimmed">Ventas de Hoy</Text>
                    <Text fw={700} size="xl">$ 1,240.50</Text>
                </Card>
                <Card shadow="sm" p="lg" radius="md" withBorder>
                    <Text size="sm" c="dimmed">Transacciones</Text>
                    <Text fw={700} size="xl">45</Text>
                </Card>
                <Card shadow="sm" p="lg" radius="md" withBorder>
                    <Text size="sm" c="dimmed">Lotes por Vencer</Text>
                    <Text fw={700} size="xl" c="red">12</Text>
                </Card>
                <Card shadow="sm" p="lg" radius="md" withBorder>
                    <Text size="sm" c="dimmed">Bajo Stock</Text>
                    <Text fw={700} size="xl" c="orange">5</Text>
                </Card>
            </SimpleGrid>
        </div>
    );
}

import { Title, Card, Text, SimpleGrid } from '@mantine/core';

export default function ReportsPage() {
    return (
        <div>
            <Title order={2} mb="md">Reportes y Analíticas</Title>
            <SimpleGrid cols={{ base: 1, md: 2 }} mb="md">
                <Card shadow="sm" p="lg" radius="md" withBorder>
                    <Title order={4}>Cierre de Caja Mensual</Title>
                    <Text c="dimmed" mt="xs">Gráficos de ventas...</Text>
                </Card>
                <Card shadow="sm" p="lg" radius="md" withBorder>
                    <Title order={4}>Productos más Vendidos</Title>
                    <Text c="dimmed" mt="xs">Ranking y proporciones...</Text>
                </Card>
            </SimpleGrid>
            <Card shadow="sm" p="lg" radius="md" withBorder>
                <Title order={4}>Reportes de Inventario y Mermas</Title>
                <Text c="dimmed" mt="xs">Pérdidas por caducidad (Bodegón)...</Text>
            </Card>
        </div>
    );
}

import { Title, Card, Text } from '@mantine/core';

export default function SalesHistoryPage() {
    return (
        <div>
            <Title order={2} mb="md">Historial de Ventas</Title>
            <Card shadow="sm" p="lg" radius="md" withBorder>
                <Text c="dimmed">Listado de tickets/facturas, filtros por fecha y cajero...</Text>
            </Card>
        </div>
    );
}

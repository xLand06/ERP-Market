import { Title, Card, Text } from '@mantine/core';

export default function BatchesPage() {
    return (
        <div>
            <Title order={2} mb="md">Control de Lotes y Vencimientos</Title>
            <Card shadow="sm" p="lg" radius="md" withBorder>
                <Text c="dimmed">Tabla de lotes (FEFO) aquí...</Text>
            </Card>
        </div>
    );
}

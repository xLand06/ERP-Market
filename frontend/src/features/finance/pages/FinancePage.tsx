import { Title, Card, Text, SimpleGrid } from '@mantine/core';

export default function FinancePage() {
    return (
        <div>
            <Title order={2} mb="md">Flujo de Caja y Finanzas</Title>
            <SimpleGrid cols={{ base: 1, md: 2 }} mb="md">
                <Card shadow="sm" p="lg" radius="md" withBorder>
                    <Title order={4}>Cuentas por Cobrar</Title>
                    <Text c="dimmed" mt="xs">Listado AR...</Text>
                </Card>
                <Card shadow="sm" p="lg" radius="md" withBorder>
                    <Title order={4}>Cuentas por Pagar</Title>
                    <Text c="dimmed" mt="xs">Listado AP (Proveedores)...</Text>
                </Card>
            </SimpleGrid>
            <Card shadow="sm" p="lg" radius="md" withBorder>
                <Title order={4}>Movimientos (Ingresos/Egresos)</Title>
                <Text c="dimmed" mt="xs">Tabla de movimientos manuales...</Text>
            </Card>
        </div>
    );
}

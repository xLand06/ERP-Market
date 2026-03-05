import { Title, Card, Text, Group, Button } from '@mantine/core';

export default function CashRegisterPage() {
    return (
        <div>
            <Group justify="space-between" mb="md">
                <Title order={2}>Control de Caja</Title>
                <Button color="green">Abrir Turno</Button>
            </Group>
            <Card shadow="sm" p="lg" radius="md" withBorder>
                <Text c="dimmed">Turnos de caja (Apertura, Cierres, Arqueo)...</Text>
            </Card>
        </div>
    );
}

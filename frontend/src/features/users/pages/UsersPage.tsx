import { Title, Card, Text, Group, Button } from '@mantine/core';

export default function UsersPage() {
    return (
        <div>
            <Group justify="space-between" mb="md">
                <Title order={2}>Gestión de Usuarios</Title>
                <Button>Nuevo Usuario</Button>
            </Group>
            <Card shadow="sm" p="lg" radius="md" withBorder>
                <Text c="dimmed">Lista de usuarios, roles (Admin, Cajero, Almacenista), y permisos...</Text>
            </Card>
        </div>
    );
}

import { Title, Card, Text, Group, Button } from '@mantine/core';

export default function CategoriesPage() {
    return (
        <div>
            <Group justify="space-between" mb="md">
                <Title order={2}>Categorías y Marcas</Title>
                <Button>Nueva Categoría</Button>
            </Group>
            <Card shadow="sm" p="lg" radius="md" withBorder>
                <Text c="dimmed">Gestión de categorías (Ej: Licores, Víveres, Charcutería)...</Text>
            </Card>
        </div>
    );
}

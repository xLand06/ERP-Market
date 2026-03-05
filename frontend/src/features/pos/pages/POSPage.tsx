import { Title, Grid, Card, Text, Button, Stack } from '@mantine/core';

export default function POSPage() {
    return (
        <Grid>
            <Grid.Col span={{ base: 12, md: 8 }}>
                <Title order={2} mb="md">Punto de Venta (POS)</Title>
                <Card shadow="sm" p="lg" radius="md" withBorder h={500}>
                    <Text c="dimmed">Grilla de productos y buscador por código de barras aquí...</Text>
                </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
                <Card shadow="sm" p="lg" radius="md" withBorder h={500}>
                    <Title order={4} mb="md">Carrito</Title>
                    <Stack justify="space-between" h="100%">
                        <Text c="dimmed">Items del carrito...</Text>
                        <div>
                            <Text size="xl" fw={700} ta="right" mb="md">Total: $ 0.00</Text>
                            <Button fullWidth size="lg" color="green">Cobrar (F12)</Button>
                        </div>
                    </Stack>
                </Card>
            </Grid.Col>
        </Grid>
    );
}

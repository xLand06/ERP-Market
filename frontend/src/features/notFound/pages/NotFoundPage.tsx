import { Container, Title, Text, Button, Center, Stack } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
    const navigate = useNavigate();
    return (
        <Container size="sm" h="100vh">
            <Center h="100%">
                <Stack align="center" gap="md">
                    <Title order={1} size={80}>404</Title>
                    <Title order={2}>Página no encontrada</Title>
                    <Text c="dimmed" ta="center">
                        La ruta a la que intentas acceder no existe en el sistema.
                    </Text>
                    <Button onClick={() => navigate('/')} size="md" mt="xl">
                        Volver al Dashboard
                    </Button>
                </Stack>
            </Center>
        </Container>
    );
}

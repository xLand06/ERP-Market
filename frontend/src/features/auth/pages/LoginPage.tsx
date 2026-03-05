import { Container, Paper, Title, TextInput, PasswordInput, Button, Stack } from '@mantine/core';

export default function LoginPage() {
    return (
        <Container size={420} my={40}>
            <Title ta="center" order={2}>Bienvenido a ERP-Market Bodegón 🍷</Title>
            <Paper withBorder shadow="md" p={30} mt={30} radius="md">
                <Stack>
                    <TextInput label="Email" placeholder="tu@email.com" required />
                    <PasswordInput label="Contraseña" placeholder="Tu contraseña" required mt="md" />
                    <Button fullWidth mt="xl" color="bodegon.7">Entrar</Button>
                </Stack>
            </Paper>
        </Container>
    );
}

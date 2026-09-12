export const env = {
    PORT: parseInt(process.env.PORT || '3001'),
    JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    DATABASE_URL: process.env.DATABASE_URL!,
    DOCKER_SOCKET: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
    NODE_ENV: process.env.NODE_ENV || 'development',
    BILLING_SECRET: process.env.BILLING_SECRET || process.env.JWT_SECRET || 'dev-secret-change-in-production',
};

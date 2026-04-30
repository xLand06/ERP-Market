import app from './app';
import { env } from './config/env';
import logger from './core/utils/logger';

const PORT = env.PORT || 3000;

let server: ReturnType<typeof app.listen>;

const gracefulShutdown = (signal: string) => {
    logger.info(`[Server] Received ${signal}, starting graceful shutdown...`);
    
    if (server) {
        server.close(async () => {
            logger.info('[Server] HTTP server closed');
            
            try {
                const { getLocalPrisma } = await import('./config/prisma');
                await getLocalPrisma().$disconnect();
                logger.info('[Server] Database connections closed');
            } catch (err: unknown) {
                const error = err as Error;
                logger.error('[Server] Error closing database', { error: error.message });
            }
            
            process.exit(0);
        });
    }
    
    setTimeout(() => {
        logger.error('[Server] Graceful shutdown timeout, forcing exit');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

server = app.listen(PORT, () => {
    logger.info(`🍷 ERP-Market server running on port ${PORT}`);
});

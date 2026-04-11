// =============================================================================
// LOGGER — Estructurado para ERP-MARKET
// Niveles: debug, info, warn, error
// =============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
    module?: string;
    userId?: string;
    requestId?: string;
    [key: string]: unknown;
}

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    context?: LogContext;
}

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

const currentLevel = (): LogLevel => {
    const env = process.env.LOG_LEVEL?.toLowerCase();
    if (env === 'debug' || env === 'info' || env === 'warn' || env === 'error') {
        return env;
    }
    return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
};

const shouldLog = (level: LogLevel): boolean => {
    return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel()];
};

const formatLog = (entry: LogEntry): string => {
    const base = {
        level: entry.level.toUpperCase(),
        time: entry.timestamp,
        msg: entry.message,
    };
    return JSON.stringify(entry.context ? { ...base, ...entry.context } : base);
};

const log = (level: LogLevel, message: string, context?: LogContext): void => {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
        level,
        message,
        timestamp: new Date().toISOString(),
        context,
    };

    const formatted = formatLog(entry);

    switch (level) {
        case 'error':
            console.error(formatted);
            break;
        case 'warn':
            console.warn(formatted);
            break;
        case 'info':
            console.log(formatted);
            break;
        case 'debug':
            console.log(formatted);
            break;
    }
};

export const logger = {
    debug: (message: string, context?: LogContext) => log('debug', message, context),
    info: (message: string, context?: LogContext) => log('info', message, context),
    warn: (message: string, context?: LogContext) => log('warn', message, context),
    error: (message: string, context?: LogContext) => log('error', message, context),

    // Helper para requests HTTP
    http: (req: { method: string; url: string; ip?: string }, context?: LogContext) => {
        log('info', `${req.method} ${req.url}`, {
            ...context,
            ip: req.ip,
        });
    },

    // Helper para errores con stack
    errorWithStack: (message: string, error: Error, context?: LogContext) => {
        log('error', message, {
            ...context,
            error: {
                name: error.name,
                message: error.message,
                stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined,
            },
        });
    },
};

export default logger;
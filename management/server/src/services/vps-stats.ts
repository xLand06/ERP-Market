import { execSync } from 'child_process';

// Cache de resultados — se refresca cada 10 segundos
interface VpsStats {
    cpu: { cores: number; usagePercent: number };
    memory: { totalMb: number; usedMb: number; freeMb: number; usagePercent: number };
    disk: { totalGb: number; usedGb: number; freeGb: number; usagePercent: number };
    docker: { containers: number; running: number; stopped: number };
    uptime: string;
}

let cache: VpsStats | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 10_000;

/**
 * Ejecuta un comando del sistema de forma segura.
 * Devuelve string vacío si falla para no romper el endpoint.
 */
function safeExec(cmd: string): string {
    try {
        return execSync(cmd, { encoding: 'utf-8', timeout: 5000 }).trim();
    } catch {
        return '';
    }
}

/**
 * Parsea la salida de `free -m` para obtener datos de memoria.
 */
function parseFreeOutput(output: string): { totalMb: number; usedMb: number; freeMb: number; usagePercent: number } {
    if (!output) {
        return { totalMb: 0, usedMb: 0, freeMb: 0, usagePercent: 0 };
    }
    const lines = output.split('\n');
    const memLine = lines.find((l) => l.startsWith('Mem:'));
    if (!memLine) {
        return { totalMb: 0, usedMb: 0, freeMb: 0, usagePercent: 0 };
    }
    const parts = memLine.split(/\s+/);
    const totalMb = parseInt(parts[1], 10) || 0;
    const usedMb = parseInt(parts[2], 10) || 0;
    const freeMb = parseInt(parts[3], 10) || 0;
    const usagePercent = totalMb > 0 ? Math.round((usedMb / totalMb) * 1000) / 10 : 0;
    return { totalMb, usedMb, freeMb, usagePercent };
}

/**
 * Parsea la salida de `df -h /` para obtener datos de disco.
 */
function parseDfOutput(output: string): { totalGb: number; usedGb: number; freeGb: number; usagePercent: number } {
    if (!output) {
        return { totalGb: 0, usedGb: 0, freeGb: 0, usagePercent: 0 };
    }
    const lines = output.split('\n');
    const dataLine = lines[1];
    if (!dataLine) {
        return { totalGb: 0, usedGb: 0, freeGb: 0, usagePercent: 0 };
    }
    const parts = dataLine.split(/\s+/);
    const parseSize = (s: string): number => {
        const num = parseFloat(s);
        if (isNaN(num)) return 0;
        if (s.endsWith('T')) return num * 1024;
        if (s.endsWith('G')) return num;
        if (s.endsWith('M')) return num / 1024;
        if (s.endsWith('K')) return num / (1024 * 1024);
        return num;
    };
    const totalGb = Math.round(parseSize(parts[1]) * 10) / 10;
    const usedGb = Math.round(parseSize(parts[2]) * 10) / 10;
    const freeGb = Math.round(parseSize(parts[3]) * 10) / 10;
    const usagePercent = parseFloat(parts[4]) || 0;
    return { totalGb, usedGb, freeGb, usagePercent };
}

/**
 * Obtiene estadísticas del VPS con cache de 10 segundos.
 * Usa comandos del sistema: free, df, nproc, docker, uptime.
 */
export function getVpsStats(): VpsStats {
    const now = Date.now();
    if (cache && now - cacheTimestamp < CACHE_TTL_MS) {
        return cache;
    }

    // CPU cores
    const coresOutput = safeExec('nproc');
    const cores = parseInt(coresOutput, 10) || 2;

    // CPU usage — promedio de 1 segundo
    const cpuUsageOutput = safeExec("top -bn1 | grep 'Cpu(s)' | awk '{print $2}'");
    const usagePercent = parseFloat(cpuUsageOutput) || 0;

    // Memoria
    const mem = parseFreeOutput(safeExec('free -m'));

    // Disco
    const disk = parseDfOutput(safeExec('df -h /'));

    // Docker containers
    const running = parseInt(safeExec('docker ps -q | wc -l'), 10) || 0;
    const allContainers = parseInt(safeExec('docker ps -aq | wc -l'), 10) || 0;
    const stopped = Math.max(0, allContainers - running);

    // Uptime
    const uptime = safeExec('uptime -p') || 'No disponible';

    cache = {
        cpu: { cores, usagePercent },
        memory: mem,
        disk,
        docker: { containers: allContainers, running, stopped },
        uptime,
    };
    cacheTimestamp = now;

    return cache;
}

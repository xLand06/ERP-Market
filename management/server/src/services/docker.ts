import Dockerode from 'dockerode';
import { env } from '../config/env';

// Cliente Docker conectado al socket del host
const docker = new Dockerode({ socketPath: env.DOCKER_SOCKET });

export interface ContainerInfo {
    id: string;
    name: string;
    image: string;
    state: string;
    status: string;
    ports: string;
    composeProject?: string;
}

export interface ContainerStats {
    cpuUsage: number;
    memoryUsage: number;
    memoryLimit: number;
    networkRx: number;
    networkTx: number;
}

/**
 * Lista contenedores filtrados por proyecto de Docker Compose.
 */
export async function listContainers(composeProject?: string): Promise<ContainerInfo[]> {
    const filters: any = {};

    if (composeProject) {
        filters.label = [`com.docker.compose.project=${composeProject}`];
    }

    const containers = await docker.listContainers({ all: true, filters });

    return containers.map((c) => ({
        id: c.Id.substring(0, 12),
        name: c.Names[0]?.replace(/^\//, '') || '',
        image: c.Image,
        state: c.State,
        status: c.Status,
        ports: c.Ports.map((p) => `${p.PrivatePort}/${p.Type}`).join(', '),
        composeProject: c.Labels['com.docker.compose.project'],
    }));
}

/**
 * Obtiene métricas de un contenedor específico.
 */
export async function getContainerStats(containerId: string): Promise<ContainerStats> {
    const container = docker.getContainer(containerId);
    const stats = await container.stats({ stream: false });

    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - (stats.precpu_stats.cpu_usage?.total_usage || 0);
    const systemDelta = stats.cpu_stats.system_cpu_usage - (stats.precpu_stats.system_cpu_usage || 0);
    const cpuCount = stats.cpu_stats.online_cpus || 1;

    return {
        cpuUsage: systemDelta > 0 ? (cpuDelta / systemDelta) * cpuCount * 100 : 0,
        memoryUsage: stats.memory_stats.usage || 0,
        memoryLimit: stats.memory_stats.limit || 0,
        networkRx: stats.networks?.eth0?.rx_bytes || 0,
        networkTx: stats.networks?.eth0?.tx_bytes || 0,
    };
}

/**
 * Inspecciona detalles de un contenedor.
 */
export async function inspectContainer(containerId: string) {
    const container = docker.getContainer(containerId);
    return container.inspect();
}

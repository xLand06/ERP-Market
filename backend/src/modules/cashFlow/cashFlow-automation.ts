import { logger } from '../../core/utils/logger';
import { getSettings } from '../settings/settings.service';
import { prisma } from '../../config/prisma';
import * as cashFlowService from './cashFlow.service';

let automationInterval: NodeJS.Timeout | null = null;
let lastProcessedMinute: string | null = null;

/**
 * Ciclo de automatización de cajas.
 * Revisa cada minuto si la hora actual coincide con las configuraciones de apertura/cierre.
 */
export async function runAutomationCycle() {
    const now = new Date();
    // Formato HH:mm para comparar con los settings
    const currentHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Evitar procesar el mismo minuto varias veces si el worker corre más de una vez por minuto
    if (lastProcessedMinute === currentHHmm) return;
    lastProcessedMinute = currentHHmm;

    const settings = getSettings();
    const { autoCloseTime } = settings;

    // Si no hay cierre configurado, no hacemos nada
    if (!autoCloseTime) return;

    try {
        // Obtenemos todas las sedes activas
        const branches = await prisma.branch.findMany({ where: { isActive: true } });
        
        for (const branch of branches) {
            // 1. CIERRE AUTOMÁTICO
            if (autoCloseTime === currentHHmm) {
                const openRegister = await cashFlowService.getCurrentOpenRegister(branch.id);
                if (openRegister) {
                    logger.info(`[Automation] 🔒 Iniciando CIERRE automático para sede: ${branch.name}`);
                    
                    try {
                        // Para el cierre automático, usamos el saldo esperado como monto de cierre
                        const openingAmount = Number(openRegister.openingAmount);
                        const transactions = openRegister.transactions || [];
                        let totalIncome = 0;
                        let totalExpense = 0;

                        transactions.forEach((t: any) => {
                            const amt = Number(t.total) || 0;
                            if (t.type === 'SALE' && t.status === 'COMPLETED') totalIncome += amt;
                            else if (t.type === 'ADJUSTMENT' && t.status === 'COMPLETED') {
                                if (amt > 0) totalIncome += amt;
                                else totalExpense += Math.abs(amt);
                            }
                        });

                        const expectedAmount = openingAmount + totalIncome - totalExpense;
                        
                        await cashFlowService.closeCashRegister(
                            openRegister.id,
                            expectedAmount,
                            'Cierre automático programado por el sistema'
                        );
                        logger.info(`[Automation] ✅ Caja cerrada exitosamente para sede: ${branch.name}`);
                    } catch (closeErr: any) {
                        logger.error(`[Automation] ❌ Error al cerrar caja automática (${branch.name}): ${closeErr.message}`);
                    }
                }
            }
        }
    } catch (error: any) {
        logger.error(`[Automation] Error crítico en ciclo de automatización: ${error.message}`);
    }
}

/**
 * Inicia el worker de automatización de flujo de caja.
 * @param intervalMs Frecuencia de chequeo (default 60s)
 */
export function startCashRegisterAutomation(intervalMs: number = 60_000) {
    if (automationInterval) return;

    logger.info(`[Automation] Worker de cajas automáticas activado (Check cada ${intervalMs / 1000}s)`);
    
    // Ejecutar el primer chequeo 5 segundos después del inicio
    setTimeout(runAutomationCycle, 5_000);

    // Configurar intervalo recurrente
    automationInterval = setInterval(runAutomationCycle, intervalMs);
}

/**
 * Detiene el worker.
 */
export function stopCashRegisterAutomation() {
    if (automationInterval) {
        clearInterval(automationInterval);
        automationInterval = null;
        logger.info('[Automation] Worker de cajas automáticas detenido');
    }
}

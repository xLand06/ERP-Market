import { getCloudPrisma } from '../config/prisma';

async function testCloud() {
    const cloud = getCloudPrisma();
    if (!cloud) {
        console.error('❌ Error: No se pudo conectar a Supabase. Revisa tu DATABASE_URL.');
        process.exit(1);
    }

    try {
        console.log('🚀 [Cloud Test] Consultando datos reales de Supabase...');
        
        const [txs, logs, registers] = await Promise.all([
            cloud.transaction.count(),
            cloud.auditLog.count(),
            cloud.cashRegister.count(),
        ]);
        
        const size: any = await cloud.$queryRawUnsafe(
            `SELECT pg_database_size(current_database()) as size_bytes;`
        );
        const sizeBytes = Number(size?.[0]?.size_bytes) || 0;

        console.log('\n===== ESTADÍSTICAS EN LA NUBE =====');
        console.log(`🛒 Ventas totales: ${txs}`);
        console.log(`📑 Sesiones de caja: ${registers}`);
        console.log(`🔍 Logs de auditoría: ${logs}`);
        console.log(`💾 Tamaño físico: ${(sizeBytes / (1024 * 1024)).toFixed(2)} MB (${sizeBytes.toLocaleString()} bytes)`);
        console.log('===================================\n');
    } catch (error) {
        console.error('❌ Error fatal al interactuar con Supabase:', error);
    }
    process.exit(0);
}

testCloud();

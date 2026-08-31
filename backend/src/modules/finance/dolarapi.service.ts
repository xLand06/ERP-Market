// =============================================================================
// DOLARAPI VENEZUELA SERVICE
// Obtención de tasas oficiales (BCV) y paralelas (USD / EUR) desde DolarApi
// =============================================================================

export interface DolarApiRate {
    moneda: string;
    fuente: string;
    nombre: string;
    promedio: number;
    fechaActualizacion: string;
}

export interface DolarApiRatesResult {
    ve_dolar_oficial: number;
    ve_dolar_paralelo: number;
    ve_euro_oficial: number;
    ve_euro_paralelo: number;
    updatedAt: string;
}

export const fetchDolarApiRates = async (): Promise<DolarApiRatesResult> => {
    try {
        const [dolaresRes, eurosRes] = await Promise.all([
            fetch('https://ve.dolarapi.com/v1/dolares'),
            fetch('https://ve.dolarapi.com/v1/euros'),
        ]);

        if (!dolaresRes.ok || !eurosRes.ok) {
            throw new Error('Error al conectar con la API de DolarApi');
        }

        const dolares: DolarApiRate[] = await dolaresRes.json();
        const euros: DolarApiRate[] = await eurosRes.json();

        const dolarOficial = dolares.find(d => d.fuente === 'oficial')?.promedio || 0;
        const dolarParalelo = dolares.find(d => d.fuente === 'paralelo')?.promedio || 0;
        const euroOficial = euros.find(e => e.fuente === 'oficial')?.promedio || 0;
        const euroParalelo = euros.find(e => e.fuente === 'paralelo')?.promedio || 0;

        return {
            ve_dolar_oficial: Number(dolarOficial.toFixed(2)),
            ve_dolar_paralelo: Number(dolarParalelo.toFixed(2)),
            ve_euro_oficial: Number(euroOficial.toFixed(2)),
            ve_euro_paralelo: Number(euroParalelo.toFixed(2)),
            updatedAt: new Date().toISOString(),
        };
    } catch (error: any) {
        console.error('[DolarApi] Error al obtener tasas:', error.message);
        throw error;
    }
};

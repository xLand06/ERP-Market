// =============================================================================
// PUBLIC CATALOG SERVICE — Catálogo público multi-tenant
// Consulta directamente la BD del tenant (db-<slug>:5432) para exponer
// productos, presentaciones, grupos y configuración de tienda.
// =============================================================================

import { Pool } from 'pg';
import { prisma } from '../../config/prisma';

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface CatalogPresentation {
    id: string;
    name: string;
    price: number;
    multiplier: number;
    barcode: string | null;
}

interface CatalogProduct {
    id: string;
    name: string;
    price: number;
    barcode: string | null;
    imageUrl: string | null;
    description: string | null;
    presentations: CatalogPresentation[];
}

interface CatalogGroup {
    id: string;
    name: string;
    products: CatalogProduct[];
}

interface SocialLinks {
    facebook?: string;
    instagram?: string;
    whatsapp?: string;
}

export interface PublicCatalog {
    businessName: string;
    taxId: string | null;
    socialLinks: SocialLinks;
    groups: CatalogGroup[];
}

// ─── Conexión a BD del tenant ────────────────────────────────────────────────
async function connectToTenantDb(slug: string): Promise<Pool> {
    // Lookup tenant en la BD del management
    const tenant = await prisma.tenant.findUnique({
        where: { slug },
        select: { slug: true, dbPassword: true, status: true },
    });

    if (!tenant || tenant.status !== 'ACTIVE') {
        throw new Error('TENANT_NOT_FOUND');
    }

    if (!tenant.dbPassword) {
        throw new Error('TENANT_DB_MISSING');
    }

    // Conexión directa al container db-<slug> en la red Docker
    const pool = new Pool({
        host: `db-${slug}`,
        port: 5432,
        database: 'erp_market',
        user: 'erp',
        password: tenant.dbPassword,
        max: 5,
        connectionTimeoutMillis: 5000,
        idleTimeoutMillis: 10000,
    });

    return pool;
}

// ─── Catálogo público ────────────────────────────────────────────────────────
export const getPublicCatalog = async (slug: string): Promise<PublicCatalog | null> => {
    let pool: Pool | null = null;

    try {
        pool = await connectToTenantDb(slug);

        // 1. Verificar que el catálogo esté activo
        const settingsResult = await pool.query(
            `SELECT key, value FROM system_settings WHERE key IN ('businessName', 'taxId', 'catalogActive', 'catalogSlug', 'socialLinks')`
        );

        const settingsMap = new Map<string, string>();
        for (const row of settingsResult.rows) {
            settingsMap.set(row.key, row.value);
        }

        const catalogActive = settingsMap.get('catalogActive') === 'true';
        const catalogSlug = settingsMap.get('catalogSlug');

        // Si tiene catalogSlug configurado, debe coincidir con el slug de la URL
        if (!catalogActive) {
            return null;
        }
        if (catalogSlug && catalogSlug !== slug) {
            return null;
        }

        // 2. Obtener productos activos con presentaciones
        const productsResult = await pool.query(`
            SELECT
                p.id,
                p.name,
                p.price,
                p.barcode,
                p."imageUrl",
                p.description,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', pp.id,
                            'name', pp.name,
                            'price', pp.price,
                            'multiplier', pp.multiplier,
                            'barcode', pp.barcode
                        )
                        ORDER BY pp.name
                    ) FILTER (WHERE pp.id IS NOT NULL),
                    '[]'
                ) AS presentations
            FROM products p
            LEFT JOIN product_presentations pp ON pp."productId" = p.id
            WHERE p."isActive" = true
            GROUP BY p.id
            ORDER BY p.name ASC
        `);

        // 3. Obtener grupos y subgrupos para agrupar
        const groupsResult = await pool.query(`
            SELECT g.id, g.name, sg.id AS "subGroupId"
            FROM groups g
            LEFT JOIN sub_groups sg ON sg."groupId" = g.id
            ORDER BY g.name ASC
        `);

        // Mapear subgrupos → grupos
        const subGroupToGroup = new Map<string, { id: string; name: string }>();
        for (const row of groupsResult.rows) {
            if (row.subGroupId) {
                subGroupToGroup.set(row.subGroupId, { id: row.id, name: row.name });
            }
        }

        // 4. Obtener subgrupos asignados a productos
        const productSubGroupsResult = await pool.query(`
            SELECT id AS "productId", "subGroupId" FROM products
            WHERE "isActive" = true AND "subGroupId" IS NOT NULL
        `);
        const productSubGroupMap = new Map<string, string>();
        for (const row of productSubGroupsResult.rows) {
            productSubGroupMap.set(row.productId, row.subGroupId);
        }

        // 5. Agrupar productos
        const UNCATEGORIZED = { id: 'otros', name: 'Otros productos' };
        const groupsMap = new Map<string, CatalogGroup>();

        for (const p of productsResult.rows) {
            const subGroupId = productSubGroupMap.get(p.id);
            const group = subGroupId ? subGroupToGroup.get(subGroupId) : null;
            const groupId = group?.id ?? UNCATEGORIZED.id;
            const groupName = group?.name ?? UNCATEGORIZED.name;

            if (!groupsMap.has(groupId)) {
                groupsMap.set(groupId, { id: groupId, name: groupName, products: [] });
            }

            groupsMap.get(groupId)!.products.push({
                id: p.id,
                name: p.name,
                price: Number(p.price),
                barcode: p.barcode ?? null,
                imageUrl: p.imageUrl ?? null,
                description: p.description ?? null,
                presentations: (p.presentations || []).map((pres: any) => ({
                    id: pres.id,
                    name: pres.name,
                    price: Number(pres.price),
                    multiplier: Number(pres.multiplier),
                    barcode: pres.barcode ?? null,
                })),
            });
        }

        const groups = Array.from(groupsMap.values()).filter(g => g.products.length > 0);

        // 6. Social links
        let socialLinks: SocialLinks = {};
        try {
            socialLinks = JSON.parse(settingsMap.get('socialLinks') || '{}');
        } catch {
            socialLinks = {};
        }

        return {
            businessName: settingsMap.get('businessName') || slug,
            taxId: settingsMap.get('taxId') || null,
            socialLinks,
            groups,
        };
    } catch (err: any) {
        if (err.message === 'TENANT_NOT_FOUND' || err.message === 'TENANT_DB_MISSING') {
            return null;
        }
        console.error(`[public-catalog] Error consultando catálogo para ${slug}:`, err.message);
        throw err;
    } finally {
        if (pool) {
            await pool.end();
        }
    }
};

// ─── Lista de tiendas activas (para página de directorio) ────────────────────
export interface TenantSummary {
    slug: string;
    businessName: string;
    product: string;
}

export const listActiveTenants = async (): Promise<TenantSummary[]> => {
    const tenants = await prisma.tenant.findMany({
        where: { status: 'ACTIVE' },
        select: { slug: true, product: true },
        orderBy: { slug: 'asc' },
    });

    const results: TenantSummary[] = [];

    for (const t of tenants) {
        let pool: Pool | null = null;
        try {
            pool = await connectToTenantDb(t.slug);
            const res = await pool.query(
                `SELECT value FROM system_settings WHERE key = 'businessName'`
            );
            const businessName = res.rows[0]?.value || t.slug;
            const catalogActiveRes = await pool.query(
                `SELECT value FROM system_settings WHERE key = 'catalogActive'`
            );
            if (catalogActiveRes.rows[0]?.value === 'true') {
                results.push({ slug: t.slug, businessName, product: t.product || 'market' });
            }
        } catch {
            // Skip tenants with unreachable DB
        } finally {
            if (pool) await pool.end();
        }
    }

    return results;
};

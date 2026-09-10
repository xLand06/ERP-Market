// =============================================================================
// CATALOG SERVICE — Catálogo digital público (F5)
// Expone SOLO datos de venta (nombre, precio, imagen, presentaciones).
// NUNCA expone stock, costos ni datos internos del negocio.
// =============================================================================

import { prisma } from '../../config/prisma';
import { getSettings } from '../settings/settings.service';

export interface CatalogPresentation {
    id: string;
    name: string;
    price: number;
    multiplier: number;
    barcode: string | null;
}

export interface CatalogProduct {
    id: string;
    name: string;
    price: number;
    barcode: string | null;
    imageUrl: string | null;
    description: string | null;
    presentations: CatalogPresentation[];
}

export interface CatalogGroup {
    id: string;
    name: string;
    products: CatalogProduct[];
}

export interface SocialLinks {
    facebook?: string;
    instagram?: string;
    whatsapp?: string;
}

export interface PublicCatalog {
    businessName: string;
    taxId: string;
    socialLinks: SocialLinks;
    groups: CatalogGroup[];
}

// Grupo sintético para productos sin subgrupo asignado
const UNCATEGORIZED_GROUP = { id: 'sin-grupo', name: 'Otros productos' };

/**
 * Obtiene el catálogo público asociado a un slug.
 * Retorna null si el catálogo está desactivado o el slug no coincide
 * (404 en el controller). Decisión MVP: filtro SOLO por isActive=true,
 * sin filtrar por stock — el stock es dato interno y no se expone.
 */
export const getPublicCatalog = async (slug: string): Promise<PublicCatalog | null> => {
    const settings = await getSettings();

    // Catálogo desactivado o slug incorrecto → no existe públicamente
    if (!settings.catalogActive || settings.catalogSlug !== slug) {
        return null;
    }

    const products = await prisma.product.findMany({
        where: { isActive: true },
        include: {
            subGroup: { include: { group: true } },
            presentations: true,
        },
        orderBy: { name: 'asc' },
    });

    // Agrupar por grupo de catálogo; productos sin subgrupo van a "Otros productos"
    const groupsMap = new Map<string, CatalogGroup>();
    for (const p of products) {
        const group = p.subGroup?.group;
        const groupId = group?.id ?? UNCATEGORIZED_GROUP.id;
        const groupName = group?.name ?? UNCATEGORIZED_GROUP.name;

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
            presentations: p.presentations.map(pres => ({
                id: pres.id,
                name: pres.name,
                price: Number(pres.price),
                multiplier: Number(pres.multiplier),
                barcode: pres.barcode ?? null,
            })),
        });
    }

    // Solo grupos con al menos un producto
    const groups = Array.from(groupsMap.values()).filter(g => g.products.length > 0);

    // socialLinks se guarda como JSON string en SystemSetting
    let socialLinks: SocialLinks = {};
    try {
        socialLinks = JSON.parse(settings.socialLinks || '{}') as SocialLinks;
    } catch {
        socialLinks = {};
    }

    return {
        businessName: settings.businessName,
        taxId: settings.taxId,
        socialLinks,
        groups,
    };
};
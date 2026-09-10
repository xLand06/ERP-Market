// =============================================================================
// CATALOG SERVICE — Catálogo digital público (F5)
// Consume el endpoint público GET /api/catalog/:slug (sin autenticación)
// =============================================================================

import api from '../lib/api';
import type { ApiResponse } from '../types';

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

export const catalogApi = {
    /**
     * Obtiene el catálogo público por slug.
     * Lanza 404 si el catálogo está inactivo o el slug no coincide.
     */
    getBySlug: async (slug: string): Promise<PublicCatalog> => {
        const { data } = await api.get<ApiResponse<PublicCatalog>>(`/catalog/${encodeURIComponent(slug)}`);
        return data.data;
    },
};

export default catalogApi;
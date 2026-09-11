// Trigger restart for new Prisma schema
import { prisma } from '../../config/prisma';
import { PaginationParams } from '../../core/types/api.types';
import { ProductFiltersInput, CreateProductInput, UpdateProductInput } from '../../core/validations/products.zod';
import type { ProductDTO } from '../../core/types/dto';
import type { ApiListResponse } from '../../core/types/responses';
import { ciContains } from '../../core/utils/helpers';

interface ProductListParams extends PaginationParams {
    subGroupId?: string;
    groupId?: string;
    isActive?: boolean;
}

// =========================================================================
// KITS — Validación de componentes (existencia + circularidad)
// =========================================================================

interface KitComponentInputData {
    componentProductId: string;
    quantity: number;
}

// Cliente mínimo para correr las queries de validación (prisma o un tx client)
interface KitValidationClient {
    product: {
        findMany: (args: {
            where: { id: { in: string[] } };
            select: { id: true };
        }) => Promise<Array<{ id: string }>>;
    };
    kitComponent: {
        findMany: (args: {
            where: { kitProductId: { in: string[] } };
            select: { componentProductId: true };
        }) => Promise<Array<{ componentProductId: string }>>;
    };
}

/**
 * Valida los componentes de un kit antes de persistirlos:
 * 1. Sin componentes duplicados.
 * 2. El componente no puede ser el propio kit.
 * 3. Los componentes deben existir en el catálogo.
 * 4. Guarda circular: un componente no puede ser un kit que contenga
 *    (directa o transitivamente) al kit padre — BFS acotado sobre la
 *    relación kit→componentes.
 * Lanza error 422 con mensaje en español ante cualquier violación.
 */
async function validateKitComponents(
    kitProductId: string,
    components: KitComponentInputData[],
    client: KitValidationClient = prisma as any
): Promise<void> {
    if (!components.length) return;

    // 1. Duplicados
    const seen = new Set<string>();
    for (const c of components) {
        if (seen.has(c.componentProductId)) {
            throw Object.assign(
                new Error('No se permiten componentes duplicados'),
                { status: 422 }
            );
        }
        seen.add(c.componentProductId);
    }

    // 2. El componente no puede ser el propio kit
    if (seen.has(kitProductId)) {
        throw Object.assign(
            new Error('El producto no puede ser componente de sí mismo'),
            { status: 422 }
        );
    }

    // 3. Los componentes deben existir
    const ids = [...seen];
    const existing = await client.product.findMany({
        where: { id: { in: ids } },
        select: { id: true },
    });
    if (existing.length !== ids.length) {
        throw Object.assign(
            new Error('Uno o más componentes del kit no existen'),
            { status: 422 }
        );
    }

    // 4. Guarda circular: BFS desde cada componente hacia abajo (sus propios
    //    componentes). Si en el camino aparece el kit padre → ciclo ilegal.
    const visited = new Set<string>([kitProductId, ...ids]);
    let frontier = [...ids];
    while (frontier.length > 0) {
        const level = await client.kitComponent.findMany({
            where: { kitProductId: { in: frontier } },
            select: { componentProductId: true },
        });
        const next: string[] = [];
        for (const row of level) {
            if (row.componentProductId === kitProductId) {
                throw Object.assign(
                    new Error('No se permite componente circular'),
                    { status: 422 }
                );
            }
            if (!visited.has(row.componentProductId)) {
                visited.add(row.componentProductId);
                next.push(row.componentProductId);
            }
        }
        frontier = next;
    }
}

// Include reutilizable para traer los componentes del kit junto al producto
const KIT_COMPONENTS_INCLUDE = {
    kitComponents: {
        include: {
            componentProduct: {
                select: { id: true, name: true, price: true, baseUnit: true, barcode: true },
            },
        },
    },
} as const;

// =========================================================================
// Validación de dígito verificador EAN/UPC (algoritmo GS1 módulo 10)
// =========================================================================

function validateEAN13CheckDigit(code: string): boolean {
    if (!/^\d{13}$/.test(code)) return false;
    const digits = code.split('').map(Number);
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += digits[i] * (i % 2 === 0 ? 1 : 3); // odd pos ×1, even ×3
    }
    const check = (10 - (sum % 10)) % 10;
    return check === digits[12];
}

function validateUPCAOrEAN8CheckDigit(code: string): boolean {
    const digits = code.split('').map(Number);
    if (digits.some(isNaN)) return false;
    const len = digits.length;
    if (len !== 8 && len !== 12) return false;
    const lastIdx = len - 1;
    let sum = 0;
    for (let i = 0; i < lastIdx; i++) {
        sum += digits[i] * (i % 2 === 0 ? 3 : 1); // odd pos ×3, even ×1
    }
    const check = (10 - (sum % 10)) % 10;
    return check === digits[lastIdx];
}

const VALID_BARCODE_LABELS = ['EAN-13', 'EAN-8', 'UPC-A', 'INTERNO', 'PROVEEDOR', 'OTRO'] as const;

function validateBarcodes(barcodes?: Array<{ code: string; label?: string | null }>): void {
    if (!barcodes?.length) return;

    for (const bc of barcodes) {
        if (!bc.code?.trim()) continue;
        const label = bc.label?.trim() || '';
        const code = bc.code.trim();

        // Si no tiene label o es desconocido, solo validamos que no esté vacío (Zod ya lo hace)
        if (!label || !(VALID_BARCODE_LABELS as readonly string[]).includes(label)) continue;

        switch (label) {
            case 'EAN-13':
                if (!/^\d{13}$/.test(code)) {
                    throw Object.assign(
                        new Error(`Código EAN-13 inválido: "${code}" debe tener exactamente 13 dígitos`),
                        { status: 400 }
                    );
                }
                if (!validateEAN13CheckDigit(code)) {
                    throw Object.assign(
                        new Error(`Dígito verificador incorrecto en EAN-13: "${code}"`),
                        { status: 400 }
                    );
                }
                break;
            case 'EAN-8':
                if (!/^\d{8}$/.test(code)) {
                    throw Object.assign(
                        new Error(`Código EAN-8 inválido: "${code}" debe tener exactamente 8 dígitos`),
                        { status: 400 }
                    );
                }
                if (!validateUPCAOrEAN8CheckDigit(code)) {
                    throw Object.assign(
                        new Error(`Dígito verificador incorrecto en EAN-8: "${code}"`),
                        { status: 400 }
                    );
                }
                break;
            case 'UPC-A':
                if (!/^\d{12}$/.test(code)) {
                    throw Object.assign(
                        new Error(`Código UPC-A inválido: "${code}" debe tener exactamente 12 dígitos`),
                        { status: 400 }
                    );
                }
                if (!validateUPCAOrEAN8CheckDigit(code)) {
                    throw Object.assign(
                        new Error(`Dígito verificador incorrecto en UPC-A: "${code}"`),
                        { status: 400 }
                    );
                }
                break;
            case 'INTERNO':
            case 'PROVEEDOR':
                if (code.length < 2) {
                    throw Object.assign(
                        new Error(`El código "${code}" debe tener al menos 2 caracteres`),
                        { status: 400 }
                    );
                }
                break;
        }
    }
}

export const getAllProducts = async (filters: ProductListParams): Promise<ApiListResponse<ProductDTO>> => {
    const { page = 1, limit = 20, search, subGroupId, groupId, isActive } = filters;
    const skip = (page - 1) * limit;

    const where = {
        ...(subGroupId && { subGroupId }),
        ...(!subGroupId && groupId && { subGroup: { groupId } }),
        ...(isActive !== undefined && { isActive }),
        ...(search && {
            OR: [
                { name: ciContains(search) },
                { barcode: ciContains(search) },
                { presentations: { some: { barcode: ciContains(search) } } },
                // Buscar también en los barcodes del modelo ProductBarcode
                { barcodes: { some: { code: ciContains(search) } } },
            ],
        }),
    };

    const [products, total] = await Promise.all([
        prisma.product.findMany({
            where,
            include: {
                subGroup: { include: { group: true } },
                presentations: true,
                barcodes: true,
                ...KIT_COMPONENTS_INCLUDE,
            },
            orderBy: { name: 'asc' },
            skip,
            take: limit,
        }),
        prisma.product.count({ where }),
    ]);

    return {
        data: products.map(p => ({
            ...p,
            price: Number(p.price),
            cost: p.cost ? Number(p.cost) : undefined,
        })) as ProductDTO[],
        meta: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
};

export const getProductById = async (id: string): Promise<ProductDTO | null> => {
    const product = await prisma.product.findUnique({
        where: { id },
        include: {
            subGroup: { include: { group: true } },
            presentations: true,
            barcodes: true,
            ...KIT_COMPONENTS_INCLUDE,
        }
    });
    if (!product) return null;
    return {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : undefined,
    } as ProductDTO;
};

export const createProduct = async (data: CreateProductInput): Promise<ProductDTO> => {
    const { presentations, barcodes, minStock, branchId, kitComponents, ...productData } = data as any;

    // Normalizar a MAYÚSCULAS los datos de catálogo (nombre y códigos de barras).
    // Solo datos de negocio — no nombres propios de proveedores/clientes.
    productData.name = productData.name ? String(productData.name).toUpperCase() : productData.name;
    if (productData.barcode !== undefined && productData.barcode !== null) {
        productData.barcode = String(productData.barcode).toUpperCase();
    }
    const presentationsNorm = (presentations ?? []).map((p: any) => ({
        ...p,
        name: p.name ? String(p.name).toUpperCase() : p.name,
    }));
    const barcodesNorm = (barcodes ?? []).map((b: any) => ({
        ...b,
        code: b.code ? String(b.code).toUpperCase() : b.code,
    }));

    // Validar formato de códigos de barras según su label (ya normalizados)
    validateBarcodes(barcodesNorm);

    // Normalizar subGroupId: si es string vacío, convertir a null
    const subGroupId = productData.subGroupId === '' ? null : productData.subGroupId;

    // Crear el producto + componentes del kit en una sola transacción:
    // si la validación de componentes falla, no queda un producto huérfano.
    const product = await prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
            data: {
                ...productData,
                subGroupId,
                presentations: {
                    create: presentationsNorm,
                },
                barcodes: {
                    create: barcodesNorm.map((b: any) => ({
                        code: b.code,
                        label: b.label || null,
                    })),
                },
            },
            include: {
                presentations: true,
                barcodes: true,
                ...KIT_COMPONENTS_INCLUDE,
            },
        });

        // Kits: validar (existencia + circularidad) y persistir componentes.
        // Al ser un producto nuevo no puede existir un ciclo previo que lo
        // incluya, pero la validación corre igual con su id recién creado.
        if (kitComponents && kitComponents.length > 0) {
            await validateKitComponents(created.id, kitComponents, tx as any);
            await tx.kitComponent.createMany({
                data: kitComponents.map((c: any) => ({
                    kitProductId: created.id,
                    componentProductId: c.componentProductId,
                    quantity: Number(c.quantity),
                })),
            });
            // Re-consultar para devolver el producto con sus componentes ya creados
            const refetched = await tx.product.findUnique({
                where: { id: created.id },
                include: {
                    presentations: true,
                    barcodes: true,
                    ...KIT_COMPONENTS_INCLUDE,
                },
            });
            return refetched!;
        }

        return created;
    });

    // Inicializar stock en 0 en todas las sedes para este nuevo producto
    const branches = await prisma.branch.findMany({ select: { id: true } });
    if (branches.length > 0) {
        await prisma.branchInventory.createMany({
            data: branches.map(b => ({
                productId: product.id,
                branchId: b.id,
                stock: 0,
                minStock: minStock !== undefined ? Number(minStock) : 0,
            }))
        });
    }

    return {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : undefined,
    } as ProductDTO;
};

export const updateProduct = async (id: string, data: UpdateProductInput): Promise<ProductDTO> => {
    const { presentations, barcodes, minStock, branchId, kitComponents, ...productData } = data as any;

    // Normalizar a MAYÚSCULAS los datos de catálogo provistos (nombre y códigos de barras)
    if (productData.name !== undefined) {
        productData.name = String(productData.name).toUpperCase();
    }
    if (productData.barcode !== undefined && productData.barcode !== null) {
        productData.barcode = String(productData.barcode).toUpperCase();
    }
    const presentationsNorm = (presentations ?? []).map((p: any) => ({
        ...p,
        name: p.name ? String(p.name).toUpperCase() : p.name,
    }));
    const barcodesNorm = (barcodes ?? []).map((b: any) => ({
        ...b,
        code: b.code ? String(b.code).toUpperCase() : b.code,
    }));

    // Validar formato de códigos de barras según su label (ya normalizados)
    validateBarcodes(barcodesNorm);

    // Kits: validar ANTES de mutar (self, duplicados, existencia, circularidad)
    if (kitComponents !== undefined) {
        await validateKitComponents(id, kitComponents);
    }

    // Sincronizar presentaciones: borrar anteriores y crear nuevas (MVP)
    if (presentations !== undefined) {
        await prisma.productPresentation.deleteMany({ where: { productId: id } });
    }

    // Sincronizar barcodes: borrar anteriores y crear nuevos
    if (barcodes !== undefined) {
        await prisma.productBarcode.deleteMany({ where: { productId: id } });
    }

    // Normalizar subGroupId: si es string vacío, convertir a null
    const subGroupId = productData.subGroupId === '' ? null : productData.subGroupId;

    await prisma.product.update({
        where: { id },
        data: {
            ...productData,
            subGroupId,
            ...(presentations !== undefined && {
                presentations: {
                    create: presentationsNorm,
                },
            }),
            ...(barcodes !== undefined && {
                barcodes: {
                    create: barcodesNorm.map((b: any) => ({
                        code: b.code,
                        label: b.label || null,
                    })),
                },
            }),
        },
    });

    // Sincronizar componentes del kit: borrar anteriores y crear los nuevos (MVP)
    if (kitComponents !== undefined) {
        await prisma.kitComponent.deleteMany({ where: { kitProductId: id } });
        if (kitComponents.length > 0) {
            await prisma.kitComponent.createMany({
                data: kitComponents.map((c: any) => ({
                    kitProductId: id,
                    componentProductId: c.componentProductId,
                    quantity: Number(c.quantity),
                })),
            });
        }
    }

    if (minStock !== undefined) {
        const effectiveBranchId = branchId || undefined;
        if (effectiveBranchId) {
            await prisma.branchInventory.upsert({
                where: { productId_branchId: { productId: id, branchId: effectiveBranchId } },
                update: { minStock: Number(minStock) },
                create: { productId: id, branchId: effectiveBranchId, stock: 0, minStock: Number(minStock) }
            });
        } else {
            await prisma.branchInventory.updateMany({
                where: { productId: id },
                data: { minStock: Number(minStock) }
            });
        }
    }

    // Re-consultar: el update anterior no incluye los componentes recién sincronizados
    const updated = await prisma.product.findUnique({
        where: { id },
        include: {
            presentations: true,
            barcodes: true,
            ...KIT_COMPONENTS_INCLUDE,
        },
    });

    return {
        ...updated!,
        price: Number(updated!.price),
        cost: updated!.cost ? Number(updated!.cost) : undefined,
    } as ProductDTO;
};

export const deleteProduct = async (id: string): Promise<void> => {
    await prisma.product.delete({ where: { id } });
};

// =========================================================================
// Verificación de unicidad de código de barras (cross-product)
// =========================================================================

export interface BarcodeExistence {
    exists: boolean;
    productName?: string;
    productId?: string;
}

export const checkBarcodeExists = async (
    code: string,
    excludeProductId?: string
): Promise<BarcodeExistence> => {
    // 1. Buscar en ProductBarcode (multi-barcode)
    const existingBc = await prisma.productBarcode.findUnique({
        where: { code },
        select: { productId: true, product: { select: { name: true } } },
    });
    if (existingBc && existingBc.productId !== excludeProductId) {
        return { exists: true, productName: existingBc.product.name, productId: existingBc.productId };
    }

    // 2. Buscar en el campo legacy product.barcode
    const existingProd = await prisma.product.findUnique({
        where: { barcode: code },
        select: { id: true, name: true },
    });
    if (existingProd && existingProd.id !== excludeProductId) {
        return { exists: true, productName: existingProd.name, productId: existingProd.id };
    }

    // 3. Buscar en barcode de presentaciones
    const existingPres = await prisma.productPresentation.findUnique({
        where: { barcode: code },
        select: { product: { select: { id: true, name: true } } },
    });
    if (existingPres && existingPres.product.id !== excludeProductId) {
        return { exists: true, productName: existingPres.product.name, productId: existingPres.product.id };
    }

    return { exists: false };
};

// Trigger restart for new Prisma schema
import { prisma } from '../../config/prisma';
import { PaginationParams } from '../../core/types/api.types';
import { ProductFiltersInput, CreateProductInput, UpdateProductInput } from '../../core/validations/products.zod';
import type { ProductDTO } from '../../core/types/dto';
import type { ApiListResponse } from '../../core/types/responses';

interface ProductListParams extends PaginationParams {
    subGroupId?: string;
    isActive?: boolean;
}

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
    const { page = 1, limit = 20, search, subGroupId, isActive } = filters;
    const skip = (page - 1) * limit;

    const where = {
        ...(subGroupId && { subGroupId }),
        ...(isActive !== undefined && { isActive }),
        ...(search && {
            OR: [
                { name: { contains: search } },
                { barcode: { contains: search } },
                { presentations: { some: { barcode: { contains: search } } } },
                // Buscar también en los barcodes del modelo ProductBarcode
                { barcodes: { some: { code: { contains: search } } } },
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
    const { presentations, barcodes, minStock, branchId, ...productData } = data as any;

    // Validar formato de códigos de barras según su label
    validateBarcodes(barcodes);

    // Normalizar subGroupId: si es string vacío, convertir a null
    const subGroupId = productData.subGroupId === '' ? null : productData.subGroupId;

    const product = await prisma.product.create({
        data: {
            ...productData,
            subGroupId,
            presentations: {
                create: presentations ?? [],
            },
            barcodes: {
                create: (barcodes ?? []).map(b => ({
                    code: b.code,
                    label: b.label || null,
                })),
            },
        },
        include: {
            presentations: true,
            barcodes: true,
        },
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
    const { presentations, barcodes, minStock, branchId, ...productData } = data as any;

    // Validar formato de códigos de barras según su label
    validateBarcodes(barcodes);

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

    const product = await prisma.product.update({
        where: { id },
        data: {
            ...productData,
            subGroupId,
            ...(presentations !== undefined && {
                presentations: {
                    create: presentations,
                },
            }),
            ...(barcodes !== undefined && {
                barcodes: {
                    create: barcodes.map(b => ({
                        code: b.code,
                        label: b.label || null,
                    })),
                },
            }),
        },
        include: {
            presentations: true,
            barcodes: true,
        },
    });

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

    return {
        ...product,
        price: Number(product.price),
        cost: product.cost ? Number(product.cost) : undefined,
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

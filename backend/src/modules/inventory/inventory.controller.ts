// ============================
// INVENTORY MODULE — CONTROLLER
// ============================

import { Request, Response } from 'express';
import * as inventoryService from './inventory.service';
import { AuthRequest } from '../../core/middlewares/auth.middleware';
import { logAudit, extractIp } from '../../core/middlewares/audit.middleware';

// ─── CATÁLOGO MAESTRO ──────────────────────────────────────────────────────

export const getProducts = async (req: Request, res: Response): Promise<void> => {
    const { q } = req.query;
    const products = await inventoryService.getAllProducts(q as string | undefined);
    res.json({ success: true, data: products });
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
    const product = await inventoryService.getProductById(req.params.id);
    if (!product) { res.status(404).json({ error: 'Producto no encontrado' }); return; }
    res.json({ success: true, data: product });
};

export const getProductByBarcode = async (req: Request, res: Response): Promise<void> => {
    const product = await inventoryService.getProductByBarcode(req.params.barcode);
    if (!product) { res.status(404).json({ error: 'Código de barras no encontrado' }); return; }
    res.json({ success: true, data: product });
};

export const createProduct = async (req: AuthRequest, res: Response, next: any): Promise<void> => {
    try {
        const { name, price, code, barcode, cost, category, stock, minStock, branchId } = req.body;
        
        if (!name || price === undefined) {
            res.status(400).json({ error: 'Nombre y precio son requeridos' });
            return;
        }

        let categoryId = req.body.categoryId;
        if (!categoryId && category) {
            const categories = await inventoryService.getAllCategories();
            const existingCat = categories.find(c => c.name === category);
            if (!existingCat) {
                const newCat = await inventoryService.createCategory({ name: category });
                categoryId = newCat.id;
            } else {
                categoryId = existingCat.id;
            }
        }

        const productPayload = {
            name,
            price: parseFloat(price as string),
            cost: cost ? parseFloat(cost as string) : 0,
            barcode: code || barcode || '',
            categoryId
        };

        const product = await inventoryService.createProduct(productPayload);

        // Add initial stock if provided
        if (branchId && stock !== undefined) {
             const stockVal = parseInt(stock as string) || 0;
             const minStockVal = minStock !== undefined ? parseInt(minStock as string) || 0 : 0;
             await inventoryService.upsertStock(product.id, branchId, stockVal, minStockVal);
        }

        await logAudit({
            action: 'PRODUCT_CREATE', module: 'inventory',
            details: { name, price },
            userId: req.user!.id, ipAddress: extractIp(req),
        });
        res.status(201).json({ success: true, data: product });
    } catch (error) {
        next(error);
    }
};

export const updateProduct = async (req: AuthRequest, res: Response, next: any): Promise<void> => {
    try {
        const { id } = req.params;
        const before = await inventoryService.getProductById(id);
        
        const { name, price, code, barcode, cost, category, stock, minStock, branchId } = req.body;

        let categoryId = req.body.categoryId;
        if (!categoryId && category) {
            const categories = await inventoryService.getAllCategories();
            const existingCat = categories.find(c => c.name === category);
            if (!existingCat) {
                const newCat = await inventoryService.createCategory({ name: category });
                categoryId = newCat.id;
            } else {
                categoryId = existingCat.id;
            }
        }

        const updatePayload: any = {};
        if (name !== undefined) updatePayload.name = name;
        if (price !== undefined) updatePayload.price = parseFloat(price as string);
        if (cost !== undefined) updatePayload.cost = parseFloat(cost as string);
        if (code !== undefined || barcode !== undefined) updatePayload.barcode = code || barcode;
        if (categoryId !== undefined) updatePayload.categoryId = categoryId;

        const product = await inventoryService.updateProduct(id, updatePayload);

        // Update stock if requested
        if (branchId && stock !== undefined) {
             const stockVal = parseInt(stock as string) || 0;
             const minStockVal = minStock !== undefined ? parseInt(minStock as string) || 0 : 0;
             await inventoryService.upsertStock(product.id, branchId, stockVal, minStockVal);
        }

        const action = req.body.price !== undefined ? 'PRICE_CHANGE' : 'PRODUCT_UPDATE';
        await logAudit({
            action, module: 'inventory',
            details: {
                id,
                before: { price: before?.price, name: before?.name },
                after: req.body,
            },
            userId: req.user!.id, ipAddress: extractIp(req),
        });
        res.json({ success: true, data: product });
    } catch (error) {
        next(error);
    }
};

export const deleteProduct = async (req: AuthRequest, res: Response): Promise<void> => {
    await inventoryService.deleteProduct(req.params.id);
    await logAudit({
        action: 'PRODUCT_DELETE', module: 'inventory',
        details: { id: req.params.id },
        userId: req.user!.id, ipAddress: extractIp(req),
    });
    res.json({ success: true, message: 'Producto desactivado' });
};

// ─── CATEGORÍAS ────────────────────────────────────────────────────────────

export const getCategories = async (_req: Request, res: Response): Promise<void> => {
    const categories = await inventoryService.getAllCategories();
    res.json({ success: true, data: categories });
};

export const createCategory = async (req: Request, res: Response): Promise<void> => {
    const { name } = req.body;
    if (!name) { res.status(400).json({ error: 'El nombre es requerido' }); return; }
    const category = await inventoryService.createCategory(req.body);
    res.status(201).json({ success: true, data: category });
};

export const updateCategory = async (req: Request, res: Response): Promise<void> => {
    const { name, description } = req.body;
    const category = await inventoryService.updateCategory(req.params.id, { name, description });
    res.json({ success: true, data: category });
};

export const deleteCategory = async (req: Request, res: Response): Promise<void> => {
    await inventoryService.deleteCategory(req.params.id);
    res.json({ success: true, message: 'Categoría eliminada' });
};

// ─── STOCK POR SEDE ────────────────────────────────────────────────────────

export const getAllStock = async (_req: Request, res: Response): Promise<void> => {
    const stock = await inventoryService.getAllStock();
    res.json({ success: true, data: stock });
};

export const getStockByBranch = async (req: Request, res: Response): Promise<void> => {
    const stock = await inventoryService.getStockByBranch(req.params.branchId);
    res.json({ success: true, data: stock });
};

export const getStockByProduct = async (req: Request, res: Response): Promise<void> => {
    const stock = await inventoryService.getStockByProduct(req.params.productId);
    res.json({ success: true, data: stock });
};

export const setStock = async (req: AuthRequest, res: Response): Promise<void> => {
    const { productId, branchId, stock, minStock } = req.body;
    if (!productId || !branchId || stock === undefined) {
        res.status(400).json({ error: 'productId, branchId y stock son requeridos' });
        return;
    }
    const result = await inventoryService.upsertStock(productId, branchId, stock, minStock);
    await logAudit({
        action: 'STOCK_ADJUST', module: 'inventory',
        details: { productId, branchId, stock },
        userId: req.user!.id, ipAddress: extractIp(req),
    });
    res.json({ success: true, data: result });
};

export const getLowStock = async (req: Request, res: Response): Promise<void> => {
    const { branchId } = req.query;
    const alerts = await inventoryService.getLowStockAlerts(branchId as string | undefined);
    res.json({ success: true, data: alerts });
};

import { useState, useCallback } from 'react';
import { useCreateProduct, useUpdateProduct } from './useProducts';
import type { Product, CreateProductPayload, UpdateProductPayload } from '../types';

export interface UseProductFormOptions {
    onSuccess: () => void;
}

export function useProductForm({ onSuccess }: UseProductFormOptions) {
    const [open, setOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const createMutation = useCreateProduct();
    const updateMutation = useUpdateProduct();

    const handleOpenCreate = useCallback(() => {
        setSelectedProduct(null);
        setOpen(true);
    }, []);

    const handleOpenEdit = useCallback((product: Product) => {
        setSelectedProduct(product);
        setOpen(true);
    }, []);

    const handleClose = useCallback(() => {
        setOpen(false);
        setSelectedProduct(null);
    }, []);

    const handleSubmit = useCallback(async (
        data: CreateProductPayload | UpdateProductPayload,
        isEdit: boolean
    ) => {
        if (isEdit && selectedProduct) {
            await updateMutation.mutateAsync({ id: selectedProduct.id, ...data as UpdateProductPayload });
        } else {
            await createMutation.mutateAsync(data as CreateProductPayload);
        }
        onSuccess();
        handleClose();
    }, [selectedProduct, createMutation, updateMutation, onSuccess, handleClose]);

    return {
        open,
        selectedProduct,
        isLoading: createMutation.isPending || updateMutation.isPending,
        isSaving: createMutation.isPending || updateMutation.isPending,
        handleOpenCreate,
        handleOpenEdit,
        handleClose,
        handleSubmit,
    };
}
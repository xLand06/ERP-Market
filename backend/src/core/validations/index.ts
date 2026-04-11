// =============================================================================
// CORE VALIDATIONS — Index
// =============================================================================

// Common schemas
export { paginationSchema, idParamSchema, emailSchema, passwordSchema } from './common.zod';
export type { PaginationInput, IdParamInput, DateRangeInput } from './common.zod';

// Auth schemas
export { loginSchema, registerSchema, updateUserSchema } from './auth.zod';
export type { LoginInput, RegisterInput, UpdateUserInput } from './auth.zod';

// Products schemas
export { createProductSchema, updateProductSchema, productFiltersSchema, idParamSchema as productIdParamSchema } from './products.zod';
export type { CreateProductInput, UpdateProductInput, ProductFiltersInput } from './products.zod';

// POS schemas
export { createSaleSchema, transactionFiltersSchema, cancelTransactionSchema } from './pos.zod';
export type { CreateSaleInput, TransactionFiltersInput, CancelTransactionInput } from './pos.zod';

// Categories schemas
export { createCategorySchema, updateCategorySchema } from './categories.zod';
export type { CreateCategoryInput, UpdateCategoryInput } from './categories.zod';

// Users schemas
export { createUserSchema, userFiltersSchema } from './users.zod';
export type { CreateUserInput, UserFiltersInput } from './users.zod';
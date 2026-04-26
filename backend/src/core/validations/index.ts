// =============================================================================
// CORE VALIDATIONS — Index
// =============================================================================

// Common schemas
export { paginationSchema, idParamSchema, branchIdParamSchema, emailSchema, passwordSchema } from './common.zod';
export type { PaginationInput, IdParamInput } from './common.zod';

// Auth schemas
export { loginSchema, registerSchema, updateUserSchema } from './auth.zod';
export type { LoginInput, RegisterInput, UpdateUserInput } from './auth.zod';

// Products schemas
export { createProductSchema, updateProductSchema, productFiltersSchema } from './products.zod';
export { idParamSchema as productIdParamSchema } from './common.zod';
export type { CreateProductInput, UpdateProductInput, ProductFiltersInput } from './products.zod';

// POS schemas
export { createTransactionSchema, transactionFiltersSchema, cancelTransactionSchema } from './pos.zod';
export type { CreateTransactionInput, TransactionFiltersInput, CancelTransactionInput } from './pos.zod';

// Groups schemas
export { createGroupSchema, updateGroupSchema, createSubGroupSchema, updateSubGroupSchema } from './groups.zod';
export type { CreateGroupInput, UpdateGroupInput, CreateSubGroupInput, UpdateSubGroupInput } from './groups.zod';

// Users schemas
export { createUserSchema, userFiltersSchema } from './users.zod';
export type { CreateUserInput, UserFiltersInput } from './users.zod';
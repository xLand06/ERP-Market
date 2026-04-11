// =============================================================================
// ZOD TYPE DEFINITIONS — For development without node_modules
// =============================================================================

declare module 'zod' {
    interface ZodTypeDef {
        errorMap?: (issue: ZodIssue, ctx: { defaultError: string }) => string;
    }

    interface ZodIssue {
        code: string;
        path: (string | number)[];
        message?: string;
    }

    interface ZodError {
        issues: ZodIssue[];
        name: string;
        message: string;
        flatten(): {
            formErrors: string[];
            fieldErrors: Record<string, string[]>;
        };
    }

    type ZodTypeKind = 'ZodString' | 'ZodNumber' | 'ZodBoolean' | 'ZodObject' | 'ZodArray' | 'ZodEnum' | 'ZodOptional' | 'ZodDefault';

    interface ZodType<T> {
        parse(data: unknown): T;
        safeParse(data: unknown): { success: true; data: T } | { success: false; error: ZodError };
        refine(check: (data: T) => boolean, params?: { message?: string }): ZodType<T>;
        optional(): ZodOptional<T>;
        default(def: T): ZodDefault<T>;
    }

    type ZodRawShape = Record<string, ZodType<any>>;

    class ZodString {
        min(min: number, params?: { message?: string }): ZodString;
        max(max: number, params?: { message?: string }): ZodString;
        email(params?: { message?: string }): ZodString;
        uuid(params?: { message?: string }): ZodString;
        url(params?: { message?: string }): ZodString;
        optional(): ZodOptional<ZodString>;
    }

    class ZodNumber {
        min(min: number, params?: { message?: string }): ZodNumber;
        max(max: number, params?: { message?: string }): ZodNumber;
        positive(params?: { message?: string }): ZodNumber;
        int(params?: { message?: string }): ZodNumber;
        optional(): ZodOptional<ZodNumber>;
    }

    class ZodBoolean {
        default(def: boolean): ZodDefault<ZodBoolean>;
    }

    class ZodObject<T extends ZodRawShape> {
        constructor(shape: T);
        parse(data: unknown): { [K in keyof T]: T[K] extends ZodType<infer U> ? U : never };
        safeParse(data: unknown): { success: true; data: { [K in keyof T]: T[K] extends ZodType<infer U> ? U : never } } | { success: false; error: ZodError };
        extend(extension: ZodRawShape): ZodObject<T & ZodRawShape>;
    }

    class ZodArray<T extends ZodType<any>> {
        constructor(type: T);
        min(min: number, params?: { message?: string }): ZodArray<T>;
        max(max: number, params?: { message?: string }): ZodArray<T>;
    }

    class ZodEnum<T extends [string, ...string[]]> {
        constructor(values: T);
    }

    class ZodOptional<T extends ZodType<any>> {
        constructor(type: T);
    }

    class ZodDefault<T extends ZodType<any>> {
        constructor(type: T, defaultValue: T extends ZodType<infer U> ? U : never);
    }

    export function string(): ZodString;
    export function number(): ZodNumber;
    export function boolean(): ZodBoolean;
    export function object<T extends ZodRawShape>(shape: T): ZodObject<T>;
    export function array<T extends ZodType<any>>(type: T): ZodArray<T>;
    export function enumValues<T extends [string, ...string[]]>(values: T): ZodEnum<T>;
    export function literal<T extends string>(value: T): ZodType<T>;
    export function uuid(params?: { message?: string }): ZodString;
    export function email(params?: { message?: string }): ZodString;
    export function literalString<T extends string>(value: T): { _def: { type: T }; _parse: (data: unknown) => any };

    export type ZodSchema<T> = ZodType<T>;

    export function coerce(value: unknown): ZodType<unknown>;

    type inferAsyncSafeParse<T> = T extends ZodType<any> ? Awaited<ReturnType<T['safeParse']>> : never;
    export type SafeParseReturn<T> = inferAsyncSafeParse<T>;

    type inferSafeParse<T> = T extends ZodType<any> ? ReturnType<T['safeParse']> : never;
    export type SafeParseResult<T> = inferSafeParse<T>;

    export function infer<T extends ZodType<any>>(_type: T): T extends ZodType<infer U> ? U : never;
    export type infer2<T extends ZodType<any>> = T extends ZodType<infer U> ? U : never;

    export interface IssuePath {
        path: (string | number)[];
        message?: string;
    }

    type ZodIssueBase = {
        path: (string | number)[];
        code: string;
        message?: string;
    };

    export { ZodIssue, ZodError };
}

export {};
# TASK: Bổ sung Base Infrastructure cho PhotoStorage

Đọc `CLAUDE.md` trước khi làm bất cứ điều gì.

## Yêu cầu

Bổ sung 4 nhóm file infrastructure còn thiếu vào project. Đây là task kỹ thuật thuần túy — không phải feature mới, không thay đổi business logic.

---

## NHÓM 1: BE — asyncHandler + Response Helpers

Tạo file `photo-storage/server/src/utils/asyncHandler.ts`:

```typescript
import { Request, Response, NextFunction } from 'express'
import { logger } from './logger'

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch((err: Error) => {
      logger.error(`[${req.method}] ${req.path} — ${err.message}`, {
        userId: (req as any).user?.id ?? 'anonymous',
        errorName: err.name,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
      })
      next(err)
    })
  }

export const ok = (res: Response, data: unknown, message = 'Success') =>
  res.status(200).json({ success: true, message, data })

export const created = (res: Response, data: unknown, message = 'Created') =>
  res.status(201).json({ success: true, message, data })

export const noContent = (res: Response) => res.status(204).send()

export const fail = (res: Response, message: string, code = 400) =>
  res.status(code).json({ success: false, message, data: null })

export const unauthorized = (res: Response, message = 'Unauthorized') =>
  fail(res, message, 401)

export const forbidden = (res: Response, message = 'Forbidden') =>
  fail(res, message, 403)

export const notFound = (res: Response, message = 'Not found') =>
  fail(res, message, 404)

export const conflict = (res: Response, message = 'Conflict') =>
  fail(res, message, 409)

export const serverError = (res: Response, message = 'Internal server error') =>
  fail(res, message, 500)

export const globalErrorHandler = (
  err: Error & { status?: number },
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const isDev = process.env.NODE_ENV === 'development'
  const status = err.status ?? 500
  const message = isDev ? err.message : status === 500
    ? 'Internal server error'
    : err.message

  res.status(status).json({
    success: false,
    message,
    data: null,
    ...(isDev && { stack: err.stack }),
  })
}
```

Sau khi tạo file, thực hiện các việc sau:

1. Kiểm tra `photo-storage/server/src/index.ts` — thêm `globalErrorHandler` vào cuối cùng (sau tất cả routes):
   ```typescript
   import { globalErrorHandler } from './utils/asyncHandler'
   // ... sau tất cả app.use(routes)
   app.use(globalErrorHandler)
   ```

2. Scan toàn bộ files trong `photo-storage/server/src/routes/` — tìm những route đang dùng try/catch inline. Với mỗi file tìm thấy, refactor sang `asyncHandler`. Ví dụ:

   **Trước:**
   ```typescript
   router.get('/me', requireAuth, async (req, res) => {
     try {
       const user = await getUser(req.user.id)
       res.json({ success: true, data: user })
     } catch (e) {
       res.status(500).json({ error: e.message })
     }
   })
   ```

   **Sau:**
   ```typescript
   import { asyncHandler, ok, serverError } from '../utils/asyncHandler'
   router.get('/me', requireAuth, asyncHandler(async (req, res) => {
     const user = await getUser(req.user!.id)
     return ok(res, user)
   }))
   ```

3. Sau khi refactor xong, chạy `tsc --noEmit` trong `photo-storage/server/` để verify không có TypeScript error.

---

## NHÓM 2: FE — useApi Composable

Kiểm tra `photo-storage/src/composables/useApi.ts` — nếu đã tồn tại, merge thêm `useApiList`. Nếu chưa có, tạo mới:

```typescript
import { ref } from 'vue'

export function useApi<T = unknown>() {
  const data = ref<T | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const execute = async (fn: () => Promise<T>): Promise<T | null> => {
    loading.value = true
    error.value = null
    try {
      const result = await fn()
      data.value = result
      return result
    } catch (e: any) {
      error.value =
        e?.response?.data?.message ??
        e?.message ??
        'Đã có lỗi xảy ra, vui lòng thử lại'
      return null
    } finally {
      loading.value = false
    }
  }

  const reset = () => {
    data.value = null
    loading.value = false
    error.value = null
  }

  return { data, loading, error, execute, reset }
}

export function useApiList<T = unknown>() {
  const items = ref<T[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const total = ref(0)
  const hasMore = ref(false)
  const cursor = ref<string | null>(null)

  const fetch = async (fn: () => Promise<{ items: T[]; total?: number; nextCursor?: string | null }>) => {
    loading.value = true
    error.value = null
    try {
      const result = await fn()
      items.value = result.items ?? []
      total.value = result.total ?? items.value.length
      cursor.value = result.nextCursor ?? null
      hasMore.value = !!result.nextCursor
    } catch (e: any) {
      error.value = e?.response?.data?.message ?? 'Không thể tải dữ liệu'
      items.value = []
    } finally {
      loading.value = false
    }
  }

  const fetchMore = async (fn: () => Promise<{ items: T[]; nextCursor?: string | null }>) => {
    if (!hasMore.value || loading.value) return
    loading.value = true
    try {
      const result = await fn()
      items.value = [...items.value, ...(result.items ?? [])]
      cursor.value = result.nextCursor ?? null
      hasMore.value = !!result.nextCursor
    } catch (e: any) {
      error.value = e?.response?.data?.message ?? 'Không thể tải thêm'
    } finally {
      loading.value = false
    }
  }

  const reset = () => {
    items.value = []
    total.value = 0
    cursor.value = null
    hasMore.value = false
    error.value = null
  }

  return { items, loading, error, total, hasMore, cursor, fetch, fetchMore, reset }
}
```

---

## NHÓM 3: Design Tokens

Tạo file `photo-storage/src/assets/tokens.css`:

```css
:root {
  /* ── Colors ── */
  --color-primary: #6366f1;
  --color-primary-hover: #4f46e5;
  --color-primary-light: #e0e7ff;
  --color-secondary: #8b5cf6;
  --color-secondary-hover: #7c3aed;

  --color-success: #10b981;
  --color-success-light: #d1fae5;
  --color-warning: #f59e0b;
  --color-warning-light: #fef3c7;
  --color-error: #ef4444;
  --color-error-light: #fee2e2;
  --color-info: #3b82f6;
  --color-info-light: #dbeafe;

  /* ── Text ── */
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-text-muted: #9ca3af;
  --color-text-inverse: #ffffff;
  --color-text-link: #6366f1;
  --color-text-link-hover: #4f46e5;

  /* ── Backgrounds ── */
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f9fafb;
  --color-bg-tertiary: #f3f4f6;
  --color-bg-card: #ffffff;
  --color-bg-overlay: rgba(0, 0, 0, 0.5);

  /* ── Borders ── */
  --color-border: #e5e7eb;
  --color-border-strong: #d1d5db;
  --color-border-focus: #6366f1;

  /* ── Spacing (base 4px) ── */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;

  /* ── Typography ── */
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-md: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
  --font-size-3xl: 30px;
  --font-size-4xl: 36px;

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;

  /* ── Border Radius ── */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-full: 9999px;

  /* ── Shadows ── */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1);

  /* ── Transitions ── */
  --transition-fast: 150ms ease;
  --transition-base: 200ms ease;
  --transition-slow: 300ms ease;

  /* ── Z-Index ── */
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-modal: 300;
  --z-toast: 400;
  --z-tooltip: 500;

  /* ── Layout ── */
  --container-max: 1280px;
  --sidebar-width: 240px;
  --header-height: 64px;
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
}

/* ── Dark Mode ── */
@media (prefers-color-scheme: dark) {
  :root {
    --color-text-primary: #f9fafb;
    --color-text-secondary: #9ca3af;
    --color-text-muted: #6b7280;

    --color-bg-primary: #111827;
    --color-bg-secondary: #1f2937;
    --color-bg-tertiary: #374151;
    --color-bg-card: #1f2937;

    --color-border: #374151;
    --color-border-strong: #4b5563;

    --color-primary-light: #312e81;
    --color-success-light: #064e3b;
    --color-warning-light: #78350f;
    --color-error-light: #7f1d1d;
    --color-info-light: #1e3a5f;
  }
}
```

Sau khi tạo xong, import vào `photo-storage/src/main.ts`:
```typescript
import './assets/tokens.css'
```

---

## NHÓM 4: ESLint + Prettier

### 4a. Cài packages

Chạy trong `photo-storage/` (FE):
```bash
npm install -D eslint @eslint/js typescript-eslint eslint-plugin-vue prettier eslint-config-prettier
```

Chạy trong `photo-storage/server/` (BE):
```bash
npm install -D eslint @eslint/js typescript-eslint prettier eslint-config-prettier
```

### 4b. Tạo `photo-storage/eslint.config.js`:
```javascript
import js from '@eslint/js'
import ts from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  ...vue.configs['flat/recommended'],
  prettier,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'vue/multi-word-component-names': 'off',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]
```

### 4c. Tạo `photo-storage/server/eslint.config.js`:
```javascript
import js from '@eslint/js'
import ts from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default [
  js.configs.recommended,
  ...ts.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]
```

### 4d. Tạo `.prettierrc` ở root repo:
```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "vueIndentScriptAndStyle": false
}
```

### 4e. Thêm scripts vào `package.json` của FE và BE:
```json
{
  "scripts": {
    "lint": "eslint src --ext .ts,.vue",
    "lint:fix": "eslint src --ext .ts,.vue --fix",
    "format": "prettier --write src"
  }
}
```

---

## KIỂM TRA SAU KHI XONG

Chạy các lệnh sau và báo kết quả:

```bash
# BE typecheck
cd photo-storage/server && tsc --noEmit
echo "BE tsc: $?"

# FE typecheck
cd photo-storage && vue-tsc --noEmit
echo "FE tsc: $?"

# FE lint
cd photo-storage && npm run lint
echo "FE lint: $?"

# BE lint
cd photo-storage/server && npm run lint
echo "BE lint: $?"
```

Nếu có lỗi TypeScript sau refactor asyncHandler — fix hết trước khi kết thúc task.
Nếu ESLint báo lỗi nhiều hơn 20 warnings — liệt kê ra nhưng không cần fix hết trong task này.

## KHÔNG LÀM TRONG TASK NÀY
- Không thêm feature mới
- Không thay đổi database schema
- Không deploy
- Không thay đổi business logic trong routes — chỉ wrap asyncHandler và đổi response format

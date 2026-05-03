# ADR-0008: Pinia stores (Vue equivalent cua Zustand)

- **Status**: accepted
- **Date**: 2026-02-15
- **Tags**: frontend, state

## Context

Vue 3 state options: Pinia (official), Vuex (legacy), composable only. Pinia la default modern Vue state.

## Decision

**Pinia stores**:
- `auth.ts` — user, plan, refresh
- `upload.ts` — progress, queue, abort
- `toast.ts` — success/error messages
- `notification.ts` — socket events (image:ready, payment:success)
- `admin.ts` — admin dashboard state

### Pattern
```typescript
export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const isAuthenticated = computed(() => !!user.value);

  async function login(credentials) { ... }
  async function logout() { ... }

  return { user, isAuthenticated, login, logout };
});
```

## Rationale

- Pinia = Vue official, TypeScript support tot
- Setup store (composition style) = gan voi Vue 3 idiom
- Equivalent React + Zustand (WebTemplate ADR-0009)

## References

- Related: WebTemplate ADR-0009 (Zustand for React stack)

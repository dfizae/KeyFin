import type { AuthUser } from "@/features/auth/store";

/** 로그인 응답(docs/api-contract.md AUTH)의 user. 이름은 Pencil 홈 시안(EWfx2)의 인사말과 같다. */
export const authUserMock: AuthUser = { id: 1, name: "김재영" };

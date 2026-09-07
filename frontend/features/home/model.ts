import { ContractMismatchError } from "@/lib/contract";
import { isKRW, subtractKRW, toWon, type KRW } from "@/lib/money";

/**
 * 홈 요약 응답 DTO. 백엔드 OpenAPI 스펙이 아직 없어 화면(Pencil 홈 hcONw · 홈(캐릭터 활성화) zq2Xl)에서 역산한 임시 계약이다.
 * 스펙이 확정되면 api/generated 타입으로 교체한다. (TBD)
 */
export type CharacterDto = {
  characterId: string;
  name: string;
};

export type MonthlyBudgetDto = {
  /** 이번 달 총 예산, 원 단위 정수 문자열 */
  total: string;
  /** 이번 달 사용액, 원 단위 정수 문자열 */
  spent: string;
};

export type HomeSummaryDto = {
  user: { name: string };
  unreadNotificationCount: number;
  coinBalance: number;
  character: CharacterDto | null;
  monthlyBudget: MonthlyBudgetDto | null;
};

export type CharacterSummary = {
  characterId: string;
  name: string;
};

/** good: 사용률 70% 미만, warning: 70% 이상, over: 예산 초과. 기준값은 백엔드 확정 전 임시. (TBD) */
export type BudgetStatus = "good" | "warning" | "over";

export type MonthlyBudget = {
  total: KRW;
  spent: KRW;
  remaining: KRW;
  /** 0..1 로 잘라낸 사용 비율 */
  usedRatio: number;
  status: BudgetStatus;
};

export type HomeSummary = {
  userName: string;
  unreadNotificationCount: number;
  coinBalance: number;
  character: CharacterSummary | null;
  monthlyBudget: MonthlyBudget | null;
};

const WARNING_RATIO = 0.7;

export function toMonthlyBudget(dto: MonthlyBudgetDto): MonthlyBudget {
  if (!isKRW(dto.total)) throw new ContractMismatchError("monthlyBudget.total");
  if (!isKRW(dto.spent)) throw new ContractMismatchError("monthlyBudget.spent");
  const total = toWon(dto.total);
  const spent = toWon(dto.spent);
  if (total < 0n || spent < 0n) throw new ContractMismatchError("monthlyBudget");

  const usedRatio = total === 0n ? (spent > 0n ? 1 : 0) : Math.min(Number(spent) / Number(total), 1);
  const status: BudgetStatus = spent > total ? "over" : usedRatio >= WARNING_RATIO ? "warning" : "good";

  return {
    total: dto.total,
    spent: dto.spent,
    remaining: subtractKRW(dto.total, dto.spent),
    usedRatio,
    status,
  };
}

export function toHomeSummary(dto: HomeSummaryDto): HomeSummary {
  if (!Number.isInteger(dto.coinBalance) || dto.coinBalance < 0) throw new ContractMismatchError("coinBalance");
  return {
    userName: dto.user.name,
    unreadNotificationCount: dto.unreadNotificationCount,
    coinBalance: dto.coinBalance,
    character: dto.character ? { characterId: dto.character.characterId, name: dto.character.name } : null,
    monthlyBudget: dto.monthlyBudget ? toMonthlyBudget(dto.monthlyBudget) : null,
  };
}

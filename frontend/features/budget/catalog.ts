import { Bus, Ellipsis, Gamepad2, HeartPulse, ShoppingBag, ShoppingCart, Utensils, type LucideIcon } from "lucide-react-native";

/**
 * 봉투 7종은 고정 id 다 (docs/api-contract.md §4). 이름은 서버 응답을 쓰고,
 * 순서·짧은 표시명·아이콘은 클라이언트 상수로 둔다 (docs/frontend-spec.md §5).
 * 아이콘은 Pencil budget (kvc1e) EnvelopeList (MhHC7) 의 Tile 안 lucide 이름이다.
 */
export const ENVELOPE_CATALOG = [
  { id: 1, name: "외식", shortName: "외식", icon: Utensils },
  { id: 2, name: "교통비", shortName: "교통", icon: Bus },
  { id: 3, name: "의료·건강", shortName: "의료", icon: HeartPulse },
  { id: 4, name: "취미·여가", shortName: "여가", icon: Gamepad2 },
  { id: 5, name: "쇼핑", shortName: "쇼핑", icon: ShoppingBag },
  { id: 6, name: "편의점·마트·잡화", shortName: "마트", icon: ShoppingCart },
  { id: 7, name: "기타", shortName: "기타", icon: Ellipsis },
] as const;

/** 좁은 칸(차트 축)에 쓰는 이름. 카탈로그에 없는 id 면 서버 이름을 그대로 쓴다. */
export function envelopeShortName(envelopeId: number, fallback: string): string {
  return ENVELOPE_CATALOG.find((envelope) => envelope.id === envelopeId)?.shortName ?? fallback;
}

/** 봉투 아이콘. 카탈로그에 없는 id 는 "기타" 아이콘으로 떨어진다. */
export function envelopeIcon(envelopeId: number): LucideIcon {
  return ENVELOPE_CATALOG.find((envelope) => envelope.id === envelopeId)?.icon ?? Ellipsis;
}

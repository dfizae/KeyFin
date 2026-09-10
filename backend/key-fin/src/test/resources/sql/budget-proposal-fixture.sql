INSERT INTO users (id, email, password, name, fin_user_key) VALUES
 (997, 'proposal-test@keyfin.io', 'x', '제안테스터', 'test-user-key-997'),
 (996, 'proposal-empty@keyfin.io', 'x', '무이력테스터', 'test-user-key-996'),
 (995, 'proposal-partial@keyfin.io', 'x', '부분이력테스터', 'test-user-key-995'),
 (994, 'proposal-fraction@keyfin.io', 'x', '부분달테스터', 'test-user-key-994');

-- 테스트 고정 시계 = 2026-09-10 → 집계 구간 [2026-06-10, 2026-09-10), 구간 92일
INSERT INTO transactions
 (id, user_id, source, tx_type, amount, tx_date, tx_time, subcategory_id, confirm_status, exclude_tag, adjusted_amount, status) VALUES
 (8001, 997, 'SEED', 'CARD', 100000, '2026-06-10', '12:00:00', 101, 'AUTO',      'NONE', NULL, 'NORMAL'),   -- 외식
 (8002, 997, 'SEED', 'CARD', 120000, '2026-07-10', '12:00:00', 101, 'CONFIRMED', 'NONE', NULL, 'NORMAL'),   -- 외식
 (8003, 997, 'SEED', 'CARD',  80000, '2026-08-10', '12:00:00', 101, 'CONFIRMED', 'NONE', NULL, 'NORMAL'),   -- 외식
 (8004, 997, 'SEED', 'CARD', 100000, '2026-07-15', '12:00:00', 201, 'CONFIRMED', 'NONE', NULL, 'NORMAL'),   -- 교통 10만 → ×30/92 = 32,608 → 33,000
 (8005, 997, 'SEED', 'CARD',  50000, '2026-05-31', '12:00:00', 101, 'CONFIRMED', 'NONE', NULL, 'NORMAL'),   -- 구간 이전 → 집계 제외 (최초 거래일로는 사용)
 (8006, 997, 'SEED', 'CARD',  70000, '2026-09-01', '12:00:00', 101, 'CONFIRMED', 'NONE', NULL, 'NORMAL'),   -- 외식 → 합 37만 → ×30/92 = 120,652 → 121,000
 (8007, 995, 'SEED', 'CARD',  90000, '2026-08-15', '12:00:00', 101, 'CONFIRMED', 'NONE', NULL, 'NORMAL'),   -- 커버 26일 → 하한 30일 → 평균 9만 (확대 없음)
 (8008, 994, 'SEED', 'CARD', 100000, '2026-06-25', '12:00:00', 101, 'CONFIRMED', 'NONE', NULL, 'NORMAL'),   -- 최초 거래 6/25 → 커버 77일
 (8009, 994, 'SEED', 'CARD', 130000, '2026-08-01', '12:00:00', 101, 'CONFIRMED', 'NONE', NULL, 'NORMAL');   -- 합 23만 → ×30/77 = 89,610 → 90,000

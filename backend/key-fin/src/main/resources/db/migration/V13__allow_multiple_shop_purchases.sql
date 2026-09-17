-- 구매는 하루 여러 건 허용하고, 보상의 사용자·날짜·사유별 중복 방지는 유지한다.
ALTER TABLE `fin_coin`
	ADD COLUMN `reward_grant_date` DATE GENERATED ALWAYS AS (
		CASE WHEN `reason_code` = 'PURCHASE' THEN NULL ELSE `grant_date` END
	) STORED,
	ADD INDEX `idx_fin_coin_user_id` (`user_id`, `id`),
	DROP INDEX `uq_coin_grant`,
	ADD CONSTRAINT `uq_coin_grant` UNIQUE (`user_id`, `reward_grant_date`, `reason_code`);

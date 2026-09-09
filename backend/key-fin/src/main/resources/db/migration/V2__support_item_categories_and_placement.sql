DROP PROCEDURE IF EXISTS `validate_v2_empty_item_tables`;

DELIMITER $$
CREATE PROCEDURE `validate_v2_empty_item_tables`()
BEGIN
	IF EXISTS (SELECT 1 FROM `items`) THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'V2 requires an empty items table';
	END IF;

	IF EXISTS (SELECT 1 FROM `user_items`) THEN
		SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'V2 requires an empty user_items table';
	END IF;
END$$
DELIMITER ;

CALL `validate_v2_empty_item_tables`();
DROP PROCEDURE `validate_v2_empty_item_tables`;

ALTER TABLE `items`
	ADD COLUMN `item_category` VARCHAR(20) NOT NULL COMMENT '상점 카테고리 — AVATAR/FURNITURE' AFTER `id`,
	ADD COLUMN `is_active` BOOLEAN NOT NULL DEFAULT TRUE COMMENT '상점 노출 가능 여부' AFTER `theme_code`,
	MODIFY COLUMN `slot_type` VARCHAR(20) NOT NULL COMMENT '장착·배치 가능 위치 — HEAD/FACE/UPPER_BODY/LOWER_BODY/SOCKS/FOOTWEAR/WALL/FLOOR',
	ADD CONSTRAINT `uq_items_id_category` UNIQUE (`id`,`item_category`),
	ADD CONSTRAINT `uq_items_id_category_slot` UNIQUE (`id`,`item_category`,`slot_type`),
	ADD CONSTRAINT `chk_items_category_slot` CHECK (
		(`item_category` = 'AVATAR' AND `slot_type` IN ('HEAD','FACE','UPPER_BODY','LOWER_BODY','SOCKS','FOOTWEAR'))
		OR (`item_category` = 'FURNITURE' AND `slot_type` IN ('WALL','FLOOR'))
	),
	ADD CONSTRAINT `chk_items_active` CHECK (`is_active` IN (FALSE,TRUE)),
	ADD INDEX `idx_items_shop` (`item_category`,`slot_type`,`is_active`),
	COMMENT = '상점 아이템 카탈로그';

DROP TABLE `user_items`;

CREATE TABLE `user_items` (
	`id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '고유 ID',
	`user_id` BIGINT NOT NULL COMMENT '사용자 ID',
	`item_id` BIGINT NOT NULL COMMENT '아바타 아이템 ID',
	`equipped_slot` VARCHAR(20) NULL COMMENT '현재 장착 위치 — NULL=미착용',
	`item_category` VARCHAR(20) GENERATED ALWAYS AS ('AVATAR') STORED COMMENT '아바타 카테고리 검증값',
	`acquired_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '획득 시각',
	PRIMARY KEY (`id`),
	CONSTRAINT `uq_ui` UNIQUE (`user_id`,`item_id`),
	CONSTRAINT `uq_ui_slot` UNIQUE (`user_id`,`equipped_slot`),
	CONSTRAINT `fk_ui_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_ui_item_category` FOREIGN KEY (`item_id`,`item_category`)
		REFERENCES `items`(`id`,`item_category`),
	CONSTRAINT `fk_ui_equipped_item` FOREIGN KEY (`item_id`,`item_category`,`equipped_slot`)
		REFERENCES `items`(`id`,`item_category`,`slot_type`),
	CONSTRAINT `chk_ui_equipped_slot` CHECK (
		`equipped_slot` IS NULL OR `equipped_slot` IN ('HEAD','FACE','UPPER_BODY','LOWER_BODY','SOCKS','FOOTWEAR')
	)
) COMMENT='사용자 보유 아바타 아이템과 장착 상태';

CREATE TABLE `user_furnitures` (
	`id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '고유 ID',
	`user_id` BIGINT NOT NULL COMMENT '사용자 ID',
	`item_id` BIGINT NOT NULL COMMENT '가구 아이템 ID',
	`placement_status` VARCHAR(20) NULL COMMENT '배치 위치 — FLOOR/LEFT_WALL/RIGHT_WALL. NULL=미배치',
	`placement_direction` VARCHAR(20) NULL COMMENT '설치 방향 — FRONT_LEFT/FRONT_RIGHT. NULL=미배치',
	`position_x` DECIMAL(8,3) NULL COMMENT '327×404 씬 기준점 X 좌표',
	`position_y` DECIMAL(8,3) NULL COMMENT '327×404 씬 기준점 Y 좌표',
	`layer` INT NOT NULL DEFAULT 0 COMMENT '가구 깊이 보정값',
	`item_category` VARCHAR(20) GENERATED ALWAYS AS ('FURNITURE') STORED COMMENT '가구 카테고리 검증값',
	`acquired_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '획득 시각',
	PRIMARY KEY (`id`),
	CONSTRAINT `uq_uf` UNIQUE (`user_id`,`item_id`),
	CONSTRAINT `fk_uf_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_uf_item_category` FOREIGN KEY (`item_id`,`item_category`)
		REFERENCES `items`(`id`,`item_category`),
	CONSTRAINT `chk_uf_placement_status` CHECK (
		`placement_status` IS NULL OR `placement_status` IN ('FLOOR','LEFT_WALL','RIGHT_WALL')
	),
	CONSTRAINT `chk_uf_placement_direction` CHECK (
		`placement_direction` IS NULL OR `placement_direction` IN ('FRONT_LEFT','FRONT_RIGHT')
	),
	CONSTRAINT `chk_uf_placement_state` CHECK (
		(`placement_status` IS NULL AND `placement_direction` IS NULL AND `position_x` IS NULL AND `position_y` IS NULL AND `layer` = 0)
		OR (`placement_status` IS NOT NULL AND `placement_direction` IS NOT NULL AND `position_x` IS NOT NULL AND `position_y` IS NOT NULL)
	),
	CONSTRAINT `chk_uf_position_x` CHECK (`position_x` IS NULL OR `position_x` BETWEEN 0 AND 327),
	CONSTRAINT `chk_uf_position_y` CHECK (`position_y` IS NULL OR `position_y` BETWEEN 0 AND 404)
) COMMENT='사용자 보유 가구와 배치 상태';

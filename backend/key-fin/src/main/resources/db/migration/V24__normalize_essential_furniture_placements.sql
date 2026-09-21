-- Normalize active users only. Preserve ownership, selected placement and sticker history.
-- DML is atomic; the temporary table disappears on failure or successful completion.
DROP PROCEDURE IF EXISTS normalize_essential_furniture_v24;
DELIMITER $$
CREATE PROCEDURE normalize_essential_furniture_v24()
BEGIN
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        DROP TEMPORARY TABLE IF EXISTS selected_essential_furniture_v24;
        RESIGNAL;
    END;

    START TRANSACTION;

    INSERT INTO user_furnitures (user_id, item_id)
    SELECT u.id, i.id
    FROM users u CROSS JOIN items i
    WHERE u.deleted_at IS NULL AND i.default_furniture_type IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM user_furnitures uf WHERE uf.user_id = u.id AND uf.item_id = i.id
      );

    CREATE TEMPORARY TABLE selected_essential_furniture_v24 (
        user_id BIGINT NOT NULL,
        furniture_type VARCHAR(10) NOT NULL,
        furniture_id BIGINT NOT NULL,
        sticker_attached BOOLEAN NOT NULL,
        PRIMARY KEY (user_id, furniture_type)
    );

    INSERT INTO selected_essential_furniture_v24
    SELECT user_id, furniture_type, id, has_sticker
    FROM (
        SELECT uf.user_id, i.furniture_type, uf.id,
            MAX(uf.sticker_attached) OVER (PARTITION BY uf.user_id, i.furniture_type) AS has_sticker,
            ROW_NUMBER() OVER (
                PARTITION BY uf.user_id, i.furniture_type
                ORDER BY CASE
                    WHEN uf.placement_status IS NOT NULL AND i.default_furniture_type IS NULL THEN 0
                    WHEN uf.placement_status IS NOT NULL THEN 1
                    WHEN i.default_furniture_type IS NOT NULL THEN 2
                    ELSE 3
                END, uf.acquired_at DESC, uf.id DESC
            ) AS choice_rank
        FROM user_furnitures uf
        JOIN items i ON i.id = uf.item_id
        JOIN users u ON u.id = uf.user_id
        WHERE u.deleted_at IS NULL AND i.furniture_type IS NOT NULL
    ) ranked
    WHERE choice_rank = 1;

    UPDATE user_furnitures uf
    JOIN items i ON i.id = uf.item_id
    JOIN selected_essential_furniture_v24 chosen
        ON chosen.user_id = uf.user_id AND chosen.furniture_type = i.furniture_type
    SET uf.placement_status = IF(uf.id = chosen.furniture_id, 'FLOOR', NULL),
        uf.placement_direction = IF(uf.id = chosen.furniture_id, COALESCE(uf.placement_direction, 'FRONT_RIGHT'), NULL),
        uf.position_x = IF(uf.id = chosen.furniture_id, COALESCE(uf.position_x,
            CASE i.furniture_type WHEN 'FRIDGE' THEN 280.438 WHEN 'SOFA' THEN 164.875 ELSE 172.719 END), NULL),
        uf.position_y = IF(uf.id = chosen.furniture_id, COALESCE(uf.position_y,
            CASE i.furniture_type WHEN 'FRIDGE' THEN 217.813 WHEN 'SOFA' THEN 226.000 ELSE 176.094 END), NULL),
        uf.layer = IF(uf.id = chosen.furniture_id, uf.layer, 0),
        uf.sticker_attached = IF(uf.id = chosen.furniture_id, chosen.sticker_attached, FALSE);

    DROP TEMPORARY TABLE selected_essential_furniture_v24;
    COMMIT;
END$$
DELIMITER ;

CALL normalize_essential_furniture_v24();
DROP PROCEDURE normalize_essential_furniture_v24;

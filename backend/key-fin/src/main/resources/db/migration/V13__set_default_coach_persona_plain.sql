UPDATE user_settings
SET coach_persona = 'PLAIN'
WHERE coach_persona = 'ONSOON';

ALTER TABLE user_settings
	MODIFY COLUMN coach_persona VARCHAR(20) NOT NULL DEFAULT 'PLAIN'
	COMMENT '코치 말투 — PLAIN/DODO/ONSOON/JIBANG';

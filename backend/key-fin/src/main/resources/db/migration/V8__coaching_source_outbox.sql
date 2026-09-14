-- Apply after the current develop V1..V7 migrations; reconcile version conflicts before deployment.
-- One durable refresh request per owner; a later commit increments generation during an active lease.
CREATE TABLE `coaching_source_outbox` (
  `user_id` BIGINT NOT NULL,
  `generation` BIGINT NOT NULL,
  `completed_generation` BIGINT NOT NULL DEFAULT 0,
  `attempts` INT NOT NULL DEFAULT 0,
  `available_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lease_token` VARCHAR(36) NULL,
  `lease_until` TIMESTAMP NULL,
  `last_error_code` VARCHAR(80) NULL,
  PRIMARY KEY (`user_id`)
);

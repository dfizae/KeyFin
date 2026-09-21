package com.finset.key_fin.room.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

@Repository
@RequiredArgsConstructor
public class RoomStickerRepository {
	private final JdbcClient jdbc;

	public boolean wasApplied(long budgetId) {
		return jdbc.sql("SELECT EXISTS(SELECT 1 FROM budget_sticker_applications WHERE budget_id = :id)")
				.param("id", budgetId).query(Boolean.class).single();
	}

	public void recordApplication(long userId, long budgetId, LocalDateTime appliedAt) {
		jdbc.sql("INSERT INTO budget_sticker_applications (user_id, budget_id, applied_at) VALUES (:user, :budget, :at)")
				.param("user", userId).param("budget", budgetId).param("at", appliedAt).update();
	}

	public Optional<LocalDate> lastRemovedDate(long userId) {
		return jdbc.sql("SELECT last_removed_date FROM room_sticker_states WHERE user_id = :user")
				.param("user", userId).query(LocalDate.class).optional();
	}

	public void recordRemoval(long userId, LocalDate date) {
		jdbc.sql("""
				INSERT INTO room_sticker_states (user_id, last_removed_date) VALUES (:user, :date)
				ON DUPLICATE KEY UPDATE last_removed_date = :date
				""").param("user", userId).param("date", date).update();
	}
}

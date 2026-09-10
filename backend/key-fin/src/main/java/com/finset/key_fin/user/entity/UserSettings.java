package com.finset.key_fin.user.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.Objects;

@Getter
@Entity
@Table(name = "user_settings")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserSettings {

	@Id
	@Column(name = "user_id")
	private Long userId;

	@MapsId
	@OneToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Column(name = "budget_anchor_day", nullable = false)
	private int budgetAnchorDay = 1;

	private UserSettings(User user) {
		this.user = Objects.requireNonNull(user, "user must not be null");
	}

	public static UserSettings create(User user) {
		return new UserSettings(user);
	}
}

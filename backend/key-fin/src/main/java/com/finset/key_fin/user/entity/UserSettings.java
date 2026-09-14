package com.finset.key_fin.user.entity;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.user.exception.UserErrorCode;
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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

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

	@JdbcTypeCode(SqlTypes.TINYINT)
	@Column(name = "budget_anchor_day", nullable = false)
	private int budgetAnchorDay = 1;

	@Column(name = "transfer_consent", nullable = false)
	private boolean transferConsent = false;

	@Column(name = "transfer_limit_once")
	private Long transferLimitOnce;

	@Column(name = "transfer_limit_daily")
	private Long transferLimitDaily;

	private UserSettings(User user) {
		this.user = Objects.requireNonNull(user, "user must not be null");
	}

	public static UserSettings create(User user) {
		return new UserSettings(user);
	}

	public void updateTransferSettings(
			boolean transferConsent,
			Long transferLimitOnce,
			Long transferLimitDaily
	) {
		validateTransferLimit(transferLimitOnce);
		validateTransferLimit(transferLimitDaily);
		if (transferLimitOnce != null
				&& transferLimitDaily != null
				&& transferLimitDaily < transferLimitOnce) {
			throw new BusinessException(UserErrorCode.INVALID_TRANSFER_LIMIT);
		}

		this.transferConsent = transferConsent;
		this.transferLimitOnce = transferLimitOnce;
		this.transferLimitDaily = transferLimitDaily;
	}

	private static void validateTransferLimit(Long transferLimit) {
		if (transferLimit != null && transferLimit <= 0) {
			throw new BusinessException(UserErrorCode.INVALID_TRANSFER_LIMIT);
		}
	}
}

package com.finset.key_fin.transaction.entity;

import com.finset.key_fin.global.base.BaseEntity;
import com.finset.key_fin.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.LocalDateTime;
import java.util.Objects;

@Getter
@Entity
@Table(
		name = "transaction_polling_states",
		uniqueConstraints = @UniqueConstraint(
				name = "uq_transaction_polling_state",
				columnNames = {"user_id", "asset_type", "asset_id"}
		)
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TransactionPollingState extends BaseEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Enumerated(EnumType.STRING)
	@Column(name = "asset_type", nullable = false, length = 10)
	private TransactionAssetType assetType;

	@Column(name = "asset_id", nullable = false)
	private Long assetId;

	@Column(name = "last_polled_at")
	private LocalDateTime lastPolledAt;

	@Generated(event = {EventType.INSERT, EventType.UPDATE})
	@Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
	private LocalDateTime updatedAt;

	private TransactionPollingState(User user, TransactionAssetType assetType, Long assetId) {
		this.user = Objects.requireNonNull(user, "user must not be null");
		this.assetType = Objects.requireNonNull(assetType, "assetType must not be null");
		if (assetId == null || assetId <= 0) {
			throw new IllegalArgumentException("assetId must be positive");
		}
		this.assetId = assetId;
	}

	public static TransactionPollingState create(User user, TransactionAssetType assetType, Long assetId) {
		return new TransactionPollingState(user, assetType, assetId);
	}

	public void recordPollingSuccess(LocalDateTime polledAt) {
		this.lastPolledAt = Objects.requireNonNull(polledAt, "polledAt must not be null");
	}
}

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
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalTime;

@Getter
@Entity
@Table(name = "transactions")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Transaction extends BaseEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 10)
	private TransactionSource source;

	@Column(name = "fin_tx_unique_no", length = 20)
	private String finTransactionUniqueNo;

	@Enumerated(EnumType.STRING)
	@Column(name = "tx_type", nullable = false, length = 20)
	private TransactionType transactionType;

	@Column(name = "account_id")
	private Long accountId;

	@Column(name = "card_id")
	private Long cardId;

	@Column(name = "merchant_id")
	private Long merchantId;

	@Column(name = "merchant_name_raw", length = 100)
	private String merchantNameRaw;

	@Column(nullable = false)
	private Long amount;

	@Column(name = "tx_date", nullable = false)
	private LocalDate transactionDate;

	@Column(name = "tx_time", nullable = false)
	private LocalTime transactionTime;

	@Column(name = "subcategory_id")
	private Integer subcategoryId;

	@Enumerated(EnumType.STRING)
	@Column(name = "confirm_status", nullable = false, length = 20)
	private ConfirmStatus confirmStatus = ConfirmStatus.PENDING;

	@Enumerated(EnumType.STRING)
	@Column(name = "exclude_tag", nullable = false, length = 20)
	private ExcludeTag excludeTag = ExcludeTag.NONE;

	@Column(name = "adjusted_amount")
	private Long adjustedAmount;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false, length = 20)
	private TransactionStatus status = TransactionStatus.NORMAL;

	@Column(length = 255)
	private String memo;
}

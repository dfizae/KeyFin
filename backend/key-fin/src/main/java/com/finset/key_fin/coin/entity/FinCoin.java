package com.finset.key_fin.coin.entity;

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

@Getter
@Entity
@Table(name = "fin_coin")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FinCoin extends BaseEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Column(nullable = false)
	private Integer delta;

	@Column(name = "balance_after", nullable = false)
	private Integer balanceAfter;

	@Enumerated(EnumType.STRING)
	@Column(name = "reason_code", nullable = false, length = 20)
	private CoinReason reasonCode;

	@Column(name = "grant_date", nullable = false)
	private LocalDate grantDate;

	@Column(name = "ref_id", length = 30)
	private String refId;
}

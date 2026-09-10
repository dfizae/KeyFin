package com.finset.key_fin.card.entity;

import com.finset.key_fin.account.entity.Account;
import com.finset.key_fin.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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
import org.hibernate.annotations.Generated;
import org.hibernate.generator.EventType;

import java.time.LocalDateTime;
import java.util.Objects;

@Getter
@Entity
@Table(name = "cards")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Card {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Column(name = "fin_card_no_enc", nullable = false, length = 255)
	private String finCardNo;

	@Column(nullable = false, length = 3)
	private String cvc;

	@Column(name = "issuer_code", nullable = false, length = 4)
	private String issuerCode;

	@Column(name = "card_name", nullable = false, length = 100)
	private String cardName;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "withdrawal_account_id")
	private Account withdrawalAccount;

	@Column(name = "is_managed", nullable = false)
	private boolean managed = true;

	@Generated(event = EventType.INSERT)
	@Column(name = "linked_at", nullable = false, insertable = false, updatable = false)
	private LocalDateTime linkedAt;

	private Card(
			User user,
			String finCardNo,
			String cvc,
			String issuerCode,
			String cardName,
			Account withdrawalAccount
	) {
		this.user = Objects.requireNonNull(user, "user must not be null");
		this.finCardNo = requireText(finCardNo, "finCardNo");
		this.cvc = requireText(cvc, "cvc");
		this.issuerCode = requireText(issuerCode, "issuerCode");
		this.cardName = requireText(cardName, "cardName");
		this.withdrawalAccount = withdrawalAccount;
	}

	public static Card link(
			User user,
			String finCardNo,
			String cvc,
			String issuerCode,
			String cardName,
			Account withdrawalAccount
	) {
		return new Card(user, finCardNo, cvc, issuerCode, cardName, withdrawalAccount);
	}

	private static String requireText(String value, String name) {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException(name + " must not be blank");
		}
		return value;
	}
}

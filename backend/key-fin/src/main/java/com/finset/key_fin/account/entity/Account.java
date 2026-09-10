package com.finset.key_fin.account.entity;

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
@Table(name = "accounts")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Account {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "user_id", nullable = false)
	private User user;

	@Column(name = "fin_account_no", nullable = false, length = 16)
	private String finAccountNo;

	@Column(name = "bank_code", nullable = false, length = 3)
	private String bankCode;

	@Column(length = 30)
	private String alias;

	@Column(name = "is_managed", nullable = false)
	private boolean managed = true;

	@Column(name = "is_income", nullable = false)
	private boolean income = false;

	@Generated(event = EventType.INSERT)
	@Column(name = "linked_at", nullable = false, insertable = false, updatable = false)
	private LocalDateTime linkedAt;

	private Account(User user, String finAccountNo, String bankCode) {
		this.user = Objects.requireNonNull(user, "user must not be null");
		this.finAccountNo = requireText(finAccountNo, "finAccountNo");
		this.bankCode = requireText(bankCode, "bankCode");
	}

	public static Account link(User user, String finAccountNo, String bankCode) {
		return new Account(user, finAccountNo, bankCode);
	}

	public boolean relink() {
		if (managed) {
			return false;
		}
		managed = true;
		return true;
	}

	public void unlink() {
		managed = false;
		income = false;
	}

	private static String requireText(String value, String name) {
		if (value == null || value.isBlank()) {
			throw new IllegalArgumentException(name + " must not be blank");
		}
		return value;
	}
}

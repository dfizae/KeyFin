package com.finset.key_fin.user.entity;

import com.finset.key_fin.global.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Objects;

@Getter
@Entity
@Table(name = "users")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseEntity {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@Column(nullable = false, unique = true, length = 100)
	private String email;

	@Column(nullable = false, length = 255)
	private String password;

	@Column(nullable = false, length = 30)
	private String name;

	@Column(name = "fin_user_key", nullable = false, length = 60)
	private String finUserKey;

	@Column(name = "deleted_at")
	private LocalDateTime deletedAt;

	private User(String email, String password, String name, String finUserKey) {
		this.email = Objects.requireNonNull(email, "email must not be null");
		this.password = Objects.requireNonNull(password, "password must not be null");
		this.name = Objects.requireNonNull(name, "name must not be null");
		this.finUserKey = Objects.requireNonNull(finUserKey, "finUserKey must not be null");
	}

	public static User create(String email, String password, String name, String finUserKey) {
		return new User(email, password, name, finUserKey);
	}

	public boolean isDeleted() {
		return deletedAt != null;
	}
}
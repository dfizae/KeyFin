package com.finset.key_fin.account.repository;

import com.finset.key_fin.account.entity.Account;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AccountRepository extends JpaRepository<Account, Long> {

	List<Account> findAllByUserId(Long userId);

	Optional<Account> findByIdAndUserId(Long id, Long userId);
}

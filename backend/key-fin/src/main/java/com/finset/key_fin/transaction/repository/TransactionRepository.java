package com.finset.key_fin.transaction.repository;

import com.finset.key_fin.transaction.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

	Optional<Transaction> findByIdAndUserId(Long id, Long userId);
}

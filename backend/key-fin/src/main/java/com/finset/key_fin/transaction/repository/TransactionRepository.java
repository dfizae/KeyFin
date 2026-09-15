package com.finset.key_fin.transaction.repository;

import com.finset.key_fin.transaction.entity.ConfirmStatus;
import com.finset.key_fin.transaction.entity.ExcludeTag;
import com.finset.key_fin.transaction.entity.Transaction;
import com.finset.key_fin.transaction.entity.TransactionStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collection;
import java.util.Optional;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

	Optional<Transaction> findByIdAndUserId(Long id, Long userId);

	boolean existsByUserIdAndFinTransactionUniqueNo(Long userId, String finTransactionUniqueNo);

	Optional<Transaction> findFirstByUserIdAndAccountIdAndTransactionDateAndTransactionTimeAndAmountAndStatusAndExcludeTagNotAndConfirmStatusInOrderByIdDesc(
			Long userId,
			Long accountId,
			LocalDate transactionDate,
			LocalTime transactionTime,
			Long amount,
			TransactionStatus status,
			ExcludeTag excludeTag,
			Collection<ConfirmStatus> confirmStatuses
	);
}

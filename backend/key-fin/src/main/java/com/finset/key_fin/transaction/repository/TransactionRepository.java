package com.finset.key_fin.transaction.repository;

import com.finset.key_fin.transaction.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

	Optional<Transaction> findByIdAndUserId(Long id, Long userId);

	@Query("""
			select coalesce(sum(t.amount), 0) from Transaction t
			where t.cardId = :cardId
			  and t.source = com.finset.key_fin.transaction.entity.TransactionSource.LIVE
			  and t.transactionType = com.finset.key_fin.transaction.entity.TransactionType.CARD
			  and t.status = com.finset.key_fin.transaction.entity.TransactionStatus.NORMAL
			  and t.transactionDate between :from and :to
			""")
	long sumLiveCardApprovals(@Param("cardId") Long cardId, @Param("from") LocalDate from, @Param("to") LocalDate to);
}

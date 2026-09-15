package com.finset.key_fin.payment.repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import com.finset.key_fin.payment.entity.PrepareTransfer;
import com.finset.key_fin.payment.entity.TransferStatus;

public interface PrepareTransferRepository extends JpaRepository<PrepareTransfer, Long> {

	List<PrepareTransfer> findAllByUserIdOrderByIdDesc(Long userId);

	List<PrepareTransfer> findAllByUserIdAndStatusOrderByIdDesc(Long userId, TransferStatus status);

	Optional<PrepareTransfer> findByIdAndUserId(Long id, Long userId);

	List<PrepareTransfer> findAllByUserIdAndStatusIn(Long userId, Collection<TransferStatus> statuses);

	@Query("""
			select coalesce(sum(t.requiredAmount), 0) from PrepareTransfer t
			where t.userId = :userId
			  and t.status = com.finset.key_fin.payment.entity.TransferStatus.EXECUTED
			  and t.executedAt >= :from and t.executedAt < :to
			""")
	long sumExecutedAmount(@Param("userId") Long userId, @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

	List<PrepareTransfer> findAllByStatusAndDueDateBefore(TransferStatus status, LocalDate date);
}

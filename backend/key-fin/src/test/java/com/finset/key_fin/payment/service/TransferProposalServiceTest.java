package com.finset.key_fin.payment.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.context.jdbc.SqlConfig;
import org.springframework.transaction.annotation.Transactional;
import com.finset.key_fin.payment.entity.AuditLog;
import com.finset.key_fin.payment.entity.AuditLog.AuditAction;
import com.finset.key_fin.payment.entity.PrepareTransfer;
import com.finset.key_fin.payment.entity.TransferStatus;
import com.finset.key_fin.payment.repository.AuditLogRepository;
import com.finset.key_fin.payment.repository.PrepareTransferRepository;
import com.finset.key_fin.payment.service.TransferProposalService.ProposalResult;
import com.finset.key_fin.support.FixedClockConfig;
import com.finset.key_fin.support.SpringIntegrationTestSupport;

@Transactional
@Import(FixedClockConfig.class)
@Sql(scripts = "/sql/transfer-proposal-fixture.sql", config = @SqlConfig(encoding = "UTF-8"))
class TransferProposalServiceTest extends SpringIntegrationTestSupport {

	private static final long USER = 986L;

	@Autowired
	private TransferProposalService transferProposalService;
	@Autowired
	private PrepareTransferRepository prepareTransferRepository;
	@Autowired
	private AuditLogRepository auditLogRepository;

	@Test
	@DisplayName("오늘·내일 출금 중 부족한 건만 제안: 기존 제안은 금액 갱신, 취소됐던 카드 청구는 재개, 준비된 건·만료 건은 취소, 실행된 건은 불변")
	void proposesForShortagesInWindow() {
		ProposalResult result = transferProposalService.propose(USER);

		assertThat(result.incomeAccountFound()).isTrue();
		assertThat(result.created()).isEqualTo(1);
		assertThat(result.updated()).isEqualTo(1);
		assertThat(result.canceled()).isEqualTo(2);

		PrepareTransfer academy = prepareTransferRepository.findById(9901L).orElseThrow();
		assertThat(academy.getStatus()).isEqualTo(TransferStatus.PROPOSED);
		assertThat(academy.getRequiredAmount()).isEqualTo(50000L);

		PrepareTransfer insurance = prepareTransferRepository.findById(9902L).orElseThrow();
		assertThat(insurance.getStatus()).isEqualTo(TransferStatus.CANCELED);
		assertThat(insurance.getFailReason()).isEqualTo(TransferProposalService.REASON_RESOLVED);

		PrepareTransfer expired = prepareTransferRepository.findById(9903L).orElseThrow();
		assertThat(expired.getStatus()).isEqualTo(TransferStatus.CANCELED);
		assertThat(expired.getFailReason()).isEqualTo(TransferProposalService.REASON_EXPIRED);

		assertThat(prepareTransferRepository.findById(9904L).orElseThrow().getStatus()).isEqualTo(TransferStatus.EXECUTED);

		List<PrepareTransfer> open = prepareTransferRepository.findAllByUserIdAndStatusOrderByIdDesc(USER, TransferStatus.PROPOSED);
		assertThat(open).hasSize(2);
		PrepareTransfer cardBill = open.stream().filter(t -> t.getCardBillingId() != null).findFirst().orElseThrow();
		assertThat(cardBill.getId()).isEqualTo(9905L);
		assertThat(cardBill.getCardBillingId()).isEqualTo(9802L);
		assertThat(cardBill.getScheduledDate()).isEqualTo(LocalDate.of(2026, 9, 10));
		assertThat(cardBill.getDueDate()).isEqualTo(LocalDate.of(2026, 9, 10));
		assertThat(cardBill.getRequiredAmount()).isEqualTo(80000L);
		assertThat(cardBill.getFailReason()).isNull();
		assertThat(academy.getScheduledDate()).isEqualTo(LocalDate.of(2026, 9, 9));
		assertThat(academy.getDueDate()).isEqualTo(LocalDate.of(2026, 9, 10));
		assertThat(cardBill.getFromAccountId()).isEqualTo(9506L);
		assertThat(cardBill.getToAccountId()).isEqualTo(9504L);

		List<AuditLog> logs = auditLogRepository.findAll();
		assertThat(logs).extracting(AuditLog::getAction).containsOnly(AuditAction.CANCEL);
		assertThat(logs).extracting(AuditLog::getTargetId).containsExactlyInAnyOrder("9902", "9903");
	}

	@Test
	@DisplayName("두 번 돌려도 같은 결과 — 제안이 늘지 않는다")
	void idempotentOnRerun() {
		transferProposalService.propose(USER);
		ProposalResult second = transferProposalService.propose(USER);

		assertThat(second.created()).isZero();
		assertThat(second.updated()).isZero();
		assertThat(second.canceled()).isZero();
		assertThat(prepareTransferRepository.findAllByUserIdAndStatusOrderByIdDesc(USER, TransferStatus.PROPOSED)).hasSize(2);
	}

	@Test
	@DisplayName("수입 계좌가 없는 사용자는 제안하지 않는다(만료 정리만)")
	void skipsWithoutIncomeAccount() {
		ProposalResult result = transferProposalService.propose(985L);

		assertThat(result.incomeAccountFound()).isFalse();
		assertThat(result.created()).isZero();
		assertThat(prepareTransferRepository.findAllByUserIdOrderByIdDesc(985L)).isEmpty();
	}
}

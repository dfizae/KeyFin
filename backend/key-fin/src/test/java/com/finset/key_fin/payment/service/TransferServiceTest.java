package com.finset.key_fin.payment.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.jdbc.Sql;
import org.springframework.test.context.jdbc.SqlConfig;
import org.springframework.transaction.annotation.Transactional;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.payment.client.FinanceTransferClient;
import com.finset.key_fin.payment.dto.response.FinanceTransferResult;
import com.finset.key_fin.payment.dto.response.FinanceTransferResult.Status;
import com.finset.key_fin.payment.dto.response.PaymentCalendarResponse.CalendarItemType;
import com.finset.key_fin.payment.dto.response.TransferApproveResponse;
import com.finset.key_fin.payment.dto.response.TransferResponse;
import com.finset.key_fin.payment.entity.AuditLog;
import com.finset.key_fin.payment.entity.AuditLog.AuditAction;
import com.finset.key_fin.payment.entity.PrepareTransfer;
import com.finset.key_fin.payment.entity.TransferStatus;
import com.finset.key_fin.payment.exception.PaymentErrorCode;
import com.finset.key_fin.payment.repository.AuditLogRepository;
import com.finset.key_fin.payment.repository.PrepareTransferRepository;
import com.finset.key_fin.support.FixedClockConfig;
import com.finset.key_fin.support.SpringIntegrationTestSupport;

@Transactional
@Import(FixedClockConfig.class)
@Sql(scripts = "/sql/transfer-approve-fixture.sql", config = @SqlConfig(encoding = "UTF-8"))
class TransferServiceTest extends SpringIntegrationTestSupport {

	private static final long USER = 986L;
	private static final String USER_KEY = "test-user-key-986";
	private static final String INCOME_NO = "0019860000000006";
	private static final String LIVING_NO = "0019860000000001";

	@Autowired
	private TransferService transferService;
	@Autowired
	private PrepareTransferRepository prepareTransferRepository;
	@Autowired
	private AuditLogRepository auditLogRepository;
	@MockitoBean
	private FinanceTransferClient financeTransferClient;

	@Test
	@DisplayName("승인: 4검사 통과 → 번호 채번·APPROVED → 금융망 이체(수입→출금 계좌) → EXECUTED + EXECUTE 감사")
	void approvesAndExecutes() {
		when(financeTransferClient.transfer(eq(USER_KEY), anyString(), eq(INCOME_NO), eq(LIVING_NO), eq(230000L), eq("KeyFin 결제 준비 - 월세")))
				.thenReturn(FinanceTransferResult.EXECUTED);

		TransferApproveResponse response = transferService.approve(USER, 9901L);

		assertThat(response.status()).isEqualTo(TransferStatus.EXECUTED);
		assertThat(response.executedAt()).isNotNull();
		PrepareTransfer transfer = prepareTransferRepository.findById(9901L).orElseThrow();
		assertThat(transfer.getStatus()).isEqualTo(TransferStatus.EXECUTED);
		assertThat(transfer.getInstitutionTxNo()).hasSize(20);
		assertThat(auditOf(9901L)).extracting(AuditLog::getAction).containsExactly(AuditAction.EXECUTE);
	}

	@Test
	@DisplayName("동의 OFF → 403 PAY_007, 이체 호출 없음, HOLD 감사, 상태는 PROPOSED 유지")
	void holdsWhenConsentOff() {
		assertThatThrownBy(() -> transferService.approve(987L, 9907L))
				.isInstanceOf(BusinessException.class)
				.extracting(e -> ((BusinessException) e).getErrorCode())
				.isEqualTo(PaymentErrorCode.TRANSFER_CONSENT_OFF);

		verify(financeTransferClient, never()).transfer(any(), any(), any(), any(), anyLong(), any());
		assertThat(prepareTransferRepository.findById(9907L).orElseThrow().isProposed()).isTrue();
		assertThat(auditOf(9907L)).extracting(AuditLog::getAction).containsExactly(AuditAction.HOLD);
	}

	@Test
	@DisplayName("1회 한도 초과 → PAY_008, 1일 한도(오늘 실행 550,000 + 300,000 > 800,000) → PAY_009, 출금 계좌 부적격 → PAY_010")
	void holdsOnLimitsAndAccount() {
		assertThatThrownBy(() -> transferService.approve(USER, 9902L))
				.extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(PaymentErrorCode.TRANSFER_LIMIT_ONCE);
		assertThatThrownBy(() -> transferService.approve(USER, 9903L))
				.extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(PaymentErrorCode.TRANSFER_LIMIT_DAILY);
		assertThatThrownBy(() -> transferService.approve(988L, 9908L))
				.extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(PaymentErrorCode.TRANSFER_ACCOUNT_INELIGIBLE);

		verify(financeTransferClient, never()).transfer(any(), any(), any(), any(), anyLong(), any());
		assertThat(auditOf(9902L)).hasSize(1);
		assertThat(auditOf(9903L)).extracting(AuditLog::getBasis).singleElement().asString().contains("550000");
	}

	@Test
	@DisplayName("금융망 잔액 부족(A1014) → FAILED + FAIL 감사 + 422 PAY_011")
	void failsOnInsufficientBalance() {
		when(financeTransferClient.transfer(any(), any(), any(), any(), anyLong(), any()))
				.thenReturn(new FinanceTransferResult(Status.INSUFFICIENT_BALANCE, "A1014"));

		assertThatThrownBy(() -> transferService.approve(USER, 9901L))
				.extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(PaymentErrorCode.TRANSFER_INSUFFICIENT_BALANCE);

		PrepareTransfer transfer = prepareTransferRepository.findById(9901L).orElseThrow();
		assertThat(transfer.getStatus()).isEqualTo(TransferStatus.FAILED);
		assertThat(transfer.getFailReason()).startsWith("A1014");
		assertThat(auditOf(9901L)).extracting(AuditLog::getAction).containsExactly(AuditAction.FAIL);
	}

	@Test
	@DisplayName("APPROVED로 남은 건(응답 유실)은 검사 없이 같은 기관거래고유번호로 재시도, H1007이면 EXECUTED")
	void recoversApprovedWithSameTransactionNo() {
		when(financeTransferClient.transfer(eq(USER_KEY), eq("20260901083000000009"), eq(INCOME_NO), eq(LIVING_NO), eq(120000L), any()))
				.thenReturn(FinanceTransferResult.ALREADY_PROCESSED);

		TransferApproveResponse response = transferService.approve(USER, 9905L);

		assertThat(response.status()).isEqualTo(TransferStatus.EXECUTED);
		assertThat(prepareTransferRepository.findById(9905L).orElseThrow().getInstitutionTxNo()).isEqualTo("20260901083000000009");
		assertThat(auditOf(9905L)).extracting(AuditLog::getBasis).singleElement().asString().contains("H1007");
	}

	@Test
	@DisplayName("실행·실패로 끝난 건은 409, 남의 제안은 404")
	void rejectsWrongStateOrOwner() {
		assertThatThrownBy(() -> transferService.approve(USER, 9909L))
				.extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(PaymentErrorCode.TRANSFER_NOT_PROPOSED);
		assertThatThrownBy(() -> transferService.approve(USER, 9907L))
				.extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(PaymentErrorCode.TRANSFER_NOT_FOUND);
	}

	@Test
	@DisplayName("보류: 상태는 PROPOSED 그대로, HOLD 감사만 남는다. 실행된 건은 409")
	void postponeLeavesAuditOnly() {
		transferService.postpone(USER, 9901L);

		assertThat(prepareTransferRepository.findById(9901L).orElseThrow().isProposed()).isTrue();
		assertThat(auditOf(9901L)).extracting(AuditLog::getBasis).singleElement().asString().startsWith(TransferService.POSTPONE_BASIS);
		assertThatThrownBy(() -> transferService.postpone(USER, 9904L))
				.extracting(e -> ((BusinessException) e).getErrorCode()).isEqualTo(PaymentErrorCode.TRANSFER_NOT_PROPOSED);
	}

	@Test
	@DisplayName("목록: 상태 필터는 선택, 없으면 전체 최신순. 목적 이름은 고정지출 이름 또는 카드명")
	void listsWithOptionalFilter() {
		List<TransferResponse> proposed = transferService.list(USER, TransferStatus.PROPOSED);
		assertThat(proposed).extracting(TransferResponse::id).containsExactly(9903L, 9902L, 9901L);
		assertThat(proposed.get(0).purpose().type()).isEqualTo(CalendarItemType.CARD_BILL);
		assertThat(proposed.get(0).purpose().name()).isEqualTo("신한 테스트카드");
		assertThat(proposed.get(2).purpose().name()).isEqualTo("월세");

		List<TransferResponse> all = transferService.list(USER, null);
		assertThat(all).hasSize(7);
		assertThat(all.get(0).id()).isEqualTo(9909L);
	}

	private List<AuditLog> auditOf(long transferId) {
		return auditLogRepository.findAllByTargetTypeAndTargetIdOrderByIdAsc(AuditLog.TARGET_PREPARE_TRANSFER, String.valueOf(transferId));
	}
}

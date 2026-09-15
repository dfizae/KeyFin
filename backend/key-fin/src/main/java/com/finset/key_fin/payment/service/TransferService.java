package com.finset.key_fin.payment.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.finset.key_fin.account.entity.Account;
import com.finset.key_fin.account.repository.AccountRepository;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.global.finance.client.FinanceHeaderFactory;
import com.finset.key_fin.payment.client.FinanceTransferClient;
import com.finset.key_fin.payment.dto.response.FinanceTransferResult;
import com.finset.key_fin.payment.dto.response.TransferApproveResponse;
import com.finset.key_fin.payment.dto.response.TransferResponse;
import com.finset.key_fin.payment.entity.AuditLog;
import com.finset.key_fin.payment.entity.AuditLog.AuditAction;
import com.finset.key_fin.payment.entity.PrepareTransfer;
import com.finset.key_fin.payment.entity.TransferStatus;
import com.finset.key_fin.payment.exception.PaymentErrorCode;
import com.finset.key_fin.payment.repository.AuditLogRepository;
import com.finset.key_fin.payment.repository.PrepareTransferRepository;
import com.finset.key_fin.payment.service.TransferWriter.ApprovalContext;
import com.finset.key_fin.user.entity.UserSettings;
import com.finset.key_fin.user.exception.UserErrorCode;
import com.finset.key_fin.user.repository.UserSettingsRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class TransferService {

	static final String SUMMARY_PREFIX = "KeyFin 결제 준비 - ";
	static final String POSTPONE_BASIS = "사용자 보류(나중에)";

	private final PrepareTransferRepository prepareTransferRepository;
	private final UserSettingsRepository userSettingsRepository;
	private final AccountRepository accountRepository;
	private final AuditLogRepository auditLogRepository;
	private final TransferPurposeResolver purposeResolver;
	private final TransferWriter writer;
	private final FinanceTransferClient financeTransferClient;
	private final FinanceHeaderFactory headerFactory;
	private final Clock clock;

	@Transactional(readOnly = true)
	public List<TransferResponse> list(long userId, TransferStatus status) {
		List<PrepareTransfer> transfers = status == null
				? prepareTransferRepository.findAllByUserIdOrderByIdDesc(userId)
				: prepareTransferRepository.findAllByUserIdAndStatusOrderByIdDesc(userId, status);
		Map<Long, String> names = purposeResolver.namesOf(transfers);
		return transfers.stream().map(t -> TransferResponse.of(t, names.get(t.getId()))).toList();
	}

	/** 트랜잭션 없음 — APPROVED 커밋 후 금융망 이체, 응답 유실 시 같은 기관거래고유번호로 재시도하기 위해. */
	public TransferApproveResponse approve(long userId, long transferId) {
		ApprovalContext ctx = writer.load(userId, transferId);
		String institutionTxNo = ctx.institutionTxNo();
		if (ctx.status() == TransferStatus.PROPOSED) {
			checkSafeguards(ctx);
			institutionTxNo = headerFactory.newTransactionUniqueNo();
			writer.approve(userId, transferId, institutionTxNo);
		}
		FinanceTransferResult result = financeTransferClient.transfer(
				ctx.userKey(), institutionTxNo, ctx.fromAccountNo(), ctx.toAccountNo(), ctx.amount(),
				SUMMARY_PREFIX + ctx.purposeName());
		TransferApproveResponse response = writer.complete(userId, transferId, result, LocalDateTime.now(clock));
		if (!result.isSuccess()) {
			throw new BusinessException(result.status() == FinanceTransferResult.Status.INSUFFICIENT_BALANCE
					? PaymentErrorCode.TRANSFER_INSUFFICIENT_BALANCE
					: PaymentErrorCode.TRANSFER_BANK_LIMIT);
		}
		return response;
	}

	@Transactional
	public void postpone(long userId, long transferId) {
		PrepareTransfer transfer = prepareTransferRepository.findByIdAndUserId(transferId, userId)
				.orElseThrow(() -> new BusinessException(PaymentErrorCode.TRANSFER_NOT_FOUND));
		if (!transfer.isProposed()) {
			throw new BusinessException(PaymentErrorCode.TRANSFER_NOT_PROPOSED);
		}
		auditLogRepository.save(AuditLog.transfer(userId, AuditAction.HOLD, transferId,
				POSTPONE_BASIS + " — 출금일 " + transfer.getDueDate() + ", 제안액 " + transfer.getRequiredAmount()));
	}

	private void checkSafeguards(ApprovalContext ctx) {
		UserSettings settings = userSettingsRepository.findById(ctx.userId())
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_SETTINGS_NOT_FOUND));
		if (!settings.isTransferConsent()) {
			hold(ctx, PaymentErrorCode.TRANSFER_CONSENT_OFF, "transfer_consent=false");
		}
		if (settings.getTransferLimitOnce() != null && ctx.amount() > settings.getTransferLimitOnce()) {
			hold(ctx, PaymentErrorCode.TRANSFER_LIMIT_ONCE,
					"금액 " + ctx.amount() + " > 1회 한도 " + settings.getTransferLimitOnce());
		}
		if (settings.getTransferLimitDaily() != null) {
			LocalDate today = LocalDate.now(clock);
			long executedToday = prepareTransferRepository.sumExecutedAmount(
					ctx.userId(), today.atStartOfDay(), today.plusDays(1).atStartOfDay());
			if (executedToday + ctx.amount() > settings.getTransferLimitDaily()) {
				hold(ctx, PaymentErrorCode.TRANSFER_LIMIT_DAILY,
						"오늘 실행 " + executedToday + " + 금액 " + ctx.amount() + " > 1일 한도 " + settings.getTransferLimitDaily());
			}
		}
		Account from = accountRepository.findByIdAndUserId(ctx.fromAccountId(), ctx.userId()).orElse(null);
		if (from == null || !from.isIncome() || !from.isManaged()) {
			hold(ctx, PaymentErrorCode.TRANSFER_ACCOUNT_INELIGIBLE,
					"출금 계좌 " + ctx.fromAccountId() + " 수입·관리 대상 아님");
		}
	}

	private void hold(ApprovalContext ctx, PaymentErrorCode code, String detail) {
		writer.hold(ctx.userId(), ctx.transferId(), code.getCode() + " " + code.getMessage() + " — " + detail);
		throw new BusinessException(code);
	}
}

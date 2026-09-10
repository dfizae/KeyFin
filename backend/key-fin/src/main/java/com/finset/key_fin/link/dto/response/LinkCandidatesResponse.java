package com.finset.key_fin.link.dto.response;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record LinkCandidatesResponse(
		@Schema(description = "금융망 수시입출금 계좌 후보")
		List<AccountCandidate> accounts,
		@Schema(description = "금융망 카드 후보")
		List<CardCandidate> cards
) {

	public record AccountCandidate(
			@Schema(description = "금융망 계좌번호", example = "0010011073486799")
			String finAccountNo,
			@Schema(description = "은행 코드", example = "001")
			String bankCode,
			@Schema(description = "은행명", example = "한국은행")
			String bankName,
			@Schema(description = "계좌 잔액(원)", example = "1500000")
			Long balance,
			@Schema(description = "KeyFin 연결 여부", example = "false")
			boolean linked
	) {
	}

	public record CardCandidate(
			@Schema(description = "카드번호", example = "1003198565339181")
			String cardNo,
			@Schema(description = "카드사명", example = "롯데카드")
			String issuerName,
			@Schema(description = "카드명", example = "디지로카 SEOUL")
			String cardName,
			@Schema(description = "청구 출금 계좌번호", example = "0323555042323510")
			String withdrawalAccountNo,
			@Schema(description = "KeyFin 연결 여부", example = "true")
			boolean linked
	) {
	}
}

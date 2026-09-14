package com.finset.key_fin.transaction.controller;

import com.finset.key_fin.global.base.BaseResponse;
import com.finset.key_fin.transaction.dto.response.TransactionListResponse;
import com.finset.key_fin.transaction.service.TransactionService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.http.MediaType.APPLICATION_JSON_VALUE;

@RestController
@RequestMapping("/api/v1/transactions")
@RequiredArgsConstructor
public class TransactionController implements TransactionControllerDocs {

	private final TransactionService transactionService;

	@GetMapping(produces = APPLICATION_JSON_VALUE)
	@Override
	public BaseResponse<TransactionListResponse> getTransactions(
			@AuthenticationPrincipal Long userId,
			@RequestParam(required = false) String month,
			@RequestParam(required = false) Integer envelopeId,
			@RequestParam(required = false) Integer subcategoryId,
			@RequestParam(required = false) Long accountId,
			@RequestParam(required = false) Long cardId,
			@RequestParam(required = false) Long cursor,
			@RequestParam(required = false) Integer size
	) {
		return BaseResponse.ok(transactionService.getTransactions(
				userId, month, envelopeId, subcategoryId, accountId, cardId, cursor, size
		));
	}
}

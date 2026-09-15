package com.finset.key_fin.payment.controller;

import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.finset.key_fin.global.base.BaseResponse;
import com.finset.key_fin.payment.dto.response.TransferApproveResponse;
import com.finset.key_fin.payment.dto.response.TransferResponse;
import com.finset.key_fin.payment.entity.TransferStatus;
import com.finset.key_fin.payment.service.TransferService;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/transfers")
@RequiredArgsConstructor
public class TransferController implements TransferControllerDocs {

	private final TransferService transferService;

	@GetMapping
	@Override
	public BaseResponse<List<TransferResponse>> list(
			@AuthenticationPrincipal Long userId,
			@RequestParam(required = false) TransferStatus status
	) {
		return BaseResponse.ok(transferService.list(userId, status));
	}

	@PostMapping("/{transferId}/approve")
	@Override
	public BaseResponse<TransferApproveResponse> approve(
			@AuthenticationPrincipal Long userId,
			@PathVariable long transferId
	) {
		return BaseResponse.ok(transferService.approve(userId, transferId));
	}

	@PostMapping("/{transferId}/postpone")
	@Override
	public BaseResponse<Void> postpone(
			@AuthenticationPrincipal Long userId,
			@PathVariable long transferId
	) {
		transferService.postpone(userId, transferId);
		return BaseResponse.ok();
	}
}

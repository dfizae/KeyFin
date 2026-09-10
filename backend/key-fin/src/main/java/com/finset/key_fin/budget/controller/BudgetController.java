package com.finset.key_fin.budget.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.finset.key_fin.budget.dto.response.BudgetProposalResponse;
import com.finset.key_fin.budget.service.BudgetService;
import com.finset.key_fin.global.base.BaseResponse;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/budgets")
@RequiredArgsConstructor
public class BudgetController implements BudgetControllerDocs {

	private final BudgetService budgetService;

	@PostMapping("/proposals")
	@Override
	public BaseResponse<BudgetProposalResponse> propose(@AuthenticationPrincipal Long userId) {
		return BaseResponse.ok(budgetService.propose(userId));
	}
}

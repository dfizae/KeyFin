package com.finset.key_fin.link.service;

import com.finset.key_fin.account.entity.Account;
import com.finset.key_fin.account.repository.AccountRepository;
import com.finset.key_fin.card.entity.Card;
import com.finset.key_fin.card.repository.CardRepository;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.link.client.FinanceAccountClient;
import com.finset.key_fin.link.client.FinanceCardClient;
import com.finset.key_fin.link.dto.response.FinanceAccount;
import com.finset.key_fin.link.dto.response.FinanceCard;
import com.finset.key_fin.link.dto.response.LinkCandidatesResponse;
import com.finset.key_fin.link.dto.response.LinkCandidatesResponse.AccountCandidate;
import com.finset.key_fin.link.dto.response.LinkCandidatesResponse.CardCandidate;
import com.finset.key_fin.link.exception.LinkErrorCode;
import com.finset.key_fin.user.entity.User;
import com.finset.key_fin.user.exception.UserErrorCode;
import com.finset.key_fin.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LinkCandidateService {

	private final UserRepository userRepository;
	private final AccountRepository accountRepository;
	private final CardRepository cardRepository;
	private final FinanceAccountClient financeAccountClient;
	private final FinanceCardClient financeCardClient;

	public LinkCandidatesResponse getCandidates(long userId) {
		User user = userRepository.findByIdAndDeletedAtIsNull(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
		if (!user.isFinanceConnected()) {
			throw new BusinessException(LinkErrorCode.FINANCE_NOT_CONNECTED);
		}

		List<FinanceAccount> financeAccounts = financeAccountClient.findAccounts(user.getFinUserKey());
		List<FinanceCard> financeCards = financeCardClient.findCards(user.getFinUserKey());

		Map<String, Long> linkedAccountIds = accountRepository.findAllByUserId(userId).stream()
				.filter(Account::isManaged)
				.collect(Collectors.toMap(Account::getFinAccountNo, Account::getId));
		Map<String, Long> linkedCardIds = cardRepository.findAllByUserId(userId).stream()
				.filter(Card::isManaged)
				.collect(Collectors.toMap(Card::getFinCardNo, Card::getId));

		List<AccountCandidate> accounts = financeAccounts.stream()
				.filter(FinanceAccount::isDemandDeposit)
				.map(account -> {
					Long linkedId = linkedAccountIds.get(account.accountNo());
					return new AccountCandidate(
							account.accountNo(),
							account.bankCode(),
							account.bankName(),
							account.accountBalance(),
							linkedId != null,
							linkedId
					);
				})
				.toList();
		List<CardCandidate> cards = financeCards.stream()
				.map(card -> {
					Long linkedId = linkedCardIds.get(card.cardNo());
					return new CardCandidate(
							card.cardNo(),
							card.cardIssuerName(),
							card.cardName(),
							card.withdrawalAccountNo(),
							linkedId != null,
							linkedId
					);
				})
				.toList();

		return new LinkCandidatesResponse(accounts, cards);
	}
}

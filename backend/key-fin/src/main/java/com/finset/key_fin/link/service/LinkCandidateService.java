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
import java.util.Set;
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

		Set<String> linkedAccountNos = accountRepository.findAllByUserId(userId).stream()
				.filter(Account::isManaged)
				.map(Account::getFinAccountNo)
				.collect(Collectors.toSet());
		Set<String> linkedCardNos = cardRepository.findAllByUserId(userId).stream()
				.filter(Card::isManaged)
				.map(Card::getFinCardNo)
				.collect(Collectors.toSet());

		List<AccountCandidate> accounts = financeAccounts.stream()
				.filter(FinanceAccount::isDemandDeposit)
				.map(account -> new AccountCandidate(
						account.accountNo(),
						account.bankCode(),
						account.bankName(),
						account.accountBalance(),
						linkedAccountNos.contains(account.accountNo())
				))
				.toList();
		List<CardCandidate> cards = financeCards.stream()
				.map(card -> new CardCandidate(
						card.cardNo(),
						card.cardIssuerName(),
						card.cardName(),
						card.withdrawalAccountNo(),
						linkedCardNos.contains(card.cardNo())
				))
				.toList();

		return new LinkCandidatesResponse(accounts, cards);
	}
}

package com.finset.key_fin.link.service;

import com.finset.key_fin.account.entity.Account;
import com.finset.key_fin.account.repository.AccountRepository;
import com.finset.key_fin.card.entity.Card;
import com.finset.key_fin.card.repository.CardRepository;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.link.dto.response.FinanceAccount;
import com.finset.key_fin.link.dto.response.FinanceCard;
import com.finset.key_fin.link.dto.response.LinkAssetsResponse;
import com.finset.key_fin.link.exception.LinkErrorCode;
import com.finset.key_fin.user.entity.User;
import com.finset.key_fin.user.exception.UserErrorCode;
import com.finset.key_fin.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LinkAssetWriter {

	private final UserRepository userRepository;
	private final AccountRepository accountRepository;
	private final CardRepository cardRepository;

	@Transactional
	public LinkAssetsResponse link(long userId, List<FinanceAccount> accounts, List<FinanceCard> cards) {
		User user = userRepository.findByIdAndDeletedAtIsNull(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));

		Map<String, Account> accountsByNo = new HashMap<>(accountRepository.findAllByUserId(userId).stream()
				.collect(Collectors.toMap(Account::getFinAccountNo, Function.identity())));
		int linkedAccounts = 0;
		for (FinanceAccount financeAccount : accounts) {
			Account existing = accountsByNo.get(financeAccount.accountNo());
			if (existing == null) {
				Account saved = accountRepository.save(
						Account.link(user, financeAccount.accountNo(), financeAccount.bankCode()));
				accountsByNo.put(saved.getFinAccountNo(), saved);
				linkedAccounts++;
			} else if (existing.relink()) {
				linkedAccounts++;
			}
		}

		Map<String, Card> cardsByNo = cardRepository.findAllByUserId(userId).stream()
				.collect(Collectors.toMap(Card::getFinCardNo, Function.identity()));
		int linkedCards = 0;
		for (FinanceCard financeCard : cards) {
			Account withdrawalAccount = accountsByNo.get(financeCard.withdrawalAccountNo());
			Card existing = cardsByNo.get(financeCard.cardNo());
			if (existing == null) {
				cardRepository.save(Card.link(
						user,
						financeCard.cardNo(),
						financeCard.cvc(),
						financeCard.cardIssuerCode(),
						financeCard.cardName(),
						withdrawalAccount
				));
				linkedCards++;
			} else if (existing.relink(withdrawalAccount)) {
				linkedCards++;
			}
		}

		return new LinkAssetsResponse(linkedAccounts, linkedCards);
	}

	@Transactional
	public void unlinkAccount(long userId, long accountId) {
		Account account = accountRepository.findByIdAndUserId(accountId, userId)
				.orElseThrow(() -> new BusinessException(LinkErrorCode.ACCOUNT_NOT_FOUND));
		account.unlink();
	}

	@Transactional
	public void unlinkCard(long userId, long cardId) {
		Card card = cardRepository.findByIdAndUserId(cardId, userId)
				.orElseThrow(() -> new BusinessException(LinkErrorCode.CARD_NOT_FOUND));
		card.unlink();
	}
}

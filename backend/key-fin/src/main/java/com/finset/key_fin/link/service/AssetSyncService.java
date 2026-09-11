package com.finset.key_fin.link.service;

import com.finset.key_fin.account.entity.Account;
import com.finset.key_fin.account.repository.AccountRepository;
import com.finset.key_fin.card.entity.Card;
import com.finset.key_fin.card.repository.CardRepository;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.link.dto.response.FinanceAccount;
import com.finset.key_fin.link.dto.response.FinanceCard;
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
public class AssetSyncService {

	private final UserRepository userRepository;
	private final AccountRepository accountRepository;
	private final CardRepository cardRepository;

	public record SyncedAssets(Map<String, Account> accountsByNo, Map<String, Card> cardsByNo) {
	}

	@Transactional
	public SyncedAssets sync(long userId, List<FinanceAccount> financeAccounts, List<FinanceCard> financeCards) {
		User user = userRepository.findByIdAndDeletedAtIsNull(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));

		Map<String, Account> accountsByNo = syncAccounts(user, financeAccounts);
		Map<String, Card> cardsByNo = syncCards(user, financeCards, accountsByNo);
		return new SyncedAssets(accountsByNo, cardsByNo);
	}

	private Map<String, Account> syncAccounts(User user, List<FinanceAccount> financeAccounts) {
		Map<String, Account> accountsByNo = new HashMap<>(accountRepository.findAllByUserId(user.getId()).stream()
				.collect(Collectors.toMap(Account::getFinAccountNo, Function.identity())));

		for (FinanceAccount financeAccount : financeAccounts) {
			if (!financeAccount.isDemandDeposit() || accountsByNo.containsKey(financeAccount.accountNo())) {
				continue;
			}
			Account saved = accountRepository.save(
					Account.sync(user, financeAccount.accountNo(), financeAccount.bankCode()));
			accountsByNo.put(saved.getFinAccountNo(), saved);
		}
		return accountsByNo;
	}

	private Map<String, Card> syncCards(User user, List<FinanceCard> financeCards, Map<String, Account> accountsByNo) {
		Map<String, Card> cardsByNo = new HashMap<>(cardRepository.findAllByUserId(user.getId()).stream()
				.collect(Collectors.toMap(Card::getFinCardNo, Function.identity())));

		for (FinanceCard financeCard : financeCards) {
			Account withdrawalAccount = accountsByNo.get(financeCard.withdrawalAccountNo());
			Card existing = cardsByNo.get(financeCard.cardNo());
			if (existing != null) {
				existing.refresh(financeCard.cvc(), financeCard.cardName(), withdrawalAccount);
				continue;
			}
			Card saved = cardRepository.save(Card.sync(
					user,
					financeCard.cardNo(),
					financeCard.cvc(),
					financeCard.cardIssuerCode(),
					financeCard.cardName(),
					withdrawalAccount
			));
			cardsByNo.put(saved.getFinCardNo(), saved);
		}
		return cardsByNo;
	}
}

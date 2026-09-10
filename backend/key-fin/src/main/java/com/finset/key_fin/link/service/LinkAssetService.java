package com.finset.key_fin.link.service;

import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.link.client.FinanceAccountClient;
import com.finset.key_fin.link.client.FinanceCardClient;
import com.finset.key_fin.link.dto.request.LinkAssetsRequest;
import com.finset.key_fin.link.dto.response.FinanceAccount;
import com.finset.key_fin.link.dto.response.FinanceCard;
import com.finset.key_fin.link.dto.response.LinkAssetsResponse;
import com.finset.key_fin.link.exception.LinkErrorCode;
import com.finset.key_fin.user.entity.User;
import com.finset.key_fin.user.exception.UserErrorCode;
import com.finset.key_fin.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LinkAssetService {

	private final UserRepository userRepository;
	private final FinanceAccountClient financeAccountClient;
	private final FinanceCardClient financeCardClient;
	private final LinkAssetWriter linkAssetWriter;

	public LinkAssetsResponse link(long userId, LinkAssetsRequest request) {
		if (request.isEmpty()) {
			throw new BusinessException(LinkErrorCode.EMPTY_LINK_REQUEST);
		}
		User user = findConnectedUser(userId);

		Set<String> requestedAccountNos = new LinkedHashSet<>(request.accountsOrEmpty());
		Set<String> requestedCardNos = new LinkedHashSet<>(request.cardsOrEmpty());

		List<FinanceAccount> accounts = requestedAccountNos.isEmpty()
				? List.of()
				: selectAccounts(user.getFinUserKey(), requestedAccountNos);
		List<FinanceCard> cards = requestedCardNos.isEmpty()
				? List.of()
				: selectCards(user.getFinUserKey(), requestedCardNos);

		return linkAssetWriter.link(userId, accounts, cards);
	}

	public void unlinkAccount(long userId, long accountId) {
		findActiveUser(userId);
		linkAssetWriter.unlinkAccount(userId, accountId);
	}

	public void unlinkCard(long userId, long cardId) {
		findActiveUser(userId);
		linkAssetWriter.unlinkCard(userId, cardId);
	}

	private List<FinanceAccount> selectAccounts(String finUserKey, Set<String> requestedAccountNos) {
		Map<String, FinanceAccount> candidates = financeAccountClient.findAccounts(finUserKey).stream()
				.filter(FinanceAccount::isDemandDeposit)
				.collect(Collectors.toMap(FinanceAccount::accountNo, Function.identity(), (first, second) -> first));
		return requestedAccountNos.stream()
				.map(accountNo -> requireCandidate(candidates.get(accountNo)))
				.toList();
	}

	private List<FinanceCard> selectCards(String finUserKey, Set<String> requestedCardNos) {
		Map<String, FinanceCard> candidates = financeCardClient.findCards(finUserKey).stream()
				.collect(Collectors.toMap(FinanceCard::cardNo, Function.identity(), (first, second) -> first));
		return requestedCardNos.stream()
				.map(cardNo -> requireCandidate(candidates.get(cardNo)))
				.toList();
	}

	private <T> T requireCandidate(T candidate) {
		if (candidate == null) {
			throw new BusinessException(LinkErrorCode.FINANCE_ASSET_NOT_FOUND);
		}
		return candidate;
	}

	private User findConnectedUser(long userId) {
		User user = findActiveUser(userId);
		if (!user.isFinanceConnected()) {
			throw new BusinessException(LinkErrorCode.FINANCE_NOT_CONNECTED);
		}
		return user;
	}

	private User findActiveUser(long userId) {
		return userRepository.findByIdAndDeletedAtIsNull(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
	}
}

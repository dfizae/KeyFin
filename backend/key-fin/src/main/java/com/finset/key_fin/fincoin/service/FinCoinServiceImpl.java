package com.finset.key_fin.fincoin.service;

import com.finset.key_fin.fincoin.dto.response.FinCoinBalanceResponse;
import com.finset.key_fin.fincoin.dto.response.FinCoinResponse;
import com.finset.key_fin.fincoin.dto.response.FinCoinResponse.FinCoinHistoryResponse;
import com.finset.key_fin.fincoin.entity.FinCoin;
import com.finset.key_fin.fincoin.repository.FinCoinRepository;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.user.exception.UserErrorCode;
import com.finset.key_fin.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FinCoinServiceImpl implements FinCoinService {

	private final FinCoinRepository finCoinRepository;
	private final UserRepository userRepository;

	@Transactional(readOnly = true)
	@Override
	public FinCoinResponse getFinCoins(long userId, Long cursor, int size) {
		validateActiveUser(userId);

		Limit limit = Limit.of(size + 1);
		List<FinCoin> finCoins = cursor == null
				? finCoinRepository.findByUserIdOrderByIdDesc(userId, limit)
				: finCoinRepository.findByUserIdAndIdLessThanOrderByIdDesc(userId, cursor, limit);

		boolean hasNext = finCoins.size() > size;
		List<FinCoinHistoryResponse> items = finCoins.stream()
				.limit(size)
				.map(FinCoinHistoryResponse::from)
				.toList();
		Long nextCursor = hasNext ? items.getLast().id() : null;
		return new FinCoinResponse(items, nextCursor);
	}

	@Transactional(readOnly = true)
	@Override
	public FinCoinBalanceResponse getFinCoinBalance(long userId) {
		validateActiveUser(userId);
		return new FinCoinBalanceResponse(findCurrentBalance(userId));
	}

	private void validateActiveUser(long userId) {
		userRepository.findByIdAndDeletedAtIsNull(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
	}

	private int findCurrentBalance(long userId) {
		return finCoinRepository.findFirstByUserIdOrderByIdDesc(userId)
				.map(FinCoin::getBalanceAfter)
				.orElse(0);
	}
}

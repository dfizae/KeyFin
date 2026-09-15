package com.finset.key_fin.transaction.service;

import com.finset.key_fin.transaction.entity.TransactionAssetType;
import com.finset.key_fin.transaction.entity.TransactionPollingState;
import com.finset.key_fin.transaction.repository.TransactionPollingStateRepository;
import com.finset.key_fin.user.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class TransactionPollingStateService {

	private final TransactionPollingStateRepository pollingStateRepository;

	@Transactional(readOnly = true)
	public LocalDate calculatePollingStartDate(
			long userId,
			TransactionAssetType assetType,
			long assetId,
			LocalDate today
	) {
		Objects.requireNonNull(assetType, "assetType must not be null");
		Objects.requireNonNull(today, "today must not be null");
		return pollingStateRepository
				.findByUserIdAndAssetTypeAndAssetId(userId, assetType, assetId)
				.map(TransactionPollingState::getLastPolledAt)
				.map(LocalDateTime::toLocalDate)
				.map(lastSyncedDate -> lastSyncedDate.minusDays(1))
				.orElseGet(() -> today.minusDays(1));
	}

	@Transactional
	public void recordPollingSuccess(
			User user,
			TransactionAssetType assetType,
			long assetId,
		LocalDateTime polledAt
	) {
		Objects.requireNonNull(user, "user must not be null");
		Objects.requireNonNull(assetType, "assetType must not be null");
		Objects.requireNonNull(polledAt, "polledAt must not be null");
		TransactionPollingState state = pollingStateRepository
				.findByUserIdAndAssetTypeAndAssetId(user.getId(), assetType, assetId)
				.orElseGet(() -> TransactionPollingState.create(user, assetType, assetId));
		state.recordPollingSuccess(polledAt);
		pollingStateRepository.save(state);
	}

}

package com.finset.key_fin.transaction.repository;

import com.finset.key_fin.transaction.entity.TransactionAssetType;
import com.finset.key_fin.transaction.entity.TransactionPollingState;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TransactionPollingStateRepository extends JpaRepository<TransactionPollingState, Long> {

	Optional<TransactionPollingState> findByUserIdAndAssetTypeAndAssetId(
			Long userId,
			TransactionAssetType assetType,
			Long assetId
	);
}

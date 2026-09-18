package com.finset.key_fin.furniture.service;

import com.finset.key_fin.furniture.entity.DefaultFurnitureType;
import com.finset.key_fin.furniture.entity.UserFurniture;
import com.finset.key_fin.furniture.repository.UserFurnitureRepository;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.item.repository.ItemRepository;
import com.finset.key_fin.user.exception.UserErrorCode;
import com.finset.key_fin.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class DefaultFurnitureService {

	private final UserRepository users;
	private final ItemRepository items;
	private final UserFurnitureRepository furnitures;

	/** Caller and provisioning share the user lock, including the first acquisition. */
	@Transactional
	public List<UserFurniture> provision(long userId) {
		var user = users.findActiveByIdForUpdate(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
		var defaults = items.findByDefaultFurnitureTypeIsNotNullOrderByIdAsc();
		if (defaults.size() != DefaultFurnitureType.values().length) {
			throw new IllegalStateException("Default furniture catalogue must contain FRIDGE, SOFA and TV");
		}
		Map<Long, UserFurniture> owned = new HashMap<>();
		furnitures.findByUserIdOrderByIdAsc(userId).forEach(f -> owned.put(f.getItem().getId(), f));
		return defaults.stream().map(item -> {
			var furniture = owned.get(item.getId());
			if (furniture == null) {
				furniture = UserFurniture.acquire(user, item);
				item.getDefaultFurnitureType().placeInitially(furniture);
				furnitures.save(furniture);
			} else if (!furniture.isPlaced()) {
				item.getDefaultFurnitureType().placeInitially(furniture);
			}
			return furniture;
		}).toList();
	}
}

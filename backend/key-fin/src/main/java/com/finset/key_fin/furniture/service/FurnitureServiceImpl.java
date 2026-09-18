package com.finset.key_fin.furniture.service;

import com.finset.key_fin.furniture.dto.request.FurniturePlacementUpdateRequest;
import com.finset.key_fin.furniture.dto.response.PlacedFurnitureResponse;
import com.finset.key_fin.furniture.dto.response.UserFurnitureResponse;
import com.finset.key_fin.furniture.exception.FurnitureErrorCode;
import com.finset.key_fin.furniture.repository.UserFurnitureRepository;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.global.exception.CommonErrorCode;
import com.finset.key_fin.item.entity.ItemSlotType;
import com.finset.key_fin.user.exception.UserErrorCode;
import com.finset.key_fin.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FurnitureServiceImpl implements FurnitureService {
	private final UserFurnitureRepository userFurnitureRepository;
	private final UserRepository userRepository;

	@Transactional(readOnly = true)
	@Override
	public List<UserFurnitureResponse> getFurnitures(long userId, String slotType) {
		ItemSlotType filter = parseFurnitureSlot(slotType);
		validateActiveUser(userId);
		var furnitures = filter == null
				? userFurnitureRepository.findByUserIdOrderByIdAsc(userId)
				: userFurnitureRepository.findByUserIdAndItemSlotTypeOrderByIdAsc(userId, filter);
		return furnitures.stream().map(UserFurnitureResponse::from).toList();
	}

	@Transactional(readOnly = true)
	@Override
	public List<PlacedFurnitureResponse> getPlacedFurnitures(long userId) {
		validateActiveUser(userId);
		return userFurnitureRepository.findByUserIdAndPlacementStatusIsNotNullOrderByIdAsc(userId)
				.stream().map(PlacedFurnitureResponse::from).toList();
	}

	@Transactional
	@Override
	public UserFurnitureResponse updatePlacement(long userId, long userFurnitureId, FurniturePlacementUpdateRequest request) {
		userRepository.findActiveByIdForUpdate(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
		var target = userFurnitureRepository.findByIdAndUserId(userFurnitureId, userId)
				.orElseThrow(() -> new BusinessException(FurnitureErrorCode.USER_FURNITURE_NOT_FOUND));
		if (request.placed()) {
			target.place(request.placementStatus(), request.placementDirection(), request.positionX(), request.positionY(),
					request.layer() == null ? 0 : request.layer());
		} else {
			target.unplace();
		}
		userFurnitureRepository.flush();
		return UserFurnitureResponse.from(target);
	}

	private void validateActiveUser(long userId) {
		userRepository.findByIdAndDeletedAtIsNull(userId)
				.orElseThrow(() -> new BusinessException(UserErrorCode.USER_NOT_FOUND));
	}

	private ItemSlotType parseFurnitureSlot(String value) {
		if (value == null) return null;
		try {
			ItemSlotType slot = ItemSlotType.valueOf(value);
			if (slot == ItemSlotType.FLOOR || slot == ItemSlotType.WALL) return slot;
		} catch (IllegalArgumentException ignored) {
			// 빈 값과 알 수 없는 유형도 동일한 입력 오류로 응답한다.
		}
		throw new BusinessException(CommonErrorCode.INVALID_INPUT_VALUE);
	}
}

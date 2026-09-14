package com.finset.key_fin.room.service;

import com.finset.key_fin.item.entity.ItemSlotType;
import com.finset.key_fin.item.service.ItemService;
import com.finset.key_fin.room.dto.response.RoomResponse;
import com.finset.key_fin.room.entity.FurniturePlacementDirection;
import com.finset.key_fin.room.entity.FurniturePlacementStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class RoomServiceImpl implements RoomService {

	private final ItemService itemService;

	@Transactional(readOnly = true)
	@Override
	public RoomResponse getRoom(long userId) {
		// TODO: UserFurniture와 Item을 조회해 placement_status가 있는 배치 가구를 구성한다.
		// TODO: 사용자의 최신 FinCoin 원장에서 현재 잔액을 조회한다.
		// TODO: 오늘 ATTEND 사유의 FinCoin 원장이 존재하는지 조회한다.
		// TODO: Budget, BudgetEnvelope, Transaction 도메인의 계산 결과로 보드 요약을 구성한다.
		// TODO: 현재 아바타 반응 상태와 활성 방 테마를 조회한다.
		var equipped = itemService.getEquipment(userId).equipped();
		List<RoomResponse.FurnitureResponse> furnitures = List.of(
				new RoomResponse.FurnitureResponse(
						4L,
						ItemSlotType.FLOOR,
						"sofa_default",
						FurniturePlacementStatus.FLOOR,
						FurniturePlacementDirection.FRONT_RIGHT,
						new BigDecimal("165.000"),
						new BigDecimal("280.000"),
						0
				)
		);

		return new RoomResponse(
				new RoomResponse.AvatarResponse(equipped, null),
				furnitures,
				new RoomResponse.CoinResponse(1250),
				new RoomResponse.BoardResponse("202609", 36),
				new RoomResponse.AttendanceResponse(false)
		);
	}
}

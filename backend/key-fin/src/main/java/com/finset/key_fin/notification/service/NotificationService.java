package com.finset.key_fin.notification.service;

import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import com.finset.key_fin.global.exception.BusinessException;
import com.finset.key_fin.global.exception.CommonErrorCode;
import com.finset.key_fin.notification.dto.response.NotificationListResponse;
import com.finset.key_fin.notification.dto.response.NotificationResponse;
import com.finset.key_fin.notification.entity.NotificationType;
import com.finset.key_fin.notification.exception.NotificationErrorCode;
import com.finset.key_fin.notification.repository.NotificationRepository;
import com.finset.key_fin.user.exception.UserErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NotificationService {
	private static final ZoneId KST = ZoneId.of("Asia/Seoul");
	private final NotificationRepository repository;
	private final Clock clock;

	/** 내부 도메인용 저장. 호출자의 트랜잭션에 참여하며 푸시는 발송하지 않는다. */
	@Transactional
	public long create(long userId, NotificationType type, String title, String body, String refId,
			boolean requiresAction) {
		if (userId <= 0 || type == null || title == null || title.isBlank()
				|| title.codePointCount(0, title.length()) > 100
				|| (refId != null && refId.codePointCount(0, refId.length()) > 30)
				|| (body != null && body.getBytes(StandardCharsets.UTF_8).length > 65_535)) {
			throw new BusinessException(CommonErrorCode.INVALID_INPUT_VALUE);
		}
		if (!repository.isActiveUser(userId)) {
			throw new BusinessException(UserErrorCode.USER_NOT_FOUND);
		}
		return repository.insert(userId, type, title, body, refId, requiresAction,
				LocalDateTime.now(clock.withZone(KST)).truncatedTo(ChronoUnit.SECONDS));
	}

	@Transactional(readOnly = true)
	public NotificationListResponse list(long userId, boolean unreadOnly, Long cursor, Integer size) {
		int pageSize = size == null ? 20 : size;
		if ((cursor != null && cursor <= 0) || pageSize < 1 || pageSize > 100) {
			throw new BusinessException(CommonErrorCode.INVALID_INPUT_VALUE);
		}
		var rows = repository.findPage(userId, unreadOnly, cursor, pageSize + 1);
		boolean hasNext = rows.size() > pageSize;
		var page = hasNext ? rows.subList(0, pageSize) : rows;
		return new NotificationListResponse(page.stream().map(NotificationResponse::from).toList(),
				hasNext ? page.getLast().id() : null);
	}

	@Transactional
	public void markRead(long userId, long notificationId) {
		if (notificationId <= 0) {
			throw new BusinessException(CommonErrorCode.INVALID_INPUT_VALUE);
		}
		// 변경된 행 수가 0이어도 이미 읽은 본인 알림이면 성공한다.
		if (repository.markRead(userId, notificationId) == 0 && !repository.existsOwned(userId, notificationId)) {
			throw new BusinessException(NotificationErrorCode.NOTIFICATION_NOT_FOUND);
		}
	}
}

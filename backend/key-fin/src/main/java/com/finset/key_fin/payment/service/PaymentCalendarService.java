package com.finset.key_fin.payment.service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;

import org.springframework.stereotype.Service;

import com.finset.key_fin.payment.dto.response.PaymentCalendarResponse;
import com.finset.key_fin.payment.dto.response.PaymentCalendarResponse.Day;
import com.finset.key_fin.payment.dto.response.PaymentCalendarResponse.Item;
import com.finset.key_fin.payment.entity.FixedExpense;
import com.finset.key_fin.payment.repository.FixedExpenseRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentCalendarService {

	private static final DateTimeFormatter MONTH_FORMAT = DateTimeFormatter.ofPattern("yyyyMM");
	private static final Comparator<Item> ITEM_ORDER = Comparator
			.comparing(Item::type)
			.thenComparing(Item::amount, Comparator.reverseOrder());

	private final SubscriptionSyncService subscriptionSyncService;
	private final FixedExpenseRepository fixedExpenseRepository;

	public PaymentCalendarResponse getCalendar(long userId, YearMonth month) {
		syncQuietly(userId);

		Map<LocalDate, List<Item>> byDate = new TreeMap<>();
		for (FixedExpense expense : fixedExpenseRepository.findAllByUserIdAndActiveTrueOrderByIdAsc(userId)) {
			byDate.computeIfAbsent(expense.paymentDateIn(month), date -> new ArrayList<>())
					.add(Item.of(expense));
		}
		List<Day> days = byDate.entrySet().stream()
				.map(entry -> new Day(entry.getKey(), entry.getValue().stream().sorted(ITEM_ORDER).toList()))
				.toList();
		return new PaymentCalendarResponse(month.format(MONTH_FORMAT), days);
	}

	private void syncQuietly(long userId) {
		try {
			subscriptionSyncService.sync(userId);
		} catch (RuntimeException e) {
			log.warn("정기결제 동기화 실패 — 저장된 항목으로 캘린더 응답: userId={}, cause={}", userId, e.toString());
		}
	}
}

package com.finset.key_fin.coaching;

import com.finset.key_fin.budget.service.BudgetPeriod;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Adapter decision guards only; the separate HTTP test exercises actual FDT accounting. */
class CoachingSourceSynchronizationTest {
    private final LocalDate cutoff=LocalDate.of(2026,8,3);
    private final JsonMapper mapper=JsonMapper.builder().build();
    private final CoachingSourceRepository source=mock(CoachingSourceRepository.class);
    private final CoachingDataBridge bridge=mock(CoachingDataBridge.class);
    private CoachingSourceAdapter adapter;
    private CoachingSourceRepository.Source initial;

    @BeforeEach void start() {
        var properties=new CoachingProperties(); properties.setOwnerIds(Map.of(1L,"one"));
        adapter=new CoachingSourceAdapter(source,bridge,mapper,properties);
        var names=List.of("외식","교통비","의료·건강","취미·여가","쇼핑","편의점·마트·잡화","기타");
        initial=new CoachingSourceRepository.Source(List.of(row(1,"LIVE",1000,"NORMAL","음식점")),
                names.stream().map(name->new CoachingSourceRepository.Budget(name,100000L,0)).toList(),
                0,BudgetPeriod.current(cutoff,1));
        when(source.read(1,cutoff)).thenReturn(initial);
        when(bridge.bootstrap(anyLong(),anyString(),any())).thenReturn(mapper.createObjectNode());
        adapter.bootstrap(1L,cutoff,"initial");
        var bootstrap=ArgumentCaptor.forClass(EngineInput.Bootstrap.class);
        verify(bridge).bootstrap(eq(1L),eq("initial"),bootstrap.capture());
        // Only the fields consumed by synchronization guards are needed in this stored-view fixture.
        var twin=mapper.createObjectNode().put("as_of",cutoff.toString()).put("revision",1);
        var tx=mapper.createObjectNode().put("id","1").put("date",cutoff.toString())
                .put("active",true).put("budget_amount_krw",1000).put("envelope","외식");
        tx.set("raw",bootstrap.getValue().transactions().getFirst());
        twin.putArray("transactions").add(tx);
        when(bridge.currentTwin(1L)).thenReturn(twin);
        when(bridge.applyEvent(anyLong(),anyString(),any())).thenReturn(mapper.readTree("{\"identity\":{\"revision\":2}}"));
        clearInvocations(bridge);
    }
    private CoachingSourceRepository.Row row(long id,String origin,long amount,String status,String subcategory) {
        return new CoachingSourceRepository.Row(id,origin,"WITHDRAW",10L,null,null,"합성",amount,cutoff,
                LocalTime.NOON,subcategory,"외식","CONFIRMED","NONE",null,status,true,false);
    }
    private void replaceRows(CoachingSourceRepository.Row... rows) {
        when(source.read(1,cutoff)).thenReturn(new CoachingSourceRepository.Source(List.of(rows),initial.budgets(),0,initial.period()));
    }
    private void assertBlocked(String reason) {
        var result=adapter.synchronize(1L,cutoff,"refresh");
        assertEquals("blocked",result.status()); assertEquals(reason,result.reason());
        verify(bridge,never()).applyEvent(anyLong(),anyString(),any());
    }
    @Test void identicalObservedRowsDoNotReplayDebits() {
        assertEquals("unchanged",adapter.synchronize(1L,cutoff,"refresh").status());
        verify(bridge,never()).applyEvent(anyLong(),anyString(),any());
    }
    @Test void changedAmountCannotOverwriteAnExistingFinancialEvent() {
        replaceRows(row(1,"LIVE",2000,"NORMAL","음식점"));
        assertBlocked("immutable_transaction_changed");
    }
    @Test void confirmedReclassificationRequiresExplicitLedgerReconciliation() {
        replaceRows(row(1,"LIVE",1000,"NORMAL","카페"));
        assertBlocked("reclassification_requires_ledger_reconciliation");
    }
    @Test void newSeedRowsAreNeverInventedAsLiveEvents() {
        replaceRows(initial.rows().getFirst(),row(2,"SEED",2000,"NORMAL","음식점"));
        assertBlocked("seed_event_not_allowed");
    }
    @Test void deletedSourceRowsAreNotGuessedToBeCancellations() {
        replaceRows(row(2,"LIVE",2000,"NORMAL","음식점"));
        assertBlocked("source_transaction_deleted");
    }
    @Test void periodAndBudgetChangesCannotReuseAnOldEnvelopeBaseline() {
        when(source.read(1,cutoff)).thenReturn(new CoachingSourceRepository.Source(initial.rows(),initial.budgets(),0,
                BudgetPeriod.of("202608",25)));
        assertBlocked("budget_period_requires_reconciliation");
        var changed=initial.budgets().stream().map(b->new CoachingSourceRepository.Budget(b.name(),200000L,0)).toList();
        when(source.read(1,cutoff)).thenReturn(new CoachingSourceRepository.Source(initial.rows(),changed,0,initial.period()));
        assertBlocked("budget_plan_requires_reconciliation");
    }
    @Test void newPaymentsPrecedeCancellationsAndOneMutationKeepsTheLeaseBounded() {
        replaceRows(row(1,"LIVE",1000,"CANCELED","음식점"),row(2,"LIVE",2000,"NORMAL","음식점"));
        var result=adapter.synchronize(1L,cutoff,"refresh");
        assertEquals("pending",result.status()); assertEquals(1,result.appliedEvents());
        var event=ArgumentCaptor.forClass(EngineInput.Event.class);
        verify(bridge).applyEvent(eq(1L),startsWith("source-"),event.capture());
        assertEquals(1,event.getValue().expectedRevision());
        assertEquals("2",event.getValue().event().at("/transaction/transaction_id").asString());
        assertNull(event.getValue().cancellationBalance());
    }
    @Test void nextDayWithoutANewObservationDoesNotClaimTheEngineDateIsCurrent() {
        when(source.read(1,cutoff.plusDays(1))).thenReturn(initial);
        var result=adapter.synchronize(1L,cutoff.plusDays(1),"next-day");
        assertEquals("stale_engine_cutoff",result.reason());
        assertEquals("blocked",result.status());
        verify(bridge,never()).applyEvent(anyLong(),anyString(),any());
    }
    @Test void nextMonthNeedsANewAuthoritativeEnvelopeBaseline() {
        var next=LocalDate.of(2026,9,1);
        when(source.read(1,next)).thenReturn(new CoachingSourceRepository.Source(initial.rows(),initial.budgets(),0,
                BudgetPeriod.current(next,1)));
        assertEquals("budget_period_requires_reconciliation",adapter.synchronize(1L,next,"next-month").reason());
        verify(bridge,never()).applyEvent(anyLong(),anyString(),any());
    }
    @Test void missingStoredTransactionsRequiresAnExplicitSourceBaseline() {
        when(bridge.currentTwin(1L)).thenReturn(mapper.readTree("{\"as_of\":\"2026-08-03\",\"revision\":1,\"transactions\":[]}"));
        assertBlocked("source_baseline_missing");
    }
}

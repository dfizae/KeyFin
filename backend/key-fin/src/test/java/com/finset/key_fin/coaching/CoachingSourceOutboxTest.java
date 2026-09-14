package com.finset.key_fin.coaching;

import com.finset.key_fin.transaction.entity.Transaction;
import com.finset.key_fin.transaction.entity.TransactionSource;
import com.finset.key_fin.transaction.entity.TransactionType;
import com.finset.key_fin.user.entity.User;
import org.hibernate.SessionFactory;
import org.hibernate.cfg.Configuration;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.support.DefaultListableBeanFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.orm.jpa.EntityManagerFactoryUtils;
import org.springframework.orm.jpa.JpaTransactionManager;
import org.springframework.orm.jpa.vendor.HibernateJpaDialect;
import org.springframework.orm.jpa.hibernate.SpringBeanContainer;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** Real Hibernate callbacks + source/queue rollback on the same JDBC connection. */
class CoachingSourceOutboxTest {
    private SessionFactory factory;
    private JdbcClient jdbc;
    private CoachingSourceOutbox outbox;
    private TransactionTemplate tx;

    @BeforeEach void start() throws Exception {
        var database=new DriverManagerDataSource("jdbc:h2:mem:"+UUID.randomUUID()+";MODE=MySQL;DB_CLOSE_DELAY=-1","sa","");
        jdbc=JdbcClient.create(database);
        jdbc.sql(Files.readString(Path.of("src/main/resources/db/migration/V8__coaching_source_outbox.sql"))).update();
        var properties=new CoachingProperties(); properties.setSourceSyncEnabled(true); properties.setOwnerIds(Map.of(1L,"one"));
        outbox=new CoachingSourceOutbox(jdbc,properties);
        var beans=new DefaultListableBeanFactory();
        beans.registerSingleton("coachingSourceOutbox",outbox);
        beans.registerSingleton("coachingTransactionListener",new CoachingTransactionListener(outbox));
        var configuration=new Configuration().addAnnotatedClass(User.class).addAnnotatedClass(Transaction.class);
        configuration.getProperties().put("hibernate.connection.datasource",database);
        configuration.getProperties().put("hibernate.resource.beans.container",new SpringBeanContainer(beans));
        configuration.setProperty("hibernate.hbm2ddl.auto","create-drop");
        factory=configuration.buildSessionFactory();
        // Production V1 supplies these defaults; Hibernate's generated test DDL does not.
        jdbc.sql("ALTER TABLE users ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP").update();
        jdbc.sql("ALTER TABLE transactions ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP").update();
        var manager=new JpaTransactionManager(factory); manager.setDataSource(database); manager.setJpaDialect(new HibernateJpaDialect());
        tx=new TransactionTemplate(manager);
        tx.executeWithoutResult(status->{
            var user=User.create("source@example.invalid","synthetic-password","합성 사용자");
            user.connectFinance("synthetic-fin-user");
            EntityManagerFactoryUtils.getTransactionalEntityManager(factory).persist(user);
        });
    }
    @AfterEach void stop() { if(factory!=null)factory.close(); if(jdbc!=null)jdbc.sql("DROP ALL OBJECTS").update(); }
    private Transaction payment() {
        try {
            var constructor=Transaction.class.getDeclaredConstructor(); constructor.setAccessible(true);
            var payment=constructor.newInstance();
            var em=EntityManagerFactoryUtils.getTransactionalEntityManager(factory);
            ReflectionTestUtils.setField(payment,"user",em.find(User.class,1L));
            ReflectionTestUtils.setField(payment,"source",TransactionSource.LIVE);
            ReflectionTestUtils.setField(payment,"transactionType",TransactionType.WITHDRAW);
            ReflectionTestUtils.setField(payment,"accountId",10L);
            ReflectionTestUtils.setField(payment,"amount",1000L);
            ReflectionTestUtils.setField(payment,"transactionDate",LocalDate.of(2026,9,3));
            ReflectionTestUtils.setField(payment,"transactionTime",LocalTime.NOON);
            return payment;
        } catch(ReflectiveOperationException exception) { throw new IllegalStateException(exception); }
    }
    @Test void sourcePersistAndUpdateCoalesceWithoutRemoteCalls() {
        long id=tx.execute(status->{
            var em=EntityManagerFactoryUtils.getTransactionalEntityManager(factory);
            var payment=payment(); em.persist(payment); em.flush(); return payment.getId();
        });
        tx.executeWithoutResult(status->{
            var payment=EntityManagerFactoryUtils.getTransactionalEntityManager(factory).find(Transaction.class,id);
            ReflectionTestUtils.setField(payment,"memo","원천 정정");
        });
        assertEquals(1,jdbc.sql("SELECT COUNT(*) FROM coaching_source_outbox").query(Integer.class).single());
        assertEquals(2,jdbc.sql("SELECT generation FROM coaching_source_outbox").query(Integer.class).single());
    }
    @Test void rollingBackTheSourceAlsoRollsBackItsQueuedRefresh() {
        tx.executeWithoutResult(status->{
            var em=EntityManagerFactoryUtils.getTransactionalEntityManager(factory); em.persist(payment()); em.flush();
            assertEquals(1,jdbc.sql("SELECT COUNT(*) FROM coaching_source_outbox").query(Integer.class).single());
            status.setRollbackOnly();
        });
        assertEquals(0,jdbc.sql("SELECT COUNT(*) FROM transactions").query(Integer.class).single());
        assertEquals(0,jdbc.sql("SELECT COUNT(*) FROM coaching_source_outbox").query(Integer.class).single());
    }
    @Test void leasesPreventDuplicateClaimAndNewGenerationSurvivesCompletion() {
        tx.executeWithoutResult(status->outbox.enqueue(1));
        var now=Instant.now().plusSeconds(1);
        var job=outbox.claim(now).orElseThrow(); assertTrue(outbox.claim(now).isEmpty());
        tx.executeWithoutResult(status->outbox.enqueue(1));
        outbox.complete(job);
        var next=outbox.claim(now.plusSeconds(1)).orElseThrow(); assertEquals(2,next.generation());
        outbox.complete(next); assertTrue(outbox.claim(now.plusSeconds(2)).isEmpty());
    }
    @Test void retryRetainsWorkAndExpiredLeaseIsRecoverable() {
        tx.executeWithoutResult(status->outbox.enqueue(1));
        var now=Instant.now().plusSeconds(1); var job=outbox.claim(now).orElseThrow();
        outbox.retry(job,"COACHING_TIMEOUT",now);
        assertTrue(outbox.claim(now.plusSeconds(29)).isEmpty());
        var retried=outbox.claim(now.plusSeconds(31)).orElseThrow(); assertEquals(1,retried.attempts());
        var recovered=outbox.claim(now.plusSeconds(332)).orElseThrow();
        outbox.complete(retried); // The former worker cannot acknowledge the new lease.
        assertTrue(outbox.claim(now.plusSeconds(333)).isEmpty());
        outbox.complete(recovered); assertTrue(outbox.claim(now.plusSeconds(334)).isEmpty());
    }
    @Test void workerCallsTheRemoteAdapterOnlyOutsideTheSourceTransaction() {
        tx.executeWithoutResult(status->{
            var em=EntityManagerFactoryUtils.getTransactionalEntityManager(factory); em.persist(payment()); em.flush();
        });
        var adapter=mock(CoachingSourceAdapter.class);
        when(adapter.synchronize(eq(1L),any(),anyString())).thenAnswer(invocation->{
            assertFalse(TransactionSynchronizationManager.isActualTransactionActive());
            assertEquals(1,jdbc.sql("SELECT COUNT(*) FROM transactions").query(Integer.class).single());
            return new CoachingSourceAdapter.SyncResult("synchronized",1,null,false);
        });
        new CoachingSourceWorker(outbox,adapter).tick();
        verify(adapter).synchronize(eq(1L),any(),anyString());
        assertEquals(1,jdbc.sql("SELECT completed_generation FROM coaching_source_outbox").query(Integer.class).single());
    }
    @Test void remoteFailurePreservesTheCommittedSourceAndRetrySignal() {
        tx.executeWithoutResult(status->EntityManagerFactoryUtils.getTransactionalEntityManager(factory).persist(payment()));
        var adapter=mock(CoachingSourceAdapter.class);
        when(adapter.synchronize(eq(1L),any(),anyString())).thenThrow(new IllegalStateException("synthetic upstream failure"));
        new CoachingSourceWorker(outbox,adapter).tick();
        assertEquals(1,jdbc.sql("SELECT COUNT(*) FROM transactions").query(Integer.class).single());
        assertEquals(0,jdbc.sql("SELECT completed_generation FROM coaching_source_outbox").query(Integer.class).single());
        assertEquals("SOURCE_SYNC_FAILURE",jdbc.sql("SELECT last_error_code FROM coaching_source_outbox").query(String.class).single());
    }
}

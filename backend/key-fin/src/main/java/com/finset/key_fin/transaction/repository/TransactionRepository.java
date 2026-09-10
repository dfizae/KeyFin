package com.finset.key_fin.transaction.repository;

import com.finset.key_fin.transaction.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {
}

package com.finset.key_fin.budget.repository;

import com.finset.key_fin.budget.entity.Budget;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BudgetRepository extends JpaRepository<Budget, Long> {
}

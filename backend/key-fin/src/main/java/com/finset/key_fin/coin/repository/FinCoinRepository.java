package com.finset.key_fin.coin.repository;

import com.finset.key_fin.coin.entity.FinCoin;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FinCoinRepository extends JpaRepository<FinCoin, Long> {
}

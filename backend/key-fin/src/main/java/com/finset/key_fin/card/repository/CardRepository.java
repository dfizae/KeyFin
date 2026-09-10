package com.finset.key_fin.card.repository;

import com.finset.key_fin.card.entity.Card;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CardRepository extends JpaRepository<Card, Long> {

	List<Card> findAllByUserId(Long userId);

	Optional<Card> findByIdAndUserId(Long id, Long userId);
}

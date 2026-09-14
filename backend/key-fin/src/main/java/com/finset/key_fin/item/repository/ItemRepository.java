package com.finset.key_fin.item.repository;

import com.finset.key_fin.item.entity.Item;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItemRepository extends JpaRepository<Item, Long> {
}

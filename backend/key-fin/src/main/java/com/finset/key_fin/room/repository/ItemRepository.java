package com.finset.key_fin.room.repository;

import com.finset.key_fin.room.entity.Item;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ItemRepository extends JpaRepository<Item, Long> {
}

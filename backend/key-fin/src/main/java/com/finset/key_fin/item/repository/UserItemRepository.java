package com.finset.key_fin.item.repository;

import com.finset.key_fin.item.entity.UserItem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserItemRepository extends JpaRepository<UserItem, Long> {
}

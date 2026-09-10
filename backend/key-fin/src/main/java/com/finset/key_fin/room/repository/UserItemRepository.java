package com.finset.key_fin.room.repository;

import com.finset.key_fin.room.entity.UserItem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserItemRepository extends JpaRepository<UserItem, Long> {
}

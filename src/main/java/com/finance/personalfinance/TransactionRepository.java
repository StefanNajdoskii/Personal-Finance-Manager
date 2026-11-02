
package com.finance.personalfinance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface TransactionRepository
        extends JpaRepository<Transaction, Long> {

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.type = :type")
    BigDecimal sumAmountByType(@Param("type") String type);

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t "
            + "WHERE t.type = :type AND t.account.owner.id = :ownerId")
    BigDecimal sumAmountByTypeAndOwner(@Param("type") String type,
                                       @Param("ownerId") Long ownerId);

    List<Transaction> findByAccount_Owner_Id(Long ownerId);

    boolean existsByAccount_Id(Long id);

    @Modifying
    @Query("UPDATE Transaction t SET t.account = null WHERE t.account.id = :accountId")
    void detachTransactionsFromAccount(@Param("accountId") Long accountId);
}

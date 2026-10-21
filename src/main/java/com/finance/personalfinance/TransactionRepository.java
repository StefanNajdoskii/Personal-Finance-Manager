
package com.finance.personalfinance;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;

public interface TransactionRepository
        extends JpaRepository<Transaction, Long> {

    @Query("SELECT COALESCE(SUM(t.amount), 0) FROM Transaction t WHERE t.type = :type")
    BigDecimal sumAmountByType(@Param("type") String type);

    boolean existsByAccount_Id(Long id);

    @Modifying
    @Query("UPDATE Transaction t SET t.account = null WHERE t.account.id = :accountId")
    void detachTransactionsFromAccount(@Param("accountId") Long accountId);
}

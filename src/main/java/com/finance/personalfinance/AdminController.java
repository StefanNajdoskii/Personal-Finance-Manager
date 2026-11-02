package com.finance.personalfinance;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Read-only admin views across all users. Access is enforced in SecurityConfig
 * (/api/admin/** requires ROLE_ADMIN). ownerUsername is null for legacy rows
 * that were created before accounts had owners.
 */
@RestController
@RequestMapping("/api/admin")
public class AdminController {

    public record AccountView(
            Long accountId,
            String name,
            String type,
            String currency,
            BigDecimal balance,
            String ownerUsername) {
    }

    public record TransactionView(
            Long transactionId,
            String title,
            BigDecimal amount,
            String type,
            String category,
            LocalDate date,
            Long accountId,
            String accountName,
            String ownerUsername) {
    }

    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;

    public AdminController(AccountRepository accountRepository,
                           TransactionRepository transactionRepository) {
        this.accountRepository = accountRepository;
        this.transactionRepository = transactionRepository;
    }

    @GetMapping("/accounts")
    public List<AccountView> listAccounts() {
        return accountRepository.findAll().stream()
                .map(a -> new AccountView(
                        a.getId(),
                        a.getName(),
                        a.getType(),
                        a.getCurrency(),
                        a.getBalance(),
                        a.getOwner() == null ? null : a.getOwner().getUsername()))
                .toList();
    }

    @GetMapping("/transactions")
    public List<TransactionView> listTransactions() {
        return transactionRepository.findAll().stream()
                .map(t -> new TransactionView(
                        t.getId(),
                        t.getTitle(),
                        t.getAmount(),
                        t.getType(),
                        t.getCategory(),
                        t.getDate(),
                        t.getAccount() == null ? null : t.getAccount().getId(),
                        t.getAccount() == null ? null : t.getAccount().getName(),
                        t.getAccount() == null || t.getAccount().getOwner() == null
                                ? null
                                : t.getAccount().getOwner().getUsername()))
                .toList();
    }
}


package com.finance.personalfinance;

import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    private final TransactionRepository repository;
    private final AccountRepository accountRepository;

    public TransactionController(
            TransactionRepository repository,
            AccountRepository accountRepository) {
        this.repository = repository;
        this.accountRepository = accountRepository;
    }

    @GetMapping
    public List<Transaction> getAllTransactions() {
        return repository.findAll();
    }

    @PostMapping
    @Transactional
    public Transaction createTransaction(
            @RequestBody Transaction transaction) {

        if (transaction.getAccount() == null
                || transaction.getAccount().getId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Account ID is required");
        }

        Account account = accountRepository
                .findById(transaction.getAccount().getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Account not found"));

        BigDecimal amount = transaction.getAmount();

        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Amount must be greater than zero");
        }

        if ("EXPENSE".equals(transaction.getType())) {
            if (account.getBalance().compareTo(amount) < 0) {
                throw new ResponseStatusException(
                        HttpStatus.BAD_REQUEST,
                        "Insufficient account balance");
            }

            account.setBalance(account.getBalance().subtract(amount));

        } else if ("INCOME".equals(transaction.getType())) {
            account.setBalance(account.getBalance().add(amount));

        } else {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Type must be INCOME or EXPENSE");
        }

        transaction.setAccount(account);

        accountRepository.save(account);

        return repository.save(transaction);
    }

    @GetMapping("/summary")
    public Map<String, BigDecimal> getSummary() {
        BigDecimal income = repository.sumAmountByType("INCOME");
        BigDecimal expenses = repository.sumAmountByType("EXPENSE");
        BigDecimal balance = income.subtract(expenses);

        return Map.of(
                "totalIncome", income,
                "totalExpenses", expenses,
                "balance", balance
        );
    }
}

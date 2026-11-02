package com.finance.personalfinance;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
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
    private final UserRepository userRepository;

    public TransactionController(
            TransactionRepository repository,
            AccountRepository accountRepository,
            UserRepository userRepository) {
        this.repository = repository;
        this.accountRepository = accountRepository;
        this.userRepository = userRepository;
    }

    @GetMapping
    public List<Transaction> getAllTransactions(Authentication authentication) {
        return repository.findByAccount_Owner_Id(currentUser(authentication).getId());
    }

    @PostMapping
    @Transactional
    public Transaction createTransaction(
            @RequestBody Transaction transaction,
            Authentication authentication) {

        User user = currentUser(authentication);

        if (transaction.getAccount() == null
                || transaction.getAccount().getId() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Account ID is required");
        }

        // Only accounts owned by the logged-in user can be used
        Account account = accountRepository
                .findById(transaction.getAccount().getId())
                .filter(a -> a.isOwnedBy(user.getId()))
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
    public Map<String, BigDecimal> getSummary(Authentication authentication) {
        Long ownerId = currentUser(authentication).getId();

        BigDecimal income = repository.sumAmountByTypeAndOwner("INCOME", ownerId);
        BigDecimal expenses = repository.sumAmountByTypeAndOwner("EXPENSE", ownerId);
        BigDecimal balance = income.subtract(expenses);

        return Map.of(
                "totalIncome", income,
                "totalExpenses", expenses,
                "balance", balance
        );
    }

    private User currentUser(Authentication authentication) {
        return userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Not logged in"));
    }
}

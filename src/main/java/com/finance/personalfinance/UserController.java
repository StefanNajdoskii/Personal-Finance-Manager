package com.finance.personalfinance;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

/**
 * Admin-only views of registered users and their data. Access is enforced in
 * SecurityConfig (/api/users/** requires ROLE_ADMIN). Responses never include
 * password hashes.
 */
@RestController
@RequestMapping("/api/users")
public class UserController {

    public record UserView(Long id, String username, String role, Instant createdAt) {
    }

    private final UserRepository userRepository;
    private final AccountRepository accountRepository;
    private final TransactionRepository transactionRepository;

    public UserController(UserRepository userRepository,
                          AccountRepository accountRepository,
                          TransactionRepository transactionRepository) {
        this.userRepository = userRepository;
        this.accountRepository = accountRepository;
        this.transactionRepository = transactionRepository;
    }

    @GetMapping
    public List<UserView> listUsers() {
        return userRepository.findAll().stream()
                .map(u -> new UserView(u.getId(), u.getUsername(), u.getRole(), u.getCreatedAt()))
                .toList();
    }

    /** Same JSON as GET /api/accounts, but for the given user. */
    @GetMapping("/{userId}/accounts")
    public List<Account> getAccountsForUser(@PathVariable Long userId) {
        requireUser(userId);
        return accountRepository.findByOwnerId(userId);
    }

    /** Same JSON as GET /api/transactions, but for the given user. */
    @GetMapping("/{userId}/transactions")
    public List<Transaction> getTransactionsForUser(@PathVariable Long userId) {
        requireUser(userId);
        return transactionRepository.findByAccount_Owner_Id(userId);
    }

    private void requireUser(Long userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
        }
    }
}

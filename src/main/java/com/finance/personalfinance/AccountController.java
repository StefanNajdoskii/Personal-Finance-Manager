
package com.finance.personalfinance;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    private final AccountRepository repository;
    private final TransactionRepository transactionRepository;

    public AccountController(
            AccountRepository repository,
            TransactionRepository transactionRepository) {
        this.repository = repository;
        this.transactionRepository = transactionRepository;
    }

    @GetMapping
    public List<Account> getAllAccounts() {
        return repository.findAll();
    }

    @PostMapping
    public Account createAccount(@RequestBody Account account) {

        if (account.getName() == null || account.getName().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Account name is required");
        }

        if (account.getType() == null || account.getType().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Account type is required");
        }

        if (account.getCurrency() == null || account.getCurrency().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Currency is required");
        }

        if (account.getBalance() == null) {
            account.setBalance(BigDecimal.ZERO);
        }

        if (account.getBalance().compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Initial balance cannot be negative");
        }

        account.setName(account.getName().trim());
        account.setType(account.getType().trim());
        account.setCurrency(account.getCurrency().trim().toUpperCase());

        if (account.getInstitution() != null) {
            account.setInstitution(account.getInstitution().trim());
        }

        return repository.save(account);
    }


    @DeleteMapping("/{id}")
    @Transactional
    public void deleteAccount(@PathVariable Long id) {
        Account account = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Account not found"));

        transactionRepository.detachTransactionsFromAccount(id);
        repository.delete(account);
    }


}

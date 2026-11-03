package com.finance.personalfinance;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String username;

    @Column(nullable = false)
    private String passwordHash;

    // Default is set in the column itself so existing rows get a value when the schema updates
    @Column(nullable = false, columnDefinition = "varchar(20) not null default 'USER'")
    private String role = "USER";

    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    // BCrypt hash of the one-time recovery code; null until the user generates one
    private String recoveryCodeHash;

    public User() {
    }

    public User(String username, String passwordHash) {
        this.username = username;
        this.passwordHash = passwordHash;
    }

    public Long getId() {
        return id;
    }

    public String getUsername() {
        return username;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public String getRecoveryCodeHash() {
        return recoveryCodeHash;
    }

    public void setRecoveryCodeHash(String recoveryCodeHash) {
        this.recoveryCodeHash = recoveryCodeHash;
    }

    public String getRole() {
        return role;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}

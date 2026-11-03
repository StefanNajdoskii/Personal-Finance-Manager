package com.finance.personalfinance;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.authentication.rememberme.TokenBasedRememberMeServices;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    public record RegisterRequest(
            @NotBlank
            @Size(min = 3, max = 50)
            @Pattern(regexp = "^[A-Za-z0-9_.-]+$",
                    message = "Username may only contain letters, digits, '.', '-' and '_'")
            String username,

            @NotBlank
            @Size(min = 8, max = 100)
            String password) {
    }

    public record LoginRequest(
            @NotBlank String username,
            @NotBlank String password,
            // Boxed so a missing field means "false" instead of a 400 from the JSON mapper
            Boolean rememberMe) {
    }

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TokenBasedRememberMeServices rememberMeServices;
    private final HttpSessionSecurityContextRepository securityContextRepository =
            new HttpSessionSecurityContextRepository();

    public AuthController(UserRepository userRepository, PasswordEncoder passwordEncoder,
                          TokenBasedRememberMeServices rememberMeServices) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.rememberMeServices = rememberMeServices;
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@Valid @RequestBody RegisterRequest request) {
        String username = request.username().trim();

        if (userRepository.existsByUsername(username)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username is already taken");
        }

        User user = new User(username, passwordEncoder.encode(request.password()));
        String recoveryCode = newRecoveryCode();
        user.setRecoveryCodeHash(hashRecoveryCode(recoveryCode));
        user = userRepository.save(user);

        // The recovery code is shown only once; only its hash is stored
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(Map.of("id", user.getId(), "username", user.getUsername(),
                        "recoveryCode", recoveryCode));
    }

    public record ResetRequest(
            @NotBlank String username,
            @NotBlank String recoveryCode,
            @NotBlank
            @Size(min = 8, max = 100)
            String newPassword) {
    }

    /** Sets a new password when the username and recovery code match. The code is single-use. */
    @PostMapping("/reset")
    public Map<String, String> resetPassword(@Valid @RequestBody ResetRequest request) {
        String code = normalizeRecoveryCode(request.recoveryCode());

        User user = userRepository.findByUsername(request.username().trim())
                .filter(u -> u.getRecoveryCodeHash() != null
                        && passwordEncoder.matches(code, u.getRecoveryCodeHash()))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Wrong username or recovery code"));

        // Changing the password also invalidates any "remember me" cookies (their signature uses the hash)
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        String newCode = newRecoveryCode();
        user.setRecoveryCodeHash(hashRecoveryCode(newCode));
        userRepository.save(user);

        return Map.of("recoveryCode", newCode);
    }

    /** Creates a new recovery code for the logged-in user, replacing any old one. */
    @PostMapping("/recovery-code")
    public Map<String, String> regenerateRecoveryCode(Authentication authentication) {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Not logged in"));

        String code = newRecoveryCode();
        user.setRecoveryCodeHash(hashRecoveryCode(code));
        userRepository.save(user);

        return Map.of("recoveryCode", code);
    }

    // 16 characters from an alphabet without look-alikes (0/O, 1/I/L), shown as XXXX-XXXX-XXXX-XXXX
    private static final String CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private static String newRecoveryCode() {
        StringBuilder raw = new StringBuilder();
        for (int i = 0; i < 16; i++) {
            raw.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
        }
        return raw.substring(0, 4) + "-" + raw.substring(4, 8) + "-"
                + raw.substring(8, 12) + "-" + raw.substring(12, 16);
    }

    /** Accepts the code with or without dashes and spaces, in any letter case. */
    private static String normalizeRecoveryCode(String input) {
        return input.replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT);
    }

    /** Hashes the normalised form, so the displayed dashes never matter. */
    private String hashRecoveryCode(String code) {
        return passwordEncoder.encode(normalizeRecoveryCode(code));
    }

    @PostMapping("/login")
    public Map<String, Object> login(@Valid @RequestBody LoginRequest request,
                                     HttpServletRequest httpRequest,
                                     HttpServletResponse httpResponse) {
        User user = userRepository.findByUsername(request.username().trim())
                .filter(u -> passwordEncoder.matches(request.password(), u.getPasswordHash()))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Invalid username or password"));

        // Prevent session fixation: make sure a session exists, then rotate its ID
        httpRequest.getSession(true);
        httpRequest.changeSessionId();

        // UserDetails principal (with the password hash) is what remember-me needs to sign its cookie
        UserDetails principal = org.springframework.security.core.userdetails.User
                .withUsername(user.getUsername())
                .password(user.getPasswordHash())
                .roles(user.getRole())
                .build();
        Authentication authentication = new UsernamePasswordAuthenticationToken(
                principal, null, principal.getAuthorities());

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, httpRequest, httpResponse);

        // Persistent cookie only when asked for; otherwise clear any old one
        if (Boolean.TRUE.equals(request.rememberMe())) {
            rememberMeServices.loginSuccess(httpRequest, httpResponse, authentication);
        } else {
            rememberMeServices.logout(httpRequest, httpResponse, authentication);
        }

        return Map.of("id", user.getId(), "username", user.getUsername());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        Authentication current = SecurityContextHolder.getContext().getAuthentication();
        rememberMeServices.logout(httpRequest, httpResponse, current);

        var session = httpRequest.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        SecurityContextHolder.clearContext();
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public Map<String, Object> me(Authentication authentication) {
        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Not logged in"));

        return Map.of("id", user.getId(), "username", user.getUsername());
    }
}

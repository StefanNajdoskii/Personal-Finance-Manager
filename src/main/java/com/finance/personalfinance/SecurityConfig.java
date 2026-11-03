package com.finance.personalfinance;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.rememberme.TokenBasedRememberMeServices;

import java.util.UUID;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private static final int REMEMBER_ME_SECONDS = 30 * 24 * 60 * 60; // 30 days

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /** Loads users for the remember-me cookie. The password hash is part of the cookie signature. */
    @Bean
    public UserDetailsService userDetailsService(UserRepository userRepository) {
        return username -> userRepository.findByUsername(username)
                .map(u -> org.springframework.security.core.userdetails.User
                        .withUsername(u.getUsername())
                        .password(u.getPasswordHash())
                        .roles(u.getRole())
                        .build())
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
    }

    /**
     * Persistent "Remember me" cookie. alwaysRemember is on because AuthController only
     * calls loginSuccess() when the user ticked the box. If no key is configured, a random
     * one is used, so remembered logins end when the server restarts.
     */
    @Bean
    public TokenBasedRememberMeServices rememberMeServices(
            UserDetailsService userDetailsService,
            @Value("${remember-me.key:}") String key) {
        TokenBasedRememberMeServices services = new TokenBasedRememberMeServices(
                key.isBlank() ? UUID.randomUUID().toString() : key,
                userDetailsService);
        services.setAlwaysRemember(true);
        services.setTokenValiditySeconds(REMEMBER_ME_SECONDS);
        return services;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   TokenBasedRememberMeServices rememberMeServices) throws Exception {
        http
            // Session-cookie API used by the browser frontend. JSON bodies can't be
            // sent cross-site without a CORS preflight, so CSRF is disabled for /api/**.
            .csrf(csrf -> csrf.ignoringRequestMatchers("/api/**"))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/", "/index.html", "/css/**", "/js/**", "/*.css", "/*.js", "/error",
                        "/api/health", "/api/auth/register", "/api/auth/login",
                        "/api/auth/logout", "/api/auth/reset").permitAll()
                .requestMatchers("/api/users/**", "/api/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated()
            )
            // Return 401 instead of redirecting to a login page
            .exceptionHandling(ex -> ex
                .authenticationEntryPoint((request, response, authException) ->
                        response.sendError(HttpStatus.UNAUTHORIZED.value(), "Unauthorized"))
            )
            // Restores the session from the "Remember me" cookie when the session has expired
            .rememberMe(remember -> remember.rememberMeServices(rememberMeServices))
            .httpBasic(basic -> basic.disable())
            .formLogin(form -> form.disable())
            .logout(logout -> logout.disable());

        return http.build();
    }
}

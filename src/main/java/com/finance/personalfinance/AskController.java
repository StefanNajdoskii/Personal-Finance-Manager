package com.finance.personalfinance;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/ask")
public class AskController {

    private final AskService askService;
    private final UserRepository userRepository;

    public AskController(AskService askService, UserRepository userRepository) {
        this.askService = askService;
        this.userRepository = userRepository;
    }

    @PostMapping
    public AskResponse ask(@RequestBody AskRequest request, Authentication authentication) {
        if (request == null || request.question() == null || request.question().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Question is required");
        }

        User user = userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.UNAUTHORIZED, "Not logged in"));

        return new AskResponse(askService.answer(user.getId(), request.question().trim()));
    }
}

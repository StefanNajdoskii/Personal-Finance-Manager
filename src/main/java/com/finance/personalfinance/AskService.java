package com.finance.personalfinance;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.SocketTimeoutException;
import java.time.Duration;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

@Service
public class AskService {

    static final String SYSTEM_PROMPT = """
            You are a personal finance assistant.
            Answer ONLY from the transaction data provided in the user message.
            Do not use outside knowledge and do not guess.
            If the data does not contain the answer, say clearly that you cannot tell from the data.
            Keep the answer short and clear.
            """;

    static final String FALLBACK_ANSWER =
            "I could not come up with an answer. Please try rephrasing your question.";
    static final String MODEL_NOT_RUNNING =
            "The AI model is not running. Start Ollama on this machine and try again.";
    static final String MODEL_TIMEOUT =
            "The AI model took too long to respond. Please try again.";

    private final TransactionRepository transactionRepository;
    private final RestClient restClient;
    private final String model;

    public AskService(
            TransactionRepository transactionRepository,
            @Value("${ollama.base-url}") String baseUrl,
            @Value("${ollama.model}") String model,
            @Value("${ollama.read-timeout:120s}") Duration readTimeout) {

        this.transactionRepository = transactionRepository;
        this.model = model;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(5));
        requestFactory.setReadTimeout(readTimeout);

        this.restClient = RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .build();
    }

    /**
     * Answers a question using only the given user's transactions.
     * Never throws for model problems; returns a user-friendly message instead.
     */
    public String answer(Long ownerId, String question) {
        List<Transaction> transactions = transactionRepository.findByAccount_Owner_Id(ownerId)
                .stream()
                .sorted(Comparator.comparing(Transaction::getDate,
                                Comparator.nullsLast(Comparator.<LocalDate>naturalOrder()))
                        .thenComparing(Transaction::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();

        String userMessage = buildUserMessage(transactions, question);

        Map<String, Object> body = Map.of(
                "model", model,
                "stream", false,
                "messages", List.of(
                        Map.of("role", "system", "content", SYSTEM_PROMPT),
                        Map.of("role", "user", "content", userMessage)));

        try {
            OllamaChatResponse response = restClient.post()
                    .uri("/api/chat")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(OllamaChatResponse.class);

            String content = response == null || response.message() == null
                    ? null
                    : response.message().content();

            return (content == null || content.isBlank()) ? FALLBACK_ANSWER : content.trim();

        } catch (ResourceAccessException e) {
            // Connection refused / host unreachable, or a read timeout
            return hasCause(e, SocketTimeoutException.class) ? MODEL_TIMEOUT : MODEL_NOT_RUNNING;

        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == 404) {
                return "The model '" + model + "' is not installed in Ollama. Run: ollama pull " + model;
            }
            return "The AI model returned an error (HTTP " + e.getStatusCode().value() + ").";

        } catch (RestClientException e) {
            return FALLBACK_ANSWER;
        }
    }

    String buildUserMessage(List<Transaction> transactions, String question) {
        BigDecimal income = BigDecimal.ZERO;
        BigDecimal expenses = BigDecimal.ZERO;

        StringBuilder lines = new StringBuilder();
        for (Transaction t : transactions) {
            BigDecimal amount = t.getAmount() == null ? BigDecimal.ZERO : t.getAmount();
            if ("INCOME".equals(t.getType())) {
                income = income.add(amount);
            } else if ("EXPENSE".equals(t.getType())) {
                expenses = expenses.add(amount);
            }

            lines.append(String.join(" | ",
                    t.getDate() == null ? "unknown date" : t.getDate().toString(),
                    String.valueOf(t.getType()),
                    amount.setScale(2, RoundingMode.HALF_UP).toPlainString(),
                    t.getCategory() == null || t.getCategory().isBlank() ? "uncategorized" : t.getCategory(),
                    singleLine(t.getTitle())))
                    .append('\n');
        }

        BigDecimal balance = income.subtract(expenses);

        return """
                Totals (already calculated, use these exact numbers):
                - Total income: %s
                - Total expenses: %s
                - Balance (income minus expenses): %s

                Transactions (format: date | type | amount | category | title):
                %s
                Question: %s
                """.formatted(
                money(income),
                money(expenses),
                money(balance),
                transactions.isEmpty() ? "(no transactions recorded)\n" : lines,
                singleLine(question));
    }

    private static String money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private static String singleLine(String text) {
        return text == null ? "" : text.replaceAll("[\\r\\n]+", " ").trim();
    }

    private static boolean hasCause(Throwable e, Class<? extends Throwable> type) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (type.isInstance(t)) {
                return true;
            }
        }
        return false;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OllamaChatResponse(OllamaMessage message) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OllamaMessage(String role, String content) {
    }
}

# FinTrack

**A personal finance manager with a built-in AI assistant that answers questions about your own spending.**

> 🎬 **Demo video:** _[link coming soon]_

<!-- Screenshot placeholders: replace with real images, e.g. ![Dashboard](docs/images/dashboard.png) -->

| Dashboard | Transactions | AI assistant |
|-----------|--------------|--------------|
| _screenshot_ | _screenshot_ | _screenshot_ |

## Features

**Accounts**
- Bank, cash, crypto and investment accounts, each with its own currency (MKD, EUR, USD, USDT, BTC, ETH)
- Total balance across all accounts, converted to MKD where a rate is available
- Registration, login and per-user data: each user sees only their own accounts and transactions
- Remember-me login on a device (30-day cookie)
- Password recovery with a one-time recovery code, shown at registration and regenerable in Settings

**Income and expenses**
- Add income and expense transactions to any of your accounts
- Expenses cannot exceed the account balance
- Transaction list with filters

**Dashboard**
- Total balance and per-account cards
- Charts for spending by category (doughnut) and income vs. expenses over time (bar)

**Experience**
- Light and dark theme
- English and Macedonian interface
- Responsive layout with bottom navigation on small screens

**AI assistant**
- Floating chat panel on every page after login (see [AI Assistant](#ai-assistant))

## AI Assistant

Ask questions about your spending in plain language, either by typing them or by clicking one of the suggested questions, such as "How much did I spend in total?" or "Am I spending more than I earn?".

A local language model running in [Ollama](https://ollama.com) answers from your own transactions:

1. The backend loads **only the logged-in user's** transactions.
2. It calculates the totals itself, in Java, using `BigDecimal`: total income, total expenses and the balance. These figures are passed to the model as fixed numbers, so the model is never asked to do arithmetic.
3. It builds a prompt with the totals and one line per transaction (`date | type | amount | category | title`).
4. The model is instructed to answer **only** from that data, to say when the data does not contain the answer, and to keep replies short.
5. The answer is returned to the chat.

Everything runs on your machine. No transaction data is sent to an external AI service.

## Tech Stack

- **Backend:** Java 21, Spring Boot 4, Spring Web MVC, Spring Data JPA, Spring Security, Bean Validation
- **Database:** PostgreSQL
- **AI:** Ollama with a local model (default `qwen2.5-coder:3b`), called through Spring `RestClient`
- **Frontend:** HTML, CSS and vanilla JavaScript (ES modules), Chart.js and Lucide icons from a CDN
- **Build:** Maven (with the Maven wrapper)

## Getting Started

### Prerequisites

- **JDK 21** (the project targets Java 21)
- **PostgreSQL**, running on `localhost:5432`
- **Ollama** (only needed for the AI assistant): https://ollama.com/download

### 1. Create the database

```sql
CREATE DATABASE personalfinance;
```

Tables are created automatically on first start (`spring.jpa.hibernate.ddl-auto=update`).

### 2. Configure the connection

Edit `src/main/resources/application.properties` and set your PostgreSQL username and password:

```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/personalfinance
spring.datasource.username=postgres
spring.datasource.password=your-password-here
```

Keep real passwords out of version control. Setting them through environment variables or a local, untracked properties file is a safer option.

### 3. Set up Ollama (optional, for the AI assistant)

Install Ollama, then download the model once:

```bash
ollama pull qwen2.5-coder:3b
```

Ollama runs at `http://localhost:11434` by default. The model and address are set in `application.properties`:

```properties
ollama.base-url=http://localhost:11434
ollama.model=qwen2.5-coder:3b
ollama.read-timeout=120s
```

The model runs on the CPU, so answers can take a while. The read timeout is set to 120 seconds to allow for this.

> **CUDA error?** If Ollama reports a CUDA or GPU error, you can force CPU-only mode by starting the server with `CUDA_VISIBLE_DEVICES=-1` (on Windows PowerShell: `$env:CUDA_VISIBLE_DEVICES="-1"; ollama serve`). The model then runs entirely on the CPU.

If Ollama is not running, the assistant replies that the AI model is not running. The rest of the app works normally.

### 4. Run the app

```bash
./mvnw spring-boot:run
```

On Windows, use `mvnw.cmd spring-boot:run`.

Open **http://localhost:8080**, register an account and start adding accounts and transactions.

## Known Limitations

- **Crypto accounts in BTC and ETH are excluded from the total balance**, because no exchange rate is available for them. The dashboard notes how many accounts were left out. USDT is treated as USD.
- **Transactions are not converted between currencies.** Each transaction is shown in its account's currency. Only the dashboard totals are converted to MKD.
- **The EUR rate is fixed at 61.5 MKD.** The USD rate is derived from a live EUR/USD rate, with a fallback value if the rate service is unavailable.
- **AI totals add up raw amounts.** The assistant's income, expense and balance figures sum transaction amounts without converting currencies. Mixing currencies gives misleading totals in its answers.
- **Small local models can be wrong.** The model answers from the data it is given, but a small model can still misread, miscount or invent details. Check important answers against the dashboard.
- **Answers can be slow** on CPU-only machines, and the first answer after a restart is the slowest.

## Future Improvements

- Live cryptocurrency prices, so crypto accounts count toward the total balance
- Currency conversion for transactions and for AI answers
- Filtering transactions by date range before they are sent to the model, to keep prompts small and answers faster
- Structured model output (JSON with a fixed schema), so answers can link to specific transactions and figures can be checked automatically

## Test questions

`docs/ask-test-questions.md` lists 12 questions for checking the assistant's answer quality, including one the data cannot answer.

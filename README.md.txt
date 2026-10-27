# Personal Finance Manager

Web application for tracking personal finances: bank, cash and crypto accounts, income and expenses, and a total balance across everything.

![Dashboard](screenshots/dashboard.png)

## Features
- Dashboard with total balance and all accounts
- Add accounts (bank, cash, crypto) and transactions (income or expense)
- Transactions list
- Light and dark theme
- English and Macedonian language
- Mobile layout with bottom navigation

## Tech stack
- Backend: Java, Spring Boot, Spring Web, Spring Data JPA, Validation
- Database: PostgreSQL
- Frontend: HTML, CSS, JavaScript
- Build: Maven

## How to run
1. Install JDK 17+ and PostgreSQL.
2. Create a database and set the connection details in `src/main/resources/application.properties`.
3. Run `./mvnw spring-boot:run`
4. Open http://localhost:8080
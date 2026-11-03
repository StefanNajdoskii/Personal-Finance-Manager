# Ask feature: test questions

Use these 12 questions to check answer quality of `POST /api/ask` with your own data.
Ask each one while logged in, then compare the answer with the numbers on the dashboard
or with `GET /api/transactions/summary`.

The totals (income, expenses, balance) are calculated in Java and given to the model,
so the model should quote them exactly. Questions 9 and 10 are the most important for
checking that the model does not invent numbers.

| # | Question | What a correct answer looks like |
|---|----------|----------------------------------|
| 1 | How much did I spend in total? | Equals the "Total expenses" value from the summary endpoint. |
| 2 | How much did I spend on food? | Sum of all EXPENSE rows whose category is food-related (for example "Food"). Check by adding them up by hand. |
| 3 | Which category did I spend the most on? | Names the category with the highest sum of EXPENSE rows, not just the most frequent one. |
| 4 | What was my biggest expense? | Names the single largest EXPENSE row, with its amount, date, and title. |
| 5 | What was my biggest income? | Names the single largest INCOME row, with its amount and date. |
| 6 | How much money did I earn in total? | Equals "Total income" from the summary endpoint. |
| 7 | Did I spend more than I earned? | Yes or no, consistent with the totals. A "yes" means expenses are greater than income. |
| 8 | What is my current balance? | Equals "Balance" from the summary endpoint. |
| 9 | How many transactions did I make in October? | Counts only rows dated in October. Compare with a manual count. Should say so clearly if it cannot count reliably. |
| 10 | What will my balance be next month? | Says it cannot tell from the data. It must not predict a number. |
| 11 | Which day did I spend the most money? | Adds EXPENSE amounts per date and names the highest day, or explains that the data is not enough. |
| 12 | Did I pay for anything with cryptocurrency? | Says it cannot tell (or lists matching rows if a category or title mentions crypto). It must not claim something the data does not show. |

## How to run the checks

```bash
# 1. Log in (cookie saved to cj.txt)
curl -c cj.txt -X POST http://localhost:8080/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"YOUR_USER","password":"YOUR_PASSWORD"}'

# 2. Ask a question
curl -b cj.txt -X POST http://localhost:8080/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"question":"How much did I spend on food?"}'
```

## Things to watch for

- Numbers that do not match the summary endpoint or your own sums.
- Invented categories, dates, or transactions that are not in your data.
- Long answers. The system prompt asks for short, clear replies.
- Answers to questions 10 and 12 that give a confident number. These should be "I cannot tell".
- Slow responses. On CPU, the first answer after a restart can take a long time.

# Oligopoly closed forms (linear demand)

Closed-form results for inverse demand P = a - bQ and constant marginal cost c (standard practice; deriving
them case by case from best-response functions is the method to show). Use them to check a hand solution or to size a rival's response quickly.

## Formulas
| Setting | Each firm's output | Market price |
|---|---|---|
| Monopoly | Q = (a - c) / 2b | (a + c) / 2 |
| Cournot, n identical firms | q = (a - c) / (b(n + 1)) | (a + nc) / (n + 1) |
| Cournot, two firms, costs c1 and c2 | q1 = (a - 2c1 + c2) / 3b | a - b(q1 + q2) |
| Stackelberg, leader then follower, same cost | leader (a - c) / 2b; follower (a - c) / 4b | (a + 3c) / 4 |
| Bertrand, identical | price = c | c |
| Bertrand, c1 < c2 | low-cost firm serves all at just under c2 | just under c2 |
Best response in Cournot (two firms): q1 = (a - c - b q2) / 2b. As n grows, price falls toward c.

## Worked check (illustrative numbers)
P = 100 - Q, c = 10.
- Monopoly: Q = 45, P = 55, profit 2,025.
- Cournot duopoly: best response q1 = 45 - 0.5 q2; solving gives 30 each, Q = 60, P = 40, profit 900 each
  (1,800 total, below monopoly: each firm's urge to add output erodes the joint profit).
- Three firms: 22.5 each, P = 32.5. Price keeps falling as firms enter.
- Stackelberg: leader 45, follower 22.5, P = 32.5; leader earns 1,012.5, follower 506.25. Committing first pays.
- Cournot with costs 10 and 20: outputs about 33.3 and 23.3; the cheaper firm takes the larger share.
- Bertrand with costs 10 and 20: the low-cost firm prices just under 20, sells about 80, earns about 800.

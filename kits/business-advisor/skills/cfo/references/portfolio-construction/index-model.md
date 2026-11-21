# Single-index model: optimal risky portfolio (active + index)

Inputs per security i: alpha α_i (expected excess return beyond β_i × market premium), beta β_i,
residual variance σ²(e_i). Market: E(R_M) and σ_M².

Model: R_i = α_i + β_i R_M + e_i. Then σ_i² = β_i² σ_M² + σ²(e_i); Cov(i, j) = β_i β_j σ_M².

Steps:
1. Raw weight w_i⁰ = α_i / σ²(e_i).
2. Scale to sum to 1: w_i = w_i⁰ / Σ w_j⁰.
3. Active portfolio alpha α_A = Σ w_i α_i; beta β_A = Σ w_i β_i; residual variance σ²(e_A) = Σ w_i² σ²(e_i).
4. Initial active weight w_A⁰ = [α_A / σ²(e_A)] / [E(R_M) / σ_M²].
5. Adjust for beta: w_A* = w_A⁰ / [1 + (1 − β_A) w_A⁰]. Index weight w_M = 1 − w_A*.
6. Security weights in the whole risky portfolio: w_A* × w_i.
7. E(R_P) = (w_M + w_A* β_A) E(R_M) + w_A* α_A;
   σ_P² = (w_M + w_A* β_A)² σ_M² + (w_A* σ(e_A))².
8. Gain from active management: S_P² = S_M² + (α_A / σ(e_A))², i.e. the active portfolio's
   information ratio squared adds to the index Sharpe ratio squared.

Note: alphas are forecasts. Small or noisy alphas give a small active weight, which is the right
answer when the analyst's edge is weak. Shrink alpha forecasts toward zero before use (standard
practice).

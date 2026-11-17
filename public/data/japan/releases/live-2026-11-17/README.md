# Japan composite: November 17, 2026 release

Survey endpoint October 2026; observed CPI through September; nominal yields and BEI monthly averages through October. November daily observations are excluded. Full-sample parameters and measurement weights are re-estimated; historical filtered and smoothed paths can change. This is not a real-time vintage backtest.

Three optimizer starts converged (log likelihood differences below 4e-8). The slope innovation variance remains effectively zero, as in the paper; normal approximation uncertainty is unreliable at this boundary. Confidence intervals retain the paper's truncated-parameter simulation method (500 draws, seed 123). No change in model specification.

Derived CSV and JSON outputs are public. Original revised input workbooks are kept in the ignored isolated run directory; manifest hashes identify them. Obtain licensed inputs separately to reproduce the live release. Root data/output/draft and the paper Git tag remain frozen.

The paper dashboard download curves are reconstructed from its rounded JSON; the paper tag preserves original full precision outputs. The pre-existing dashboard is archived separately as dashboard-legacy.

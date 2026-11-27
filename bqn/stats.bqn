# Mean distance over d=0..4 only. The >=5 bin is excluded from numerator and denominator.
# Second line: share of all samples in the >=5 bin, as a count over the sample size.
bins ← 32‿236‿1109‿3244‿8323‿87056
near ← 5↑bins
num ← +´ (↕5) × near
den ← +´ near
•Out "mean d=0..4 (>=5 excluded): " ∾ (•Fmt num) ∾ "/" ∾ •Fmt den
•Out "share >=5: " ∾ (•Fmt ¯1 ⊑ bins) ∾ "/" ∾ •Fmt +´ bins

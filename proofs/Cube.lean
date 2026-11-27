-- The 6 Cube, sticker slots 0..53.
-- Source of R and L: context/move_perm.json.
-- A list `p` is the map "sticker at slot i moves to slot p[i]".
-- `seq [p, q, r]` applies p, then q, then r (left to right, move order).
-- With that convention, R * L * R⁻¹ is `seq [R, L, R, R, R]`,
-- because the theorem `R_pow_four` gives R⁻¹ = R^3, and 1 is `List.range 54`.

import Init

def apply1 (p : List Nat) (i : Nat) : Nat :=
  match p.drop i with
  | n :: _ => n
  | [] => 0

def seq (ps : List (List Nat)) : List Nat :=
  (List.range 54).map fun i =>
    ps.foldl (fun slot p => apply1 p slot) i

def R : List Nat := [0, 1, 2, 3, 4, 5, 51, 52, 53, 11, 14, 17, 10, 13, 16, 9, 12, 15, 18, 19, 20, 21, 22, 23, 8, 7, 6, 27, 28, 29, 30, 31, 32, 24, 25, 26, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 35, 34, 33]

def L : List Nat := [20, 19, 18, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 27, 28, 29, 21, 22, 23, 24, 25, 26, 47, 46, 45, 30, 31, 32, 33, 34, 35, 42, 39, 36, 43, 40, 37, 44, 41, 38, 0, 1, 2, 48, 49, 50, 51, 52, 53]

theorem R_pow_four : seq [R, R, R, R] = List.range 54 := by rfl

theorem R_then_L_then_Rinv : seq [R, L, R, R, R] = L := by rfl

theorem R_and_L_commute : seq [R, L] = seq [L, R] := by rfl

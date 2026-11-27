-- The 6 Cube · property tests in Haskell (no packages beyond GHC's own base + array).
-- Checks the move table the site ships (Perms.hs, generated from the6cube/lab.js) obeys the cube's group laws.
-- Run: runghc Props.hs   (exit code 1 if any law fails)
module Main (main) where

import Data.Array (Array, listArray, (!))
import Data.List (foldl')
import Control.Monad (unless)
import System.Exit (exitFailure)
import Perms (perms, names)

type State = [Int]

table :: Array Int (Array Int Int)
table = listArray (0, 17) [ listArray (0, 53) p | p <- perms ]

solved :: State
solved = [0 .. 53]

-- pos[id] = slot holding sticker id; a move sends every slot to its new slot
apply :: Int -> State -> State
apply m = map (table ! m !)

run :: [Int] -> State -> State
run ms s = foldl' (flip apply) s ms

inv :: Int -> Int
inv m = case m `mod` 3 of { 0 -> m + 1; 1 -> m - 1; _ -> m }

idx :: String -> Int
idx n = head [ i | (i, x) <- zip [0 ..] names, x == n ]

-- a small linear congruential generator, so the test is reproducible without packages
lcg :: Int -> Int
lcg x = (1103515245 * x + 12345) `mod` 2147483648

randomSeqs :: Int -> [[Int]]
randomSeqs seed = go seed 10000
  where
    go _ 0 = []
    go s k = let s1 = lcg s; len = 1 + s1 `mod` 20; (ms, s2) = moves len s1 [] in ms : go s2 (k - 1)
    moves 0 s acc = (acc, s)
    moves n s acc = let s' = lcg s in moves (n - 1 :: Int) s' ((s' `div` 7) `mod` 18 : acc)

laws :: [(String, Bool)]
laws =
  [ ("every turn has order 4", all (\m -> run (replicate 4 m) solved == solved) [0 .. 17])
  , ("every turn undoes with its inverse", all (\m -> run [m, inv m] solved == solved) [0 .. 17])
  , ("X2 = X X", and [ run [f * 3 + 2] solved == run [f * 3, f * 3] solved | f <- [0 .. 5] ])
  , ("R L R' = L (opposite faces commute)", run [idx "R", idx "L", idx "R'"] solved == run [idx "L"] solved)
  , ("10,000 random sequences undo exactly", all (\ms -> run (ms ++ map inv (reverse ms)) solved == solved) (randomSeqs 1729))
  , ("every turn moves exactly 20 stickers", all (\m -> length (filter id (zipWith (/=) (run [m] solved) solved)) == 20) [0 .. 17])
  ]

main :: IO ()
main = do
  mapM_ (\(n, ok) -> putStrLn ((if ok then "ok   " else "FAIL ") ++ n)) laws
  unless (all snd laws) exitFailure
  putStrLn "all laws hold"

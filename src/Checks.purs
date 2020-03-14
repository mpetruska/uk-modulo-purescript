module ModulusCheck.Checks
       ( isStandardCheck
       , performStandardCheck
       , exception1Check
       , exceptions2And9Check
       , exception3Check
       , exception4Check
       , exception5Check
       , exception6Check
       , exception7Check
       , exception8Check
       , exceptions10and11Check
       , exceptions12and13Check
       , exception14Check
       ) where

import Prelude
import Data.Either (Either(..))
import Data.Foldable (all, sum)
import Data.Int (round, toNumber)
import Data.Lazy (Lazy, defer, force)
import Data.List (List(..), zipWith, (:))
import Data.Maybe (Maybe(..))
import Math ((%))

import ModulusCheck.Data.AccountNumber (AccountNumber, Digits, getDigit, replacePrefix, shiftAccountNumberRight)
import ModulusCheck.Data.CheckRow (CheckMethod(..), CheckRow, Weights, zeroiseUtoB)
import ModulusCheck.Data.Tables (getSortCodeSubstitution)
import ModulusCheckTypes (Error, CheckResult)

-- Standard checks
isStandardCheck :: CheckRow -> Boolean
isStandardCheck ({ exceptionCode: Nothing }) = true
isStandardCheck _                                     = false

performStandardCheck :: CheckRow -> AccountNumber -> Boolean
performStandardCheck (checkRow @ { checkMethod: DblAl }) accountNumber = doubleAlternateCheck checkRow.weights accountNumber.digits
performStandardCheck (checkRow @ { checkMethod: Mod10 }) accountNumber = mod10Check checkRow.weights accountNumber.digits
performStandardCheck (checkRow @ { checkMethod: Mod11 }) accountNumber = mod11Check checkRow.weights accountNumber.digits

-- Exception 1
exception1Check :: CheckRow -> AccountNumber -> Boolean
exception1Check checkRow accountNumber =
  modCheck 10 0 $ 27 + doubleAlternateSum checkRow.weights accountNumber.digits

-- Exception 2 and 9
exceptions2And9Check :: Weights -> Weights -> AccountNumber -> CheckResult
exceptions2And9Check weights2 weights9 accountNumber =
  anyEither (exception2Check weights2 accountNumber)
            (defer (\unit -> exception9Check weights9 accountNumber))

exception2Check :: Weights -> AccountNumber -> CheckResult
exception2Check weights accountNumber =
    let w = newWeights <$> getDigit 'a' accountNumber.digits <*> getDigit 'g' accountNumber.digits in
        flip mod11Check accountNumber.digits <$> w
  where
    nonNineSubstitute = 0 : 0 : 1 : 2 : 5 : 3 : 6 : 4 : 8 : 7 : 10 : 9 : 3 : 1 : Nil
    nineSubstitute    = 0 : 0 : 0 : 0 : 0 : 0 : 0 : 0 : 8 : 7 : 10 : 9 : 3 : 1 : Nil
    newWeights :: Int -> Int -> Weights
    newWeights 0 _ = weights
    newWeights _ 9 = nineSubstitute
    newWeights _ _ = nonNineSubstitute

exception9Check :: Weights -> AccountNumber -> CheckResult
exception9Check weights accountNumber = replacePrefix sortCodeReplacement accountNumber.digits >>= mod11Check weights >>> pure
  where
    sortCodeReplacement = 3 : 0 : 9 : 6 : 3 : 4 : Nil

-- Exception3
exception3Check :: CheckRow -> Weights -> AccountNumber -> CheckResult
exception3Check standardCheckRow dblAlCheckWeights accountNumber =
    getDigit 'c' accountNumber.digits >>= \c ->
      pure $ performStandardCheck standardCheckRow accountNumber &&
             performException3Check c dblAlCheckWeights accountNumber
  where
    performException3Check :: Int -> Weights -> AccountNumber -> Boolean
    performException3Check 6 _       _   = true
    performException3Check 9 _       _   = true
    performException3Check _ weights acc = doubleAlternateCheck weights acc.digits

-- Exception4
exception4Check :: Weights -> AccountNumber -> CheckResult
exception4Check w accountNumber = do
  g <- getDigit 'g' accountNumber.digits
  h <- getDigit 'h' accountNumber.digits
  pure $ modCheck 11 (g * 10 + h) $ standardModSum w accountNumber.digits

-- Exception5
exception5Check :: Weights -> Weights -> AccountNumber -> CheckResult
exception5Check mod11Weights dblAlWeights accountNumber = do
      replacedDigits <- sortCodeReplaced
      check1 <- firstCheck mod11Weights replacedDigits
      check2 <- secondCheck dblAlWeights replacedDigits
      pure $ check1 && check2
  where
    sortCodeReplaced :: Either Error Digits
    sortCodeReplaced = do
      substitution <- getSortCodeSubstitution accountNumber.sortCodeString
      case substitution of
        Just s  -> replacePrefix s accountNumber.digits
        Nothing -> pure accountNumber.digits
    
    performMod11Check :: Int -> Int -> Boolean
    performMod11Check sum 0 = modCheck 11 0 sum
    performMod11Check _   1 = false
    performMod11Check sum g = modCheck 11 (11 - g) sum
    
    firstCheck :: Weights -> Digits -> CheckResult
    firstCheck w d = getDigit 'g' d >>= performMod11Check (standardModSum w d) >>> pure
    
    performDblAlCheck :: Int -> Int -> Boolean
    performDblAlCheck sum 0 = modCheck 10 0 sum
    performDblAlCheck sum h = modCheck 10 (10 - h) sum
    
    secondCheck :: Weights -> Digits -> CheckResult
    secondCheck w d = getDigit 'h' d >>= performDblAlCheck (doubleAlternateSum w d) >>> pure

-- Exception 6
exception6Check :: List CheckRow -> AccountNumber -> CheckResult
exception6Check rows accountNumber = do
    a <- getDigit 'a' accountNumber.digits
    g <- getDigit 'g' accountNumber.digits
    h <- getDigit 'h' accountNumber.digits
    performCheck a (g == h)
  where
    performCheck :: Int -> Boolean -> CheckResult
    performCheck 4 true = pure true
    performCheck 5 true = pure true
    performCheck 6 true = pure true
    performCheck 7 true = pure true
    performCheck 8 true = pure true
    performCheck _ _    = pure $ all (\c -> performStandardCheck c accountNumber) rows

-- Exception 7
exception7Check :: CheckRow -> AccountNumber -> CheckResult
exception7Check row accountNumber = getDigit 'g' accountNumber.digits >>= performCheck >>> pure
  where
    performCheck :: Int -> Boolean
    performCheck 9 = performStandardCheck (zeroiseUtoB row) accountNumber
    performCheck _ = performStandardCheck row accountNumber

-- Exception 8
exception8Check :: CheckRow -> AccountNumber -> CheckResult
exception8Check row accountNumber = replaceSortCode accountNumber >>= performStandardCheck row >>> pure
  where
    replacement = 0 : 9 : 0 : 1 : 2 : 6 : Nil
    replaceSortCode :: AccountNumber -> Either Error AccountNumber
    replaceSortCode x = replacePrefix replacement x.digits >>= \newDigits -> pure $ x { digits = newDigits }

-- Exception 10 and 11
exceptions10and11Check :: CheckRow -> CheckRow -> AccountNumber -> CheckResult
exceptions10and11Check row1 row2 accountNumber =
    anyEither (exception10Check row1 accountNumber)
              (defer (\unit -> exception11Check row2 accountNumber))

exception10Check :: CheckRow -> AccountNumber -> CheckResult
exception10Check row accountNumber = do
    a <- getDigit 'a' accountNumber.digits
    b <- getDigit 'b' accountNumber.digits
    g <- getDigit 'g' accountNumber.digits
    pure $ performException10Check a b g
  where
    performException10Check :: Int -> Int -> Int -> Boolean
    performException10Check a 9 9
                          | a == 0 || a == 9  = performStandardCheck (zeroiseUtoB row) accountNumber
    performException10Check _ _ _             = performStandardCheck row accountNumber

exception11Check :: CheckRow -> AccountNumber -> CheckResult
exception11Check row = performStandardCheck row >>> pure

-- Exception 12 and 13
exceptions12and13Check :: CheckRow -> CheckRow -> AccountNumber -> Boolean
exceptions12and13Check row1 row2 accountNumber =
     performStandardCheck row1 accountNumber
  || performStandardCheck row2 accountNumber

-- Exception 14
exception14Check :: CheckRow -> AccountNumber -> CheckResult
exception14Check row accountNumber =
    anyEither (pure $ mod11Check row.weights accountNumber.digits)
              (defer performExceptionCheck)
  where
    checkWithH :: Int -> Boolean
    checkWithH h
           | h == 0 || h == 1 || h == 9 = mod11Check row.weights (shiftAccountNumberRight accountNumber.digits)
           | otherwise                  = false
    performExceptionCheck :: Unit -> CheckResult
    performExceptionCheck _ = getDigit 'h' accountNumber.digits >>= checkWithH >>> pure

-- Helpers
anyEither :: forall a. Either a Boolean -> Lazy (Either a Boolean) -> Either a Boolean
anyEither (result @ (Left x))     _ = result
anyEither (result @ (Right true)) _ = result
anyEither _                       y = force y

doubleAlternateCheck :: Weights -> Digits -> Boolean
doubleAlternateCheck w = doubleAlternateSum w >>> modCheck 10 0

mod10Check :: Weights -> Digits -> Boolean
mod10Check w = standardModSum w >>> modCheck 10 0

mod11Check :: Weights -> Digits -> Boolean
mod11Check w = standardModSum w >>> modCheck 11 0

doubleAlternateSum :: Weights -> Digits -> Int
doubleAlternateSum weights digits =
  sumDigits $ dotMul weights digits

standardModSum :: Weights -> Digits -> Int
standardModSum weights digits =
  sum $ dotMul weights digits

dotMul :: List Int -> List Int -> List Int
dotMul xs ys = zipWith (*) xs ys

sumDigits :: List Int -> Int
sumDigits xs = sum $ map digitSum xs
  where
    digitSum :: Int -> Int
    digitSum x = digitSumLoop 0 x
    digitSumLoop :: Int -> Int -> Int
    digitSumLoop acc x
                  | x < 10    = acc + x
                  | otherwise = digitSumLoop (acc + round (toNumber x % 10.0)) (x / 10)

modCheck :: Int -> Int -> Int -> Boolean
modCheck modulus expected x = round (toNumber x % toNumber modulus) == expected

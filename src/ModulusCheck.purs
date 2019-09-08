module ModulusCheck
       ( check
       , module ModulusCheckTypes
       ) where

import Prelude (pure, bind, ($))
import Data.Either (Either(..))
import Data.Foldable (all, foldl)
import Data.List (List(..), (:))
import Data.Maybe (Maybe(..))

import ModulusCheck.Checks ( isStandardCheck
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
                           )
import ModulusCheck.Data.AccountNumber (AccountNumber)
import ModulusCheck.Data.AccountNumber.Parser ( AccountNumberParser
                                              , parseAccountNumber
                                              , sixDigitAccountNumberParser
                                              , sevenDigitAccountNumberParser
                                              , standardAccountNumberParser
                                              , santanderAccountNumberParser
                                              , nationalWestMinsterAccountNumberParser
                                              , coOperativeOrLeedsBuildingSocietyAccountNumberParser
                                              )
import ModulusCheck.Data.CheckRow (CheckMethod(..), CheckRow)
import ModulusCheck.Data.Tables (getCheckRows)
import ModulusCheckTypes

check :: String -> String -> CheckResult
check sortCode accountNumber =
    case foldl collectResult Nothing parsers of
      Just result -> result
      Nothing     -> Left "Implementation error: no account number parsers defined"
  where
    parsers :: List AccountNumberParser
    parsers =
        standardAccountNumberParser
      : sixDigitAccountNumberParser
      : sevenDigitAccountNumberParser
      : santanderAccountNumberParser
      : nationalWestMinsterAccountNumberParser
      : coOperativeOrLeedsBuildingSocietyAccountNumberParser
      : Nil
      
    collectResult :: Maybe CheckResult -> AccountNumberParser -> Maybe CheckResult
    collectResult (Nothing) parser               = Just $ performCheckWithParser parser
    collectResult (Just result @ (Right true)) _ = Just result
    collectResult (Just previous) parser         =
      case performCheckWithParser parser of
        result @ (Right value) -> Just result
        _                      -> Just previous
    
    performCheckWithParser :: AccountNumberParser -> CheckResult
    performCheckWithParser accountNumberParser = do
      acc <- parseAccountNumber sortCode accountNumber accountNumberParser
      checkRows <- getCheckRows acc.sortCodeString
      performCheck checkRows acc

-- No rows in check table => no modulus check can be performed, must assume account number is valid
performCheck :: List CheckRow -> AccountNumber -> CheckResult
performCheck Nil _ = (Right true)

-- Exception 1
performCheck (checkRow @ { checkMethod: DblAl, exceptionCode: Just 1 } : Nil) accountNumber =
  Right $ exception1Check checkRow accountNumber

-- Exception 2 and 9
performCheck ( row1 @ { checkMethod: Mod11, exceptionCode: Just 2 }
             : row2 @ { checkMethod: Mod11, exceptionCode: Just 9 } : Nil ) accountNumber =
  exceptions2And9Check row1.weights row2.weights accountNumber

-- Exception3
performCheck ( row1 @ { exceptionCode: Nothing }
             : row2 @ { checkMethod: DblAl, exceptionCode: Just 3 } : Nil ) accountNumber =
  exception3Check row1 row2.weights accountNumber

-- Exception4
performCheck ( row @ { checkMethod: Mod11, exceptionCode: Just 4 } : Nil ) accountNumber =
  exception4Check row.weights accountNumber

-- Exception5
performCheck ( row1 @ { checkMethod: Mod11, exceptionCode: Just 5 }
             : row2 @ { checkMethod: DblAl, exceptionCode: Just 5 } : Nil ) accountNumber =
  exception5Check row1.weights row2.weights accountNumber

-- Exception 6
performCheck ( row1 @ { exceptionCode: Just 6 }
             : row2 @ { exceptionCode: Just 6 } : Nil ) accountNumber =
  exception6Check row1 row2 accountNumber

-- Exception 7
performCheck ( row @ { exceptionCode: Just 7 } : Nil ) accountNumber =
  exception7Check row accountNumber

-- Exception 8
performCheck ( row @ { exceptionCode: Just 8 } : Nil ) accountNumber =
  exception8Check row accountNumber

-- Exception 10 and 11
performCheck ( row1 @ { exceptionCode: Just 10 }
             : row2 @ { exceptionCode: Just 11 } : Nil ) accountNumber =
  exceptions10and11Check row1 row2 accountNumber

-- Exception 12 and 13
performCheck ( row1 @ { exceptionCode: Just 12 }
             : row2 @ { exceptionCode: Just 13 } : Nil ) accountNumber =
  pure $ exceptions12and13Check row1 row2 accountNumber

-- Exception 14
performCheck ( row1 @ { exceptionCode: Just 14 } : Nil) accountNumber =
  exception14Check row1 accountNumber

-- Standard checks
performCheck standardCheckRows accountNumber
             | all isStandardCheck standardCheckRows = Right $ all (\c -> performStandardCheck c accountNumber) standardCheckRows

performCheck _ _ = (Left "Check not implemented for the given account number")

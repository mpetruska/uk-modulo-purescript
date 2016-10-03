module ModulusCheck.Data.AccountNumber.Parser
       ( AccountNumberParser
       , DigitsParser
       , parseAccountNumber
       , standardAccountNumberParser
       , sixDigitAccountNumberParser
       , sevenDigitAccountNumberParser
       , santanderAccountNumberParser
       , nationalWestMinsterAccountNumberParser
       , coOperativeAccountNumberParser
       ) where

import Prelude
import Control.Apply ((<*))
import Data.Either (Either)
import Data.List (List(..), concat, take, (:))
import Text.Parsing.Parser (Parser)
import Text.Parsing.Parser.Combinators (optional)
import Text.Parsing.Parser.String (eof, string)

import ModulusCheck.Data.AccountNumber (AccountNumber, Digits, accountNumber)
import ModulusCheck.Parsers (digitsParser, parseWithError)
import ModulusCheckTypes (Error)

type DigitsParser = Parser String Digits
type AccountNumberParser = { accountDigitsParser :: DigitsParser
                           , transform           :: Digits -> Digits -> Digits }

sortCodeParser :: DigitsParser
sortCodeParser = digitsParser 6 <* eof

-- Six digit account numbers
sixDigitAccountNumberParser :: AccountNumberParser
sixDigitAccountNumberParser =
  { accountDigitsParser: digitsParser 6 <* eof
  , transform: \s a -> concat (s : (0 : 0 : Nil) : a : Nil)
  }

-- Seven digit account numbers
sevenDigitAccountNumberParser :: AccountNumberParser
sevenDigitAccountNumberParser =
  { accountDigitsParser: digitsParser 7 <* eof
  , transform: \s a -> concat (s : (0 : Nil) : a : Nil)
  }

-- Eight digit (standard) account numbers
standardAccountNumberParser :: AccountNumberParser
standardAccountNumberParser =
  { accountDigitsParser: digitsParser 8 <* eof
  , transform: \s a -> concat (s : a : Nil)
  }

-- Nine digit account numbers
santanderAccountNumberParser :: AccountNumberParser
santanderAccountNumberParser =
  { accountDigitsParser: digitsParser 9 <* eof
  , transform: \s a -> concat ((take 5 s) : a : Nil)
  }

-- Ten digit account numbers
nationalWestMinsterAccountNumberParser :: AccountNumberParser
nationalWestMinsterAccountNumberParser =
  { accountDigitsParser: do
      _ <- digitsParser 2
      _ <- optional (string "-")
      lastEight <- digitsParser 8
      _ <- eof
      pure lastEight
  , transform: \s a -> concat (s : a : Nil)
  }

coOperativeAccountNumberParser :: AccountNumberParser
coOperativeAccountNumberParser =
  { accountDigitsParser: digitsParser 8 <* digitsParser 2 <* eof
  , transform: \s a -> concat (s : a : Nil)
  }

parseAccountNumber :: String -> String -> AccountNumberParser -> Either Error AccountNumber
parseAccountNumber sortCodeString accountNumberString parser = do
  sortCodeDigits <- parseWithError "Sort code must contain exactly 6 decimal digits without dashes" sortCodeString sortCodeParser
  accountNumberDigits <- parseWithError "Account number format is not valid" accountNumberString parser.accountDigitsParser
  pure $ accountNumber sortCodeString (parser.transform sortCodeDigits accountNumberDigits)


module ModulusCheck.Data.CheckRow.Parser
       ( checkRowTableParser
       ) where

import Prelude
import Control.Alt ((<|>))
import Data.List (List)
import Text.Parsing.Parser (Parser)
import Text.Parsing.Parser.Combinators (optionMaybe, sepEndBy1)
import Text.Parsing.Parser.String (string)

import ModulusCheck.Data.CheckRow (CheckMethod(..), CheckRow, checkRow)
import ModulusCheck.Parsers (eol, exactly, integerParser, signedIntegerParser, stringDigitsParser, whiteSpace)

checkMethodParser :: Parser String CheckMethod
checkMethodParser =
      (string "DBLAL" >>= const (pure DblAl))
  <|> (string "MOD10" >>= const (pure Mod10))
  <|> (string "MOD11" >>= const (pure Mod11))

checkRowParser :: Parser String CheckRow
checkRowParser =
  checkRow <$> stringDigitsParser 6
           <*> (whiteSpace *> stringDigitsParser 6)
           <*> (whiteSpace *> checkMethodParser)
           <*> (whiteSpace *> (exactly 14 (whiteSpace *> signedIntegerParser)))
           <*> (optionMaybe (whiteSpace *> integerParser))

checkRowTableParser :: Parser String (List CheckRow)
checkRowTableParser = do
  (eol *> whiteSpace)
  checkRowParser `sepEndBy1` (eol *> whiteSpace)

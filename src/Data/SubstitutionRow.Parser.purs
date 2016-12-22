module ModulusCheck.Data.SubstitutionRow.Parser
       ( sortCodeSubstitutionTableParser
       ) where

import Prelude
import Data.Map (Map, fromFoldable)
import Data.Tuple (Tuple(..))
import Text.Parsing.Parser (Parser)
import Text.Parsing.Parser.Combinators (sepEndBy1)

import ModulusCheck.Data.AccountNumber (Digits)
import ModulusCheck.Data.SubstitutionRow (SubstitutionRow)
import ModulusCheck.Parsers (eol, digitsParser, stringDigitsParser, whiteSpace)

substitutionRowParser :: Parser String SubstitutionRow
substitutionRowParser = Tuple <$> stringDigitsParser 6
                       <*> (whiteSpace *> digitsParser 6)

sortCodeSubstitutionTableParser :: Parser String (Map String Digits)
sortCodeSubstitutionTableParser = do
  (eol *> whiteSpace)
  rows <- substitutionRowParser `sepEndBy1` (eol *> whiteSpace)
  pure $ fromFoldable rows

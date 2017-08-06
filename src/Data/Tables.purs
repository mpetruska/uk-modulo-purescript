module ModulusCheck.Data.Tables
       ( getCheckRows
       , getSortCodeSubstitution
       ) where

import Prelude
import Data.Either (Either)
import Data.List (List, filter)
import Data.Map (Map, lookup)
import Data.Maybe (Maybe)

import ModulusCheck.Data.AccountNumber (Digits)
import ModulusCheck.Data.CheckRow (CheckRow)
import ModulusCheck.Data.CheckRow.Parser (checkRowTableParser)
import ModulusCheck.Data.SubstitutionRow.Parser (sortCodeSubstitutionTableParser)
import ModulusCheck.Parsers (parse)
import ModulusCheck.Resources (scsubtab, valacdos_v440)
import ModulusCheckTypes (Error)

checkRowsTable :: Either Error (List CheckRow)
checkRowsTable = parse valacdos_v440 checkRowTableParser

-- TODO: needs optimization?
getCheckRows :: String -> Either Error (List CheckRow)
getCheckRows sortCodeString = do
    rows <- checkRowsTable
    pure $ filter relevantRow rows
  where
    relevantRow :: CheckRow -> Boolean
    relevantRow ({ from, to }) = (from <= sortCodeString) && (to >= sortCodeString)

sortCodeSubstitutionTable :: Either Error (Map String Digits)
sortCodeSubstitutionTable = parse scsubtab sortCodeSubstitutionTableParser

getSortCodeSubstitution :: String -> Either Error (Maybe Digits)
getSortCodeSubstitution sortCode = sortCodeSubstitutionTable >>= lookup sortCode >>> pure

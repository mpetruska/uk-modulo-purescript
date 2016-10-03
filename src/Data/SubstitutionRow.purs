module ModulusCheck.Data.SubstitutionRow
       ( SubstitutionRow
       ) where

import Data.Tuple (Tuple)

import ModulusCheck.Data.AccountNumber (Digits)

type SubstitutionRow = Tuple String Digits

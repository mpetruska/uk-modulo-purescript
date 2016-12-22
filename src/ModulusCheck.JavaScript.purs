module ModulusCheck.JavaScript
       ( ModulusCheckResult
       , check
       ) where

import Data.Either (either)
import Data.Function.Uncurried (Fn2, mkFn2)

import ModulusCheck as M

type ModulusCheckResult = { isValid :: Boolean
                          , isError :: Boolean
                          , error   :: String  }

check :: Fn2 String String ModulusCheckResult
check =
  mkFn2 \sortCode accountNumber ->
    either { isValid: false, isError: true, error: _ } { isValid: _, isError: false, error: "" }
           (M.check sortCode accountNumber)

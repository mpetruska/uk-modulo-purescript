module ModulusCheckTypes
       ( Error
       , CheckResult
       ) where

import Data.Either (Either)

type Error = String
type CheckResult = Either Error Boolean

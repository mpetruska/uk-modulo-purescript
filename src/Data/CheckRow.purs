module ModulusCheck.Data.CheckRow
       ( CheckMethod(..)
       , CheckRow
       , Weights
       , checkRow
       , showCheckRow
       , zeroiseUtoB
       ) where

import Prelude
import Data.Maybe (Maybe)
import Data.List (List(..), concat, drop, (:), (..))

data CheckMethod = DblAl
                 | Mod10
                 | Mod11

type Weights = List Int

type CheckRow = { from          :: String
                , to            :: String
                , checkMethod   :: CheckMethod
                , weights       :: Weights
                , exceptionCode :: Maybe Int
                }

instance showCheckMethod :: Show CheckMethod where
  show DblAl = "DblAl"
  show Mod10 = "Mod10"
  show Mod11 = "Mod11"

checkRow :: String -> String -> CheckMethod -> Weights -> Maybe Int -> CheckRow
checkRow from to checkMethod weights exceptionCode = { from, to, checkMethod, weights, exceptionCode }

showCheckRow :: CheckRow -> String
showCheckRow x =    "{ from: "          <> show x.from
                 <> ", to: "            <> show x.to
                 <> ", checkMethod: "   <> show x.checkMethod
                 <> ", weights: "       <> show x.weights
                 <> ", exceptionCode: " <> show x.exceptionCode <> " "
                 <> "}"

zeroiseUtoB :: CheckRow -> CheckRow
zeroiseUtoB row = row { weights = concat (zeroPrefix : drop8 : Nil) }
  where
    zeroPrefix = map (const 0) (1..8)
    drop8 = drop 8 row.weights

module ModulusCheck.Data.AccountNumber
       ( Digits
       , AccountNumber(..)
       , accountNumber
       , eqAccountNumber
       , getDigit
       , replacePrefix
       , showAccountNumber
       , shiftAccountNumberRight
       ) where

import Prelude
import Data.Either (Either(..))
import Data.List (List(..), concat, drop, length, take, (:), (!!))
import Data.Maybe (Maybe(..))
import Data.String (Pattern(..), indexOf, singleton)

import ModulusCheckTypes (Error)

type Digits = List Int
type AccountNumber = { sortCodeString :: String
                     , digits         :: Digits }

eqAccountNumber :: AccountNumber -> AccountNumber -> Boolean
eqAccountNumber x y =    x.sortCodeString `eq` y.sortCodeString
                      && x.digits `eq` y.digits

expectedDigitsLength :: Int
expectedDigitsLength = 14

accountNumber :: String -> Digits -> AccountNumber
accountNumber sortCodeString digits = { sortCodeString, digits }

showAccountNumber :: AccountNumber -> String
showAccountNumber x =    "{ sortCodeString: " <> show x.sortCodeString
                      <> ", digits: "         <> show x.digits         <> " "
                      <> "}"

getDigit :: Char -> Digits -> Either Error Int
getDigit code digits = toEither do
    i <- indexOf (Pattern (singleton code)) digitCodes
    digits !! i
  where
    digitCodes = "uvwxyzabcdefgh"
    toEither :: forall a. Maybe a -> Either Error a
    toEither (Nothing) = Left $ "Implementation error: char index " <> show code <> " is not valid for digits: " <> show digits
    toEither (Just x)  = Right x

replacePrefix :: Digits -> Digits -> Either Error Digits
replacePrefix newPrefix x = newDigits
  where
    replacementLength = length newPrefix
    newDigits :: Either Error Digits
    newDigits
      | replacementLength > expectedDigitsLength = Left $ "Implementation error: cannot replace with new prefix: " <> show newPrefix <> "in " <> show x
      | otherwise                                = Right $ concat (newPrefix : drop replacementLength x : Nil)

shiftAccountNumberRight :: Digits -> Digits
shiftAccountNumberRight digits =
  concat (take 6 digits : (0 : Nil) : take 7 (drop 6 digits) : Nil)

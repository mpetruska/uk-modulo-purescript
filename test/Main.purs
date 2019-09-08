module Test.Main where

import Prelude
import Data.Either (Either(..))
import Data.Foldable (for_)
import Data.List (List(..), concat, (:), (..))
import Effect (Effect)
import Test.Unit (Test, suite, test)
import Test.Unit.Assert as Assert
import Test.Unit.Main (runTest)

import ModulusCheck.Data.AccountNumber (Digits, eqAccountNumber, showAccountNumber)
import ModulusCheck.Data.AccountNumber.Parser ( AccountNumberParser
                                              , parseAccountNumber
                                              , standardAccountNumberParser
                                              , sixDigitAccountNumberParser
                                              , sevenDigitAccountNumberParser
                                              , santanderAccountNumberParser
                                              , nationalWestMinsterAccountNumberParser
                                              , coOperativeOrLeedsBuildingSocietyAccountNumberParser
                                              )
import ModulusCheck (check)

type StandardTestCase = { testNumber    :: Int
                        , description   :: String
                        , sortCode      :: String
                        , accountNumber :: String
                        , shouldPass    :: Boolean }

standardTestCase :: Int -> String -> String -> String -> Boolean -> StandardTestCase
standardTestCase testNumber description sortCode accountNumber shouldPass =
  { testNumber, description, sortCode, accountNumber, shouldPass }

standardTestCases :: List StandardTestCase
standardTestCases =
    standardTestCase 1 "Pass modulus 10 check." "089999" "66374958" true 
  : standardTestCase 2 "Pass modulus 11 check." "107999" "88837491" true 
  : standardTestCase 3 "Pass modulus 11 and double alternate checks." "202959" "63748472" true 
  : standardTestCase 4 "Exception 10 & 11 where first check passes and second check fails." "871427" "46238510" true 
  : standardTestCase 5 "Exception 10 & 11 where first check fails and second check passes." "872427" "46238510" true 
  : standardTestCase 6 "Exception 10 where in the account number ab=09 and the g=9. The first check passes and second check fails." "871427" "09123496" true 
  : standardTestCase 7 "Exception 10 where in the account number ab=99 and the g=9. The first check passes and the second check fails." "871427" "99123496" true 
  : standardTestCase 8 "Exception 3, and the sorting code is the start of a range. As c=6 the second check should be ignored." "820000" "73688637" true 
  : standardTestCase 9 "Exception 3, and the sorting code is the end of a range. As c=9 the second check should be ignored." "827999" "73988638" true 
  : standardTestCase 10 "Exception 3. As c<>6 or 9 perform both checks pass." "827101" "28748352" true 
  : standardTestCase 11 "Exception 4 where the remainder is equal to the checkdigit." "134020" "63849203" true 
  : standardTestCase 12 "Exception 1 – ensures that 27 has been added to the accumulated total and passes double alternate modulus check." "118765" "64371389" true 
  : standardTestCase 13 "Exception 6 where the account fails standard check but is a foreign currency account." "200915" "41011166" true 
  : standardTestCase 14 "Exception 5 where the check passes." "938611" "07806039" true 
  : standardTestCase 15 "Exception 5 where the check passes with substitution." "938600" "42368003" true 
  : standardTestCase 16 "Exception 5 where both checks produce a remainder of 0 and pass." "938063" "55065200" true 
  : standardTestCase 17 "Exception 7 where passes but would fail the standard check." "772798" "99345694" true 
  : standardTestCase 18 "Exception 8 where the check passes." "086090" "06774744" true 
  : standardTestCase 19 "Exception 2 & 9 where the first check passes." "309070" "02355688" true 
  : standardTestCase 20 "Exception 2 & 9 where the first check fails and second check passes with substitution." "309070" "12345668" true 
  : standardTestCase 21 "Exception 2 & 9 where a≠0 and g≠9 and passes." "309070" "12345677" true 
  : standardTestCase 22 "Exception 2 & 9 where a≠0 and g=9 and passes." "309070" "99345694" true 
  : standardTestCase 23 "Exception 5 where the first checkdigit is correct and the second incorrect." "938063" "15764273" false 
  : standardTestCase 24 "Exception 5 where the first checkdigit is incorrect and the second correct." "938063" "15764264" false 
  : standardTestCase 25 "Exception 5 where the first checkdigit is incorrect with a remainder of 1." "938063" "15763217" false 
  : standardTestCase 26 "Exception 1 where it fails double alternate check." "118765" "64371388" false 
  : standardTestCase 27 "Pass modulus 11 check and fail double alternate check." "203099" "66831036" false 
  : standardTestCase 28 "Fail modulus 11 check and pass double alternate check." "203099" "58716970" false 
  : standardTestCase 29 "Fail modulus 10 check." "089999" "66374959" false 
  : standardTestCase 30 "Fail modulus 11 check." "107999" "88837493" false 
  : standardTestCase 31 "Exception 12/13 where passes modulus 11 check (in this example, modulus 10 check fails, however, there is no need for it to be performed as the first check passed)." "074456" "12345112" true 
  : standardTestCase 32 "Exception 12/13 where passes the modulus 11check (in this example, modulus 10 check passes as well, however, there is no need for it to be performed as the first check passed)." "070116" "34012583" true 
  : standardTestCase 33 "Exception 12/13 where fails the modulus 11 check, but passes the modulus 10 check." "074456" "11104102" true 
  : standardTestCase 34 "Exception 14 where the first check fails and the second check passes." "180002" "00000190" true
  : Nil

type AdditionalTestCase = { sortCode      :: String
                          , accountNumber :: String
                          , shouldPass    :: Boolean }

additionalTestCase :: String -> String -> Boolean -> AdditionalTestCase
additionalTestCase sortCode accountNumber shouldPass =
  { sortCode, accountNumber, shouldPass }

additionalTestCases :: List AdditionalTestCase
additionalTestCases =
    additionalTestCase "404784" "70872490" true
  : additionalTestCase "404784" "70872491" false
  : additionalTestCase "205132" "13537846" true
  : additionalTestCase "205132" "23537846" false
  : additionalTestCase "090128" "03745521" true
  : additionalTestCase "090128" "13745521" false
  : additionalTestCase "560003" "13354647" true
  : additionalTestCase "560003" "23354647" false
  : additionalTestCase "308087" "25337846" false
  : additionalTestCase "308088" "14457846" true
  : additionalTestCase "308088" "24457846" false
  : Nil

runStandardTestCase :: StandardTestCase -> Test
runStandardTestCase testCase =
    Assert.assert errorMessage $ (check testCase.sortCode testCase.accountNumber) == (Right testCase.shouldPass)
  where
    errorMessage = "standard test case #" <> show testCase.testNumber <> " failed"

runAdditionalTestCase :: AdditionalTestCase -> Test
runAdditionalTestCase testCase =
    Assert.assert errorMessage $ (check testCase.sortCode testCase.accountNumber) == (Right testCase.shouldPass)
  where
    errorMessage = "additional test case: " <> show testCase.sortCode <> " " <> show testCase.accountNumber <> " failed"

testParsing :: String -> String -> AccountNumberParser -> Digits -> Test
testParsing sortCode accountNumber parser expectedDigits =
    Assert.assert errorMessage (((eqAccountNumber expected) <$> result) == Right true)
  where
    result       = parseAccountNumber sortCode accountNumber parser
    expected     = { sortCodeString: sortCode, digits: expectedDigits }
    errorMessage =    "failed to parse " <> show sortCode <> " " <> show accountNumber <> " correctly:\n"
                   <> "expected digits: " <> show expectedDigits <> "\n"
                   <> "actual: " <> show (showAccountNumber <$> result)

main :: Effect Unit
main = runTest do
  suite "Modulus check" do
    test "standard test cases" do
      for_ standardTestCases runStandardTestCase
    test "additional test cases" do
      for_ additionalTestCases runAdditionalTestCase
  suite "Account number parsing" do
    test "eight digit test cases" do
      testParsing "123456" "12345678" standardAccountNumberParser $ concat ((1..6) : (1..8) : Nil)
    test "six digit test cases" do
      testParsing "123456" "123456" sixDigitAccountNumberParser $ concat ((1..6) : (0 : 0 : Nil) : (1..6) : Nil)
    test "seven digit test cases" do
      testParsing "123456" "1234567" sevenDigitAccountNumberParser $ concat ((1..6) : (0 : Nil) : (1..7) : Nil)
    test "nine digit test cases" do
      testParsing "123456" "123456789" santanderAccountNumberParser $ concat ((1..5) : (1..9) : Nil)
    test "ten digit test cases" do
      testParsing "123456" "0123456789" nationalWestMinsterAccountNumberParser $ concat ((1..6) : (2..9) : Nil)
      testParsing "123456" "01-23456789" nationalWestMinsterAccountNumberParser $ concat ((1..6) : (2..9) : Nil)
      testParsing "123456" "0123456789" coOperativeOrLeedsBuildingSocietyAccountNumberParser $ concat ((1..6) : (0..7) : Nil)

module Main where

import Prelude (type (~>), Unit, bind, pure, map, (<>), ($))
import Control.Monad.Eff (Eff)
import Data.Array (snoc)
import Data.Either (Either(..))
import Data.Maybe (Maybe(..))
import Halogen (HalogenEffects, ComponentDSL, ComponentHTML, Component, runUI, component, modify)
import Halogen.HTML.Events.Indexed as E
import Halogen.HTML.Indexed as H
import Halogen.HTML.Properties.Indexed as P
import Halogen.Util (awaitBody, runHalogenAff)

import ModulusCheck as M

data CheckResult = Valid
                 | Invalid
                 | Error String

type Row a = { sortCode      :: String
             , accountNumber :: String
             , checkResult   :: a
             }

type State = { validateOnChange :: Boolean
             , currentRow       :: Row (Maybe CheckResult)
             , previousRows     :: Array (Row CheckResult)
             }

data Query a = SetValidateOnChange Boolean a
             | SetSortCode String a
             | SetAccountNumber String a
             | PerformCheck a

emptyRow :: forall a. a -> Row a
emptyRow = { sortCode: ""
           , accountNumber: ""
           , checkResult: _
           }

initialState :: State
initialState = { validateOnChange: false
               , currentRow: emptyRow Nothing
               , previousRows: []
               }

checkAccountNumber :: String -> String -> CheckResult
checkAccountNumber sortCode accountNumber = toCheckResult $ M.check sortCode accountNumber
  where
    toCheckResult :: Either M.Error Boolean -> CheckResult
    toCheckResult (Right true)  = Valid
    toCheckResult (Right false) = Invalid
    toCheckResult (Left reason) = Error reason

ui :: forall g. Component State Query g
ui = component { render, eval }
  where
  
  renderValidateOnChangeToggle :: Boolean -> ComponentHTML Query
  renderValidateOnChangeToggle value =
    H.div_
      [ H.input
        [ P.inputType P.InputCheckbox
        , P.title "Validate on keypress"
        , P.id_ "validateOnChange"
        , P.checked value
        , E.onChecked (E.input SetValidateOnChange)
        ]
      , H.label
        [ P.for "validateOnChange" ]
        [ H.text "Validate on keypress"]
      ]
  
  resultString :: CheckResult -> String
  resultString Valid          = "valid"
  resultString Invalid        = "invalid"
  resultString (Error reason) = "error: " <> reason
  
  resultClassName :: CheckResult -> H.ClassName
  resultClassName Valid          = H.className "valid"
  resultClassName Invalid        = H.className "invalid"
  resultClassName (Error reason) = H.className "error"
  
  renderPreviousRow :: Row CheckResult -> ComponentHTML Query
  renderPreviousRow row =
      H.tr_
        [ H.td_ [H.text row.sortCode]
        , H.td_ [H.text row.accountNumber]
        , H.td
            [P.class_ (resultClassName row.checkResult)]
            [H.text (resultString row.checkResult)]
        ]
  
  renderPreviousRowsTable :: Array (Row CheckResult) -> ComponentHTML Query
  renderPreviousRowsTable rows =
    H.table_
      [ H.thead_
        [ H.tr_
          [ H.th_ [H.text "sort code"]
          , H.th_ [H.text "account number"]
          , H.th_ [H.text "result"]
          ]
        ]
      , H.tbody_ (map renderPreviousRow rows)
      ]
  
  renderCurrentRow :: Row (Maybe CheckResult) -> ComponentHTML Query
  renderCurrentRow row =
      H.div_
        [ H.input
            [ P.inputType P.InputText
            , P.placeholder "sort code"
            , P.value row.sortCode
            , E.onValueInput (E.input SetSortCode)
            ]
        , H.input
            [ P.inputType P.InputText
            , P.placeholder "account number"
            , P.value row.accountNumber
            , E.onValueInput (E.input SetAccountNumber)
            ]
        , H.button
            [ P.title "Check"
            , E.onClick (E.input_ PerformCheck)
            ]
            [ H.text "Check" ]
        , H.span
            [ P.id_ "validation-inline"
            , P.class_ (resultClass row.checkResult)
            ]
            [ H.text (result row.checkResult)]
        ]
    where
      resultClass :: Maybe CheckResult -> H.ClassName
      resultClass Nothing  = H.className "nothing"
      resultClass (Just r) = resultClassName r
        
      result :: Maybe CheckResult -> String
      result Nothing  = ""
      result (Just r) = resultString r

  render :: State -> ComponentHTML Query
  render state =
    H.div_
      [ renderValidateOnChangeToggle state.validateOnChange
      , renderCurrentRow state.currentRow
      , renderPreviousRowsTable state.previousRows
      ]
  
  checkRow :: Row (Maybe CheckResult) -> Row CheckResult
  checkRow row = row { checkResult = checkAccountNumber row.sortCode row.accountNumber }
  
  checkCurrentRow :: Row (Maybe CheckResult) -> Row (Maybe CheckResult)
  checkCurrentRow row = checked { checkResult = Just checked.checkResult }
    where
      checked = checkRow row
  
  performOptionalCurrentRowCheck :: Boolean -> Row (Maybe CheckResult) -> Row (Maybe CheckResult)
  performOptionalCurrentRowCheck true  row = checkCurrentRow row
  performOptionalCurrentRowCheck false row = row { checkResult = Nothing }
  
  updateCurrentRow :: Row (Maybe CheckResult) -> State -> State
  updateCurrentRow currentRow state =
    state { currentRow = performOptionalCurrentRowCheck state.validateOnChange currentRow }

  eval :: Query ~> ComponentDSL State Query g
  eval (SetValidateOnChange input next) = do
    modify (\state -> updateCurrentRow state.currentRow (state { validateOnChange = input }))
    pure next
  eval (SetSortCode input next) = do
    modify (\state -> updateCurrentRow (state.currentRow { sortCode = input }) state)
    pure next
  eval (SetAccountNumber input next) = do
    modify (\state -> updateCurrentRow (state.currentRow { accountNumber = input }) state)
    pure next
  eval (PerformCheck next) = do
    modify (\state -> state { currentRow = emptyRow Nothing
                            , previousRows = snoc state.previousRows (checkRow state.currentRow)
                            })
    pure next

main :: Eff (HalogenEffects ()) Unit
main = runHalogenAff do
  body <- awaitBody
  runUI ui initialState body
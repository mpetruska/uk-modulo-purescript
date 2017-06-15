module ModulusCheck.Parsers
       ( digitsParser
       , eol
       , exactly
       , integerParser
       , parse
       , parseWithError
       , signedIntegerParser
       , stringDigitsParser
       , whiteSpace
       ) where

import Prelude
import Control.Alt ((<|>))
import Data.List (List(..), many, (:))
import Data.Bifunctor (lmap)
import Data.Either (Either)
import Data.Foldable (foldl)
import Data.Int (fromString)
import Data.Maybe (Maybe(..))
import Data.String (singleton)
import Text.Parsing.Parser (Parser, ParseError, fail, runParser, parseErrorMessage, parseErrorPosition)
import Text.Parsing.Parser.Pos (Position(..))
import Text.Parsing.Parser.String (satisfy, string)
import Text.Parsing.Parser.Token (digit)

import ModulusCheckTypes (Error)

eol :: Parser String Unit
eol = do
  _ <- many $ satisfy \c -> c == '\n' || c == '\r'
  pure unit

whiteSpace :: Parser String Unit
whiteSpace = do
  _ <- many $ satisfy \c -> c == ' ' || c == '\t'
  pure unit

digitParser :: Parser String Int
digitParser = do
  d <- digit
  case fromString $ singleton d of
    Just x  -> pure x
    Nothing -> fail $ "expected digit, got: " <> show d

exactly :: forall a. Int -> Parser String a -> Parser String (List a)
exactly n p = loop n initial
  where
    initial :: Parser String (List a)
    initial = (flip Cons) Nil <$> p
    loop :: Int -> Parser String (List a) -> Parser String (List a)
    loop j a
      | j == 1     = a
      | j > 1      = loop (j - 1) $ Cons <$> p <*> a
      | otherwise  = fail "negative or zero n in exactly"

stringDigitsParser :: Int -> Parser String String
stringDigitsParser n = exactly n digit >>= pure <<< foldl (\a x -> a <> (singleton x)) ""
    
digitsParser :: Int -> Parser String (List Int)
digitsParser n = exactly n digitParser

integerParser :: Parser String Int
integerParser = do
  digit  <- digitParser
  digits <- many digitParser
  pure $ foldl (\a x -> a * 10 + x) 0 (digit : digits)

signedIntegerParser :: Parser String Int
signedIntegerParser =
      (string "-" *> integerParser >>= \x -> pure $ -x)
  <|> integerParser

parseErrorToError :: ParseError -> Error
parseErrorToError error =
    message <> ", line: " <> show (line position) <> ", column: " <> show (column position)
  where
    message = parseErrorMessage error
    position = parseErrorPosition error
    line (Position p) = p.line
    column (Position p) = p.column

parse :: forall a. String -> Parser String a -> Either Error a
parse input p = lmap parseErrorToError $ runParser input p

parseWithError :: forall a. Error -> String -> Parser String a -> Either Error a
parseWithError error input p = lmap (const error) $ runParser input p

[![Build Status](https://travis-ci.org/mpetruska/uk-modulo-purescript.svg?branch=master)](https://travis-ci.org/mpetruska/uk-modulo-purescript)

UK modulo - PureScript
======================

This is an implementation of the [VocaLink UK Bank account number
modulus checking][VocaLink link] version 3.90, written in PureScript.

[VocaLink link]: https://www.vocalink.com/customer-support/modulus-checking/

Modulus checking is a procedure used to determine whether a bank account number
can be valid. If the account number check is negative then the account cannot
exist, be the opposite is not true (meaning that if the check succeeds that does
not guarantee the existence of the account).

Based on this modulus checking can be used to help detect some input errors, but
unfortunately there can be errors that are undetected.

License: [MIT](LICENSE)

[Demo page](https://mpetruska.github.io/uk-modulo-purescript/)

Getting started
---------------

    bower install --save purescript-uk-modulo

Setting up gulp build for JavaScript projects:

    bower install --save gulp-purescript

```JavaScript
"use strict";

var gulp = require("gulp"),
    purescript = require("gulp-purescript");

// purescript sources
var sources = [
  "src/**/*.purs",
  "bower_components/purescript-*/src/**/*.purs",
];

// javascript sources
var foreigns = [
  "src/**/*.js",
  "bower_components/purescript-*/src/**/*.js"
];

// Build the purescript sources and put resultant javascript files into output/.
gulp.task("make", function() {
  return purescript.psc({
    src: sources,
    ffi: foreigns
  });
});

gulp.task("default", ["make"]);
```

Usage
-----

PureScript:

```PureScript
import Data.Either (Either(..))
import ModulusCheck (check)

-- valid account number
check "089999" "66374958" === Right true

-- invalid account number
check "089999" "66374959" === Right false

-- invalid format
check "089999" "xxxx" === Left "Account number format is not valid"

```

JavaScript:

```JavaScript
// valid account number
PS.ModulusCheck.JavaScript.check("089999", "66374958").isValid === true;

// invalid account number
var result = PS.ModulusCheck.JavaScript.check("089999", "66374959");
result.isValid === false;
result.isError === false;

// invalid format
var result = PS.ModulusCheck.JavaScript.check("089999", "xxxx");
result.isError === true;
result.error === "Account number format is not valid";
```

Issues
------

Please report issues and feature requests [here](https://github.com/mpetruska/uk-modulo-purescript/issues).

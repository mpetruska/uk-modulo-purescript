[![Build Status](https://travis-ci.org/mpetruska/uk-modulo-purescript.svg?branch=master)](https://travis-ci.org/mpetruska/uk-modulo-purescript)

UK modulo - PureScript
======================

This is an implementation of the [VocaLink UK Bank account number
modulus checking][VocaLink link] 4.10 (and previous versions), written in PureScript.

[VocaLink link]: https://www.vocalink.com/customer-support/modulus-checking/

Modulus checking is a procedure used to determine whether a bank account number
can be valid. If the account number check is negative then the account cannot
exist, but the opposite is not true (meaning that if the check succeeds that does
not guarantee the existence of the account).

Modulus checking can be used to help detect some input errors, but
unfortunately there can be user errors that remain undetected.

License: [MIT](LICENSE)

[Demo page](https://mpetruska.github.io/uk-modulo-purescript/)

Getting started
---------------

For PureScript projects:

    npm install purescript@^0.10.3 --save-dev
    bower install purescript-uk-modulo --save

Setting up gulp build for JavaScript projects:

    npm install purescript@^0.10.3 --save-dev
    bower install gulp-purescript --save-dev
    bower install purescript-uk-modulo --save

```JavaScript
"use strict";

var gulp = require("gulp"),
    purescript = require("gulp-purescript");

// PureScript sources
var sources = [
  "src/**/*.purs",
  "bower_components/purescript-*/src/**/*.purs",
];

// Build the PureScript sources and put resultant javascript files into output.
gulp.task("make", function() {
  return purescript.psc({
    src: sources
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

Version history
---------------

* 1.2.0 - updates implementation according to [version 4.10 of the spec](https://www.vocalink.com/media/2295/vocalink-validating-account-numbers-v410.pdf)
  (effective from 2017/01/09)
* 1.1.0 - updates implementation according to [version 4.00 of the spec](https://www.vocalink.com/media/2101/vocalink-validating-account-numbers-v400.pdf)
  (effective from 2017/01/09)
* 1.0.1 - build updated, PureScript version 0.10.3
* 1.0.0 - initial release, spec version 3.90

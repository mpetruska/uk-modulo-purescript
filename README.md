[![Build Status](https://travis-ci.org/mpetruska/uk-modulo-purescript.svg?branch=master)](https://travis-ci.org/mpetruska/uk-modulo-purescript)

UK modulo - PureScript
======================

This is an implementation of the [VocaLink UK Bank account number
modulus checking][VocaLink link] 5.40 (and previous versions), written in PureScript.

[VocaLink link]: https://www.vocalink.com/customer-support/modulus-checking/

Modulus checking is a procedure used to determine whether a bank account number
can be valid. If the account number check is negative then the account cannot
exist, but the opposite is not true (meaning that if the check succeeds that does
not guarantee the existence of the account).

Modulus checking can be used to help detect some input errors, but
unfortunately there can be user errors that remain undetected.

License: [MIT](LICENSE)

[Demo page](https://mpetruska.github.io/uk-modulo-purescript/)

Notes on validating sort codes
------------------------------

The ["Industry Sorting Code Directory" (ISCD)][ICSD link]
should be used to validate UK sort codes.

[ICSD link]: https://en.wikipedia.org/wiki/Industry_Sorting_Code_Directory

Getting started
---------------

For PureScript projects:

    npm install purescript --save-dev
    bower install purescript-uk-modulo --save

Setting up gulp build for JavaScript projects:

    npm install purescript --save-dev
    bower install gulp-purescript --save-dev
    bower install purescript-uk-modulo --save

```JavaScript
"use strict";

var gulp = require("gulp"),
    purescript = require("gulp-purescript");

// PureScript sources
var sources = [
  "bower_components/purescript-*/src/**/*.purs"
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

* 5.40.0 - updates implementation according to [version 5.40 of the spec](https://www.vocalink.com/media/3061/vocalink-validating-account-numbers-v540.pdf)
  (valid from 2019-01-28)
* 5.30.0 - updates implementation according to [version 5.30 of the spec](https://www.vocalink.com/media/3047/vocalink-validating-account-numbers-v530.pdf)
  (valid from 2018-11-26)
* 5.20.1 - upgrades to Purescript version 0.12
* 5.20.0 - updates implementation according to [version 5.20 of the spec](https://www.vocalink.com/media/3038/validating-account-numbers-v520.pdf)
  (valid from 2018-10-22)
* 5.10.0 - updates implementation according to [version 5.10 of the spec](https://www.vocalink.com/media/3035/validating-account-numbers-v510.pdf)
  (valid from 2018-09-17)
* 5.0.0 - updates implementation according to [version 5.00 of the spec](https://www.vocalink.com/media/3019/vocalink-validating-account-numbers-v500.pdf)
  (valid from 2018-08-06)
* 1.9.0 - updates implementation according to [version 4.90 of the spec](https://www.vocalink.com/media/3004/vocalink-validating-account-numbers-v490.pdf)
  (valid from 2018-07-02)
* 1.8.0 - updates implementation according to [version 4.80 of the spec](https://www.vocalink.com/media/2920/vocalink-validating-account-numbers-v480.pdf)
  (valid from 2018-04-16)
* 1.7.0 - updates implementation according to [version 4.70 of the spec](https://www.vocalink.com/media/2904/vocalink-validating-account-numbers-v47.pdf)
  (valid from 2018-03-26)
* 1.6.0 - updates implementation according to [version 4.60 of the spec](https://www.vocalink.com/media/2771/vocalink-validating-account-numbers-v460.pdf)
  (valid from 2017-10-09)
* 1.5.0 - updates implementation according to [version 4.40 of the spec](https://www.vocalink.com/media/2717/vocalink-validating-account-numbers-v440.pdf)
  (valid from 2017-08-21)
* 1.4.0 - updates implementation according to [version 4.30 of the spec](https://www.vocalink.com/media/2467/vocalink-validating-account-numbers-v430.pdf)
  (valid from 2017-07-03)
* 1.3.0 - updates implementation according to [version 4.20 of the spec](https://www.vocalink.com/media/2434/vocalink-validating-account-numbers-v420.pdf)
  (valid from 2017-06-12)
* 1.2.0 - updates implementation according to [version 4.10 of the spec](https://www.vocalink.com/media/2295/vocalink-validating-account-numbers-v410.pdf)
  (valid from 2017-01-09)
* 1.1.0 - updates implementation according to [version 4.00 of the spec](https://www.vocalink.com/media/2101/vocalink-validating-account-numbers-v400.pdf)
  (valid from 2017-01-09)
* 1.0.1 - build updated, PureScript version 0.10.3
* 1.0.0 - initial release, spec version 3.90

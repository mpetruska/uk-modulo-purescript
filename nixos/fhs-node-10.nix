let nixpkgs = import <nixpkgs> {};
in rec {
  fhsEnv = nixpkgs.buildFHSUserEnv {
    name = "fhs-node-10";
    targetPkgs = pkgs: [];
    multiPkgs = pkgs: [
      pkgs.nodejs-10_x
      pkgs.zlib
      pkgs.ncurses5
      pkgs.gmp
      pkgs.git
    ];
    runScript = "nixos/build-env-init";
  };
}

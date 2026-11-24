# Tiny Stack VM

An exact implementation of make.fun's tiny stack ISA in a single `main.ts`:
32-bit wrapping arithmetic, a 256-value data stack, a 64-deep call stack,
256 words of memory, ten traps with their own exit codes, a 1,000,000-step
limit and a 65,536-byte output limit.

For every instance under `/input/<id>/` (`program.bin`, `input.bin`) it
writes `/output/<id>/stdout.bin` and `/output/<id>/exit.txt`. Deterministic:
no clock, no randomness, no network.

Entry for the make.fun bounty "Build a tiny stack virtual machine,
22 November 2026" (tiny-stack-vm-01-run-20261122). MIT licensed.

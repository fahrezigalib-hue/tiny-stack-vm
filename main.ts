// Tiny stack VM for make.fun bounty tiny-stack-vm-01-run-20261122: an exact
// implementation of the tiny stack ISA (32-bit wrapping values, 256-value
// stack, 64-deep call stack, 256 words of memory, ten traps, 1,000,000-step
// and 65,536-byte output limits). Writes /output/<id>/stdout.bin and
// /output/<id>/exit.txt for every instance under /input. Deterministic.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
const IN = process.env.MAKEFUN_INPUT_DIR || "/input";
const OUT = process.env.MAKEFUN_OUTPUT_DIR || "/output";
// Opcode facts for bytes 0x00..0x53: immediate length (-1 = not an opcode),
// pops, pushes. Gaps in the opcode map carry -1.
const IM = new Array(256).fill(-1), PO = new Array(256).fill(0), PU = new Array(256).fill(0);
const F: Record<number, [number, number, number]> = {
  0:[0,0,0], 1:[1,0,1], 2:[4,0,1], 3:[0,1,0], 4:[0,1,2], 5:[0,2,2], 6:[0,2,3], 7:[0,3,3],
  16:[0,2,1], 17:[0,2,1], 18:[0,2,1], 19:[0,2,1], 20:[0,2,1], 21:[0,2,1], 22:[0,2,1], 23:[0,1,1],
  24:[0,2,1], 25:[0,2,1], 26:[0,2,1], 27:[0,1,1], 28:[0,2,1], 29:[0,2,1], 30:[0,2,1],
  32:[0,2,1], 33:[0,2,1], 34:[0,2,1], 48:[2,0,0], 49:[2,1,0], 50:[2,1,0], 51:[2,0,0], 52:[0,0,0],
  64:[0,1,1], 65:[0,2,0], 80:[0,1,0], 81:[0,1,0], 82:[0,0,1], 83:[0,1,0],
};
for (const k in F) { const [i, p, u] = F[k]; IM[+k] = i; PO[+k] = p; PU[+k] = u; }

function run(P: Buffer, N: Buffer) {
  const n = P.length, D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256);
  const O = new Uint8Array(65536);
  let sp = 0, cp = 0, ol = 0, ip = 0, pc = 0, st = 0;
  const end = (e: number) => ({ out: Buffer.from(O.subarray(0, ol)), exit: e });
  for (;;) {
    if (st === 1000000) return end(10);
    if (pc < 0 || pc >= n) return end(9);
    const op = P[pc], im = IM[op];
    if (im < 0) return end(5);
    if (pc + im >= n) return end(9);
    st++;
    if (sp < PO[op]) return end(2);
    if (sp - PO[op] + PU[op] > 256) return end(3);
    const nx = pc + 1 + im;
    pc = nx;
    switch (op) {
      case 0: return end(0);
      case 1: D[sp++] = (P[nx - 1] << 24) >> 24; break;
      case 2: D[sp++] = P[nx - 4] | (P[nx - 3] << 8) | (P[nx - 2] << 16) | (P[nx - 1] << 24); break;
      case 3: sp--; break;
      case 4: D[sp] = D[sp - 1]; sp++; break;
      case 5: { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
      case 6: D[sp] = D[sp - 2]; sp++; break;
      case 7: { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
      case 23: D[sp - 1] = -D[sp - 1] | 0; break;
      case 27: D[sp - 1] = ~D[sp - 1]; break;
      case 16: case 17: case 18: case 19: case 20: case 21: case 22:
      case 24: case 25: case 26: case 28: case 29: case 30:
      case 32: case 33: case 34: {
        const b = D[sp - 1], a = D[sp - 2];
        let r: number;
        if (op === 16) r = (a + b) | 0;
        else if (op === 17) r = (a - b) | 0;
        else if (op === 18) r = Math.imul(a, b);
        else if (op === 19) { if (!b) return end(4); r = a === -2147483648 && b === -1 ? a : (a / b) | 0; }
        else if (op === 20) { if (!b) return end(4); r = b === -1 ? 0 : (a % b) | 0; }
        else if (op === 21) { if (!b) return end(4); r = Math.floor((a >>> 0) / (b >>> 0)) | 0; }
        else if (op === 22) { if (!b) return end(4); r = ((a >>> 0) % (b >>> 0)) | 0; }
        else if (op === 24) r = a & b;
        else if (op === 25) r = a | b;
        else if (op === 26) r = a ^ b;
        else if (op === 28) r = a << (b & 31);
        else if (op === 29) r = a >> (b & 31);
        else if (op === 30) r = (a >>> (b & 31)) | 0;
        else if (op === 32) r = a === b ? 1 : 0;
        else if (op === 33) r = a < b ? 1 : 0;
        else r = (a >>> 0) < (b >>> 0) ? 1 : 0;
        D[--sp - 1] = r;
        break;
      }
      case 48: case 49: case 50: {
        const rel = ((P[nx - 2] | (P[nx - 1] << 8)) << 16) >> 16;
        let take = op === 48;
        if (!take) { const v = D[--sp]; take = op === 49 ? v === 0 : v !== 0; }
        if (take) pc = nx + rel;
        break;
      }
      case 51:
        if (cp === 64) return end(7);
        C[cp++] = nx;
        pc = P[nx - 2] | (P[nx - 1] << 8);
        break;
      case 52:
        if (!cp) return end(8);
        pc = C[--cp];
        break;
      case 64: {
        const a = D[sp - 1];
        if (a < 0 || a > 255) return end(6);
        D[sp - 1] = M[a];
        break;
      }
      case 65: {
        const a = D[sp - 1];
        if (a < 0 || a > 255) return end(6);
        M[a] = D[sp - 2];
        sp -= 2;
        break;
      }
      case 80: {
        const s = String(D[sp - 1]);
        if (ol + s.length > 65536) return end(11);
        sp--;
        for (let i = 0; i < s.length; i++) O[ol++] = s.charCodeAt(i);
        break;
      }
      case 81:
        if (ol === 65536) return end(11);
        O[ol++] = D[--sp] & 255;
        break;
      case 82: D[sp++] = ip < N.length ? N[ip++] : -1; break;
      case 83: return end(D[--sp] & 255);
    }
  }
}

for (const id of readdirSync(IN, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()) {
  const prog = readFileSync(join(IN, id, "program.bin"));
  const ip = join(IN, id, "input.bin");
  const { out, exit } = run(prog, existsSync(ip) ? readFileSync(ip) : Buffer.alloc(0));
  mkdirSync(join(OUT, id), { recursive: true });
  writeFileSync(join(OUT, id, "stdout.bin"), out);
  writeFileSync(join(OUT, id, "exit.txt"), String(exit));
}

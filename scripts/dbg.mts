import * as R from "../src/lib/gregg/rules.ts";
for (const [w, s] of [["nation", "nAS0n"], ["nations", "nAS0nz"], ["prosecution", "pras0kyUS0n"], ["some", "s^m"], ["done", "d^n"], ["moon", "mUn"], ["unless", "0nles"], ["under","^nd9"], ["summer","s^m9"], ["come","k^m"], ["but","b^t"]]) console.log(w.padEnd(12), R.tokensToCode(R.soundsToTokens(s.split(""), "centennial", w)));

Take a hard look at the code at hand and be brutally critical.

Find the obviously stupid parts: hacks, brittle special cases, duplicated flows, dead helpers, confusing names, needless indirection, fake abstractions, unsafe defaults, and anything that exists only because nobody stopped to clean it up.

If the fix is small and obviously correct, do it. If the architecture is clearly wrong and the right fix is bigger, stop and propose the refactor first: what is wrong, what should change, and the smallest useful first step.

When fixing:
- preserve sane product behavior; if the behavior itself is stupid, treat it as the bug
- delete dead code instead of preserving it for vibes
- replace hacks with boring, direct code
- keep changes small enough to review
- do not touch unrelated dirty work
- run the relevant checks

End with a blunt summary of what was dumb, what changed, and what still smells.

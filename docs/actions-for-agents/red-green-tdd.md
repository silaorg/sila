Use red/green TDD for the Heswe change at hand.

Start with the smallest test that proves the missing or broken behavior. Run it and confirm that it fails for the expected reason. Implement the smallest clear fix, then run the focused test until it passes.

After the focused test is green:

- add nearby edge cases that protect the behavior
- run the relevant Heswe workspace checks
- keep refactors separate unless they make the tested behavior easier to understand
- do not weaken assertions just to make the test pass

End with the failing behavior, the fix, and the checks that passed.
